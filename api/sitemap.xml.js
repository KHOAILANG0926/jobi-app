import { loadJobsForSSR, computeSitemapPages } from '../dist/server/entry-server.js'

const SITE_ORIGIN = 'https://viecganban.vn'

// entry-server.js가 실제 활성 공고가 하나도 없을 때만 쓰는 가짜 예시
// 데이터(demo-1 등) — sitemap에 가짜 공고 URL을 실제 공고처럼 올리면 절대
// 안 되므로 id 패턴으로 명시적으로 걸러낸다.
function isRealJob(job) {
  return typeof job.id === 'string' && !job.id.startsWith('demo-')
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function urlEntry(loc, { lastmod, changefreq, priority }) {
  let xml = `  <url>\n    <loc>${escapeXml(loc)}</loc>\n`
  if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`
  if (changefreq) xml += `    <changefreq>${changefreq}</changefreq>\n`
  if (priority) xml += `    <priority>${priority}</priority>\n`
  xml += '  </url>\n'
  return xml
}

export default async function handler(req, res) {
  let jobs = []
  try {
    const result = await loadJobsForSSR()
    if (!result.jobsError) jobs = result.jobs.filter(isRealJob)
  } catch (e) {
    console.error('api/sitemap.xml: loadJobsForSSR threw', e)
  }

  // 2026-09-22 두 번째 개정 — 대표 "후보" 자체는 src/lib/
  // representativeSearchPages.ts의 고정 목록(사람이 관리, 공고 수로
  // 자동으로 늘거나 줄지 않음)으로만 정해지고, 여기서는 그 후보 중
  // "지금 실제로 sitemap에 올릴 만큼(최소 기준 이상) 공고가 있는 것"만
  // 골라 싣는다 — 기준 미달이면 sitemap에서만 일시 제외되고(canonical/
  // robots는 후보 목록 등재 여부로만 정해지므로 영향 없음), 공고가 다시
  // 늘면 다음 sitemap 생성 때 자동으로 복귀한다. 급구 목록의 필터 조합
  // URL은 여전히 안 올린다(급구는 아직 대표 후보 목록 자체가 없음 —
  // 다음 결정 필요 사항으로 보고됨). sitemap에서 빠진다고 그 URL 자체가
  // 색인 차단(noindex)되는 건 아니다 — robots.txt는 전부 Allow이므로
  // 크롤러가 링크를 따라가서 직접 찾는 것 자체는 항상 가능하다.
  const sitemapPages = computeSitemapPages(jobs)
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  xml += urlEntry(`${SITE_ORIGIN}/`, { changefreq: 'hourly', priority: '1.0' })
  xml += urlEntry(`${SITE_ORIGIN}/viec-lam/tuyen-gap`, { changefreq: 'hourly', priority: '0.8' })
  xml += urlEntry(`${SITE_ORIGIN}/viec-lam/tim-kiem`, { changefreq: 'hourly', priority: '0.9' })
  for (const page of sitemapPages) {
    xml += urlEntry(`${SITE_ORIGIN}/viec-lam/tim-kiem${page.query}`, { changefreq: 'daily', priority: '0.6' })
  }
  for (const job of jobs) {
    xml += urlEntry(`${SITE_ORIGIN}/viec-lam/${job.id}`, {
      lastmod: job.postedAt || undefined,
      changefreq: 'daily',
      priority: '0.7',
    })
  }
  xml += '</urlset>\n'

  res.statusCode = 200
  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  // 공고 추가/마감이 몇 분 내 반영되면 충분(실시간 요구사항 아님) —
  // api/ssr.js와 동일한 캐시 정책.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800')
  res.end(xml)
}
