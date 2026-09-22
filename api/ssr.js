import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadJobsForSSR,
  render,
  isRepresentativeCandidate,
  normalizeSearchQuery,
  countSearchResults,
  buildRepresentativePageCopy,
} from '../dist/server/entry-server.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SITE_ORIGIN = 'https://viecganban.vn'

// 빌드된 dist/index.html을 템플릿으로 그대로 재사용한다 — vite가 이미
// 해시된 실제 script/css 태그(/assets/index-XXXX.js 등)를 박아둔 파일이라
// manifest.json을 따로 파싱해 태그를 직접 조립할 필요가 없다. 콜드 스타트
// 때 한 번만 읽고 모듈 스코프에 캐싱(같은 람다 인스턴스가 재사용되는 동안
// 매 요청마다 디스크 I/O 안 함).
let indexHtmlTemplate = null
function getIndexHtmlTemplate() {
  if (indexHtmlTemplate === null) {
    indexHtmlTemplate = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf-8')
  }
  return indexHtmlTemplate
}

// App.tsx의 실제 Routes 순서를 그대로 반영 — /viec-lam/ 아래 이 6개는 이미
// 각자 전용(비-SSR 또는 SSR) 페이지라 :id 동적 라우트보다 우선한다. 이
// 목록이 App.tsx의 정적 /viec-lam/* 라우트와 어긋나면 그 라우트가 여기서
// (잘못된) job id 취급을 받게 되므로, 새 정적 /viec-lam/* 라우트를 추가할
// 때는 반드시 같이 갱신해야 한다.
const STATIC_VIEC_LAM_SLUGS = new Set(['da-luu', 'da-xem', 'phu-hop', 'goi-y', 'tuyen-gap', 'tim-kiem'])

// JSON.stringify 결과를 <script> 안에 안전하게 박기 위한 이스케이프 —
// "</script"가 그대로 들어가면 태그가 조기 종료되고, U+2028/U+2029는 JSON
// 상 유효한 문자지만 일부 JS 파서가 줄바꿈으로 오인해 파싱 에러를 낸다.
const LINE_SEPARATOR = String.fromCharCode(0x2028)
const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

function safeJsonForScript(value) {
  return JSON.stringify(value)
    .split('<').join('\u003c')
    .split(LINE_SEPARATOR).join('\u2028')
    .split(PARAGRAPH_SEPARATOR).join('\u2029')
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// schema.org JobPosting — 2026-09-22 사용자 지시("추가한다면 상세 공고의
// 실제 값만 사용"). 아래 필드만 넣고 나머지(employmentType, baseSalary
// 등)는 일부러 뺐다: workPeriod/hours가 크롤러 자유텍스트라 FULL_TIME/
// PART_TIME 같은 schema.org 고정 enum이나 salary는 숫자형 QuantitativeValue로
// 정확히 매핑할 근거가 없고, 잘못 매핑하면 "실제 값"이 아니라 추측이 된다.
function buildJobPostingJsonLd(job, canonicalUrl) {
  // "## Mô tả công việc" 같은 마크다운 헤딩 기호(##)는 화면에서만 카드
  // 제목으로 렌더되는 내부 구분자라, JSON-LD의 순수 텍스트 description에는
  // 기호 없이 줄바꿈만 남긴다(내용 자체는 원문 그대로 — 새로 만들지 않음).
  const plainDescription = (job.description ?? '').replace(/^## /gm, '').trim() || job.title

  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: plainDescription,
    datePosted: job.postedAt,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressCountry: 'VN',
      },
    },
    identifier: {
      '@type': 'PropertyValue',
      name: 'Việt Gần Bạn',
      value: job.id,
    },
    url: canonicalUrl,
  }
  if (job.applicationDeadline) jsonLd.validThrough = job.applicationDeadline
  return jsonLd
}

export default async function handler(req, res) {
  const parsedUrl = new URL(req.url, 'https://placeholder.local')
  const pathname = parsedUrl.pathname
  const search = parsedUrl.search

  const jobDetailMatch = pathname.match(/^\/viec-lam\/([^/]+)$/)
  const isUrgentList = pathname === '/viec-lam/tuyen-gap'
  const isSearch = pathname === '/viec-lam/tim-kiem'
  const isJobDetail = !isUrgentList && !isSearch && jobDetailMatch && !STATIC_VIEC_LAM_SLUGS.has(jobDetailMatch[1])

  if (!isUrgentList && !isSearch && !isJobDetail) {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  let jobs, jobsError
  try {
    ;({ jobs, jobsError } = await loadJobsForSSR())
  } catch (e) {
    console.error('api/ssr: loadJobsForSSR threw', e)
    jobsError = true
    jobs = []
  }

  // DB 조회 자체가 실패한 건 "이 조건에 맞는 공고가 0건"과 다르다 — 실패를
  // 0건/404처럼 보여주면 크롤러가 그 URL을 진짜 빈 페이지로 오해해 재시도
  // 없이 넘어가 버릴 수 있다. 503 + Retry-After로 "일시적 실패"임을 明시.
  if (jobsError) {
    res.statusCode = 503
    res.setHeader('Retry-After', '30')
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end('Temporarily unavailable — please retry shortly.')
    return
  }

  let notFound = false
  let foundJob = null
  if (isJobDetail) {
    const id = jobDetailMatch[1]
    foundJob = jobs.find((j) => j.id === id) ?? null
    notFound = foundJob === null
  }

  const appHtml = render(pathname + search, jobs, jobsError)
  const template = getIndexHtmlTemplate()

  const initialState = safeJsonForScript({ jobs, jobsError })
  let finalHtml = template
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
    .replace(
      '</body>',
      `<script id="__INITIAL_STATE__" type="application/json">${initialState}</script></body>`,
    )

  // canonical/색인 정책 — 2026-09-22 두 번째 개정(사용자 지시):
  // "공고 3건 이상인 모든 지역·업직종을 자동 색인하지 말 것 / 전체 검색
  // 기능과 색인 대상 관리를 분리할 것 / 대표 페이지는 별도 설정 목록으로
  // 관리 / 공고 수 변동만으로 canonical이 계속 바뀌지 않게 할 것 /
  // 내용이 다른 필터 결과를 기본 검색 URL의 중복 페이지로 간주하지 말 것
  // / 비대표 조합과 빈 결과는 noindex,follow / canonical은 자기 URL로
  // 유지."
  //
  // 이전 버전(같은 날 1차 개정)은 "지금 실제 공고 수가 기준 이상이면
  // 자동으로 대표 페이지"였다 — 검색 지원 범위(넓어야 함)와 색인 관리
  // 대상(신중해야 함)이 같은 계산에 묶여 있었고, 공고 수가 임계값을
  // 오르내리면 canonical 대상 자체가 바뀌는 문제도 있었다. 지금은:
  //  - "대표 후보"는 REPRESENTATIVE_SEARCH_PAGE_CANDIDATES 고정 목록
  //    (src/lib/representativeSearchPages.ts, 사람이 직접 관리)으로만
  //    정해진다 — 실시간 공고 수로 후보 자체가 늘거나 줄지 않는다.
  //  - canonical은 이제 대표/비대표 가리지 않고 **항상 자기 자신**이다
  //    (필터 결과가 다르면 다른 콘텐츠이지, 기본 URL의 중복이 아니라는
  //    원칙). 급구 목록만 예외로 기존 정책(항상 기본 URL로 수렴) 유지 —
  //    이번 지시 범위가 공개 검색(tim-kiem)에 한정돼 있고, 급구는 필터
  //    차원이 너무 많고 공고 자체가 3건뿐이라 대표 후보 목록을 아직 못
  //    만듦(다음 결정 필요 사항으로 별도 보고).
  //  - robots는 "대표 후보 목록에 있는가"로만 정해진다(공고 수 무관,
  //    canonical과 마찬가지로 안정적) — 후보가 아니면 noindex,follow.
  //    후보이더라도 지금 실제 결과가 0건이면(재고 소진 등) 안전장치로
  //    noindex,follow를 붙인다. sitemap 등재 여부는 이 판정과 별개로
  //    api/sitemap.xml.js가 "후보 중 지금 최소 기준을 넘는 것만" 골라
  //    관리한다(일시 제외/복귀가 canonical·robots엔 영향 없음).
  let canonicalUrl
  let robotsMeta = null
  let representativeCopy = null
  if (isSearch) {
    const normalizedQuery = normalizeSearchQuery(search)
    canonicalUrl = `${SITE_ORIGIN}${pathname}${normalizedQuery === '__non_representative__' ? search : normalizedQuery}`
    const isRepresentative = normalizedQuery !== '__non_representative__' && isRepresentativeCandidate(normalizedQuery)
    // 대표 canonical(normalizedQuery)로 개수를 셌다 — sort/page/utm 같은
    // 무시 파라미터는 결과 집합 자체를 안 바꾸므로 원본 search로 세든
    // 정규화된 쿼리로 세든 같은 값이어야 한다(안 같으면 그 자체가 버그).
    const resultCount = countSearchResults(jobs, normalizedQuery === '__non_representative__' ? search : normalizedQuery)
    if (!isRepresentative || resultCount === 0) robotsMeta = 'noindex, follow'
    // 2026-09-22 지시 — 대표 업직종/지역 페이지는 title/description/H1을
    // 실제 필터명+실제 공고 수로 개별화한다(기본 페이지""는 대상 아님 —
    // buildRepresentativePageCopy가 cat=/region= 형태만 처리하고 나머지는
    // null 반환). JobSearchPage.tsx도 같은 함수로 H1을 계산하므로 SSR과
    // hydration 후 값이 어긋나지 않는다.
    if (isRepresentative) representativeCopy = buildRepresentativePageCopy(normalizedQuery, resultCount)
  } else if (isUrgentList) {
    canonicalUrl = `${SITE_ORIGIN}/viec-lam/tuyen-gap`
  } else {
    canonicalUrl = `${SITE_ORIGIN}${pathname}`
  }
  finalHtml = finalHtml.replace('</head>', `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" /></head>`)
  if (robotsMeta) {
    finalHtml = finalHtml.replace('</head>', `<meta name="robots" content="${robotsMeta}" /></head>`)
  }
  if (representativeCopy) {
    finalHtml = finalHtml
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(representativeCopy.title)}</title>`)
      .replace(
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${escapeHtml(representativeCopy.description)}" />`,
      )
  }

  // 공고 상세는 페이지마다 <title>/<meta description>을 실제 내용으로
  // 채운다 — 전부 같은 제목이면 검색엔진/AI 검색이 서로 다른 공고를
  // 구분·인용할 근거(제목·요약)가 없다. 목록 페이지는 그대로 둔다(공고가
  // 수시로 바뀌어 대표 제목을 정하기 애매함).
  if (foundJob) {
    const descSnippet = (foundJob.description ?? '')
      .replace(/^##.*$/gm, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 150)
    const title = `${foundJob.title} — ${foundJob.company} | Việt Gần Bạn`
    const description = descSnippet
      ? `${foundJob.title} tại ${foundJob.company}. ${descSnippet}`
      : `${foundJob.title} tại ${foundJob.company} — ${foundJob.location}. Xem chi tiết và ứng tuyển trên Việt Gần Bạn.`
    finalHtml = finalHtml
      .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
      .replace(
        /<meta name="description" content=".*?" \/>/,
        `<meta name="description" content="${escapeHtml(description)}" />`,
      )

    const jsonLd = safeJsonForScript(buildJobPostingJsonLd(foundJob, canonicalUrl))
    finalHtml = finalHtml.replace(
      '</head>',
      `<script type="application/ld+json">${jsonLd}</script></head>`,
    )
  }

  res.statusCode = notFound ? 404 : 200
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  // 크롤러가 반복 요청하는 URL이므로 짧게라도 캐시해 매 요청마다 DB
  // 전체를 다시 훑지 않게 한다 — 크롤링 갱신은 "몇 분 내 반영"이면 충분
  // (초 단위 실시간 반영이 요구사항이 아니었음). stale-while-revalidate로
  // 캐시 만료 직후에도 옛 응답을 즉시 내려주고 백그라운드에서 새로 받는다.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=600')
  res.end(finalHtml)
}
