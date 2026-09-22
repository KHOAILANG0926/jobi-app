import { renderToString } from 'react-dom/server'
import { StaticRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import { JobsProvider } from './context/JobsContext'
import { BrandsProvider } from './context/BrandsContext'
import { NotificationProvider } from './context/NotificationContext'
import { JobDetail } from './pages/JobDetail'
import UrgentJobsPage from './pages/jobsMenu/UrgentJobsPage'
import { JobSearchPage } from './pages/JobSearchPage'
import { fetchJobsData } from './lib/fetchJobsData'
import { supabaseServer } from './lib/supabaseServer'
import {
  computeSitemapEligiblePages,
  isRepresentativeCandidate,
  normalizeSearchQuery,
  buildRepresentativePageCopy,
} from './lib/representativeSearchPages'
import { filterAndSortJobs, parseJobSearchParamsFromQueryString } from './lib/jobSearch'
import type { Job } from './types/job'

/** api/ssr.js(순수 컴파일된 JS, Vercel Node 런타임에서 TS 소스를 직접
 *  import 안 함)가 쓰는 단 하나의 진입점 — 데이터 fetch부터 렌더까지 이
 *  파일(빌드되면 dist/server/entry-server.js) 안에서 전부 끝낸다. */
export async function loadJobsForSSR(): Promise<{ jobs: Job[]; jobsError: boolean }> {
  return fetchJobsData(supabaseServer)
}

// api/ssr.js·api/sitemap.xml.js가 TS 소스를 직접 못 읽으므로 재수출.
export { isRepresentativeCandidate, normalizeSearchQuery, buildRepresentativePageCopy }

// sitemap.xml.js가 대표 후보 중 지금 실제로 sitemap에 올릴 만큼(기준
// 이상) 공고가 있는 것만 뽑는다 — countSearchResults(아래)를 그대로
// 넘겨써서 "화면에 보이는 결과 수"와 완전히 같은 기준으로 판정한다.
export function computeSitemapPages(jobs: Job[]) {
  return computeSitemapEligiblePages(jobs, countSearchResults)
}

/** api/ssr.js가 /viec-lam/tim-kiem 요청의 빈 결과 여부·대표 페이지 판정에
 *  쓴다 — JobSearchPage.tsx가 실제로 렌더에 쓰는 것과 완전히 같은
 *  필터 함수라 "화면에 보이는 결과"와 "색인 판정에 쓰는 개수"가
 *  어긋나지 않는다(개인화 정렬(recommended)의 preferredCategories는
 *  빈 Map — 익명 크롤러 기준 개수 판정이라 로그인 개인화는 무관). */
export function countSearchResults(jobs: Job[], search: string): number {
  return filterAndSortJobs(jobs, parseJobSearchParamsFromQueryString(search), new Map()).length
}

/** api/ssr.js가 다루는 세 라우트(공고 상세/급구 목록/공개 검색)만
 *  직접(비-lazy) import해서 구성한다 — App.tsx의 전체 라우트 트리는 전부
 *  React.lazy()라 renderToString과 같이 못 쓴다(lazy는 프로미스를 던지는데
 *  renderToString은 그걸 기다려주지 않음). 이 파일은 App.tsx의 Routes 중
 *  이 세 개만 그대로 복제한 것이라, App.tsx에 이 라우트들의 path/element가
 *  바뀌면 여기도 같이 바꿔야 한다. */
export function render(url: string, jobs: Job[], jobsError: boolean): string {
  return renderToString(
    <StaticRouter location={url}>
      <AuthProvider>
        <JobsProvider initialJobs={jobs} initialJobsError={jobsError}>
          <BrandsProvider>
            <NotificationProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/viec-lam/tim-kiem" element={<JobSearchPage />} />
                  <Route path="/viec-lam/tuyen-gap" element={<UrgentJobsPage />} />
                  <Route path="/viec-lam/:id" element={<JobDetail />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </NotificationProvider>
          </BrandsProvider>
        </JobsProvider>
      </AuthProvider>
    </StaticRouter>,
  )
}
