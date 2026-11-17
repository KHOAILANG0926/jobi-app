// 열어 둔 화면에서 베트남 자정이 지나면 구독자가 깨어나 마감 공고가 빠지는지 시험(Codex P1, #728 R4). 가짜 시계로 시간을 흘린다.
import { getTodayVn, subscribeTodayVn } from './todayVnStore.ts'
import { filterOpenJobs } from './jobDetailView.ts'

function assert(cond: boolean, msg: string) { if (!cond) throw new Error(`FAIL: ${msg}`) }
// node:test·node:fs는 src/ tsconfig(브라우저 타입)에 타입이 없어 동적 import로 불러온다(jobAlerts.test.ts와 같은 방식).
const { mock } = await import('node:' + 'test') as { mock: { timers: { enable: (o: unknown) => void; tick: (ms: number) => void; reset: () => void } } }
const { readFileSync } = await import('node:' + 'fs') as { readFileSync: (u: URL, enc: string) => string }

mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-14T16:59:50Z') })   // 베트남 11-14 23:59:50
const jobs = [{ id: 'today', applicationDeadline: '2026-11-14' }, { id: 'always', applicationDeadline: '' }, { id: 'later', applicationDeadline: '2026-11-20' }]
let calls = 0
let shown = filterOpenJobs(jobs, getTodayVn())
const unsubscribe = subscribeTodayVn(() => { calls++; shown = filterOpenJobs(jobs, getTodayVn()) })
assert(shown.map((j) => j.id).join() === 'today,always,later', '마감 당일 23:59:50에는 공개')
mock.timers.tick(9000)   // 23:59:59
assert(calls === 0 && shown.length === 3, '자정 전에는 구독자를 깨우지 않음')
mock.timers.tick(1100)   // 00:00:00 직후
assert(calls === 1 && getTodayVn() === '2026-11-15', '자정이 지나면 날짜가 바뀌고 구독자가 한 번 깨어남')
assert(shown.map((j) => j.id).join() === 'always,later', '페이지를 열어 둔 채로도 마감 당일 공고가 빠짐(같은 목록, 새 날짜)')
mock.timers.tick(86400000)
assert(calls === 2 && getTodayVn() === '2026-11-16', '다음 날 자정에도 다시 깨어남(타이머가 이어짐)')
unsubscribe()
mock.timers.tick(86400000)
assert(calls === 2, '구독 해제 뒤에는 깨우지 않음')
mock.timers.reset()

// 저장·최근 본·지역별(급구) 화면은 같은 JobsContext 목록을 쓴다 — 화면마다 마감 비교를 따로 하지 않는다.
const ctx = readFileSync(new URL('../context/JobsContext.tsx', import.meta.url), 'utf8')
assert(/filterOpenJobs\(jobs, today\)/.test(ctx) && /useTodayVn\(\)/.test(ctx), 'JobsContext가 오늘 날짜를 구독해 마감 공고를 거름')
for (const page of ['UrgentJobsPage', 'SavedJobsPage', 'RecentlyViewedPage']) {
  const src = readFileSync(new URL(`../pages/jobsMenu/${page}.tsx`, import.meta.url), 'utf8')
  assert(!/applicationDeadline\s*(>=|<=|>|<)\s*|isJobOpen\(/.test(src), `${page}: 마감 비교를 따로 하지 않음(JobsContext 한 곳)`)
}
console.log('todayVnStore: midnight rollover, unsubscribe, single filter point passed')
