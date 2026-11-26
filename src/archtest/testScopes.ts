// 시험 실행 범위(구조 정리 5번, 대표 지시 2026-11-25): "전용 코드 변경은 해당 영역 중심으로, 공통 코드 변경은 웹·앱 양쪽을".
// scripts/run-tests.mjs가 이 규칙으로 `--scope=app|web|shared`와 `--changed`를 처리한다. 기본(`npm test`)은 전부 돌리며 바뀌지 않았다.
// 필수 CI(PR 검사)는 이 범위 선택을 쓰지 않고 기존처럼 전부 돌린다 — 이 도구는 개발·작업 창이 빠르게 확인하는 용도이고 필수 검사를 약화하지 않는다.
export type TestScope = 'app' | 'web' | 'shared'

const APP = [/^src\/app\//, /^app\.html$/, /^vite\.app\.config\.mjs$/]
const WEB = [/^src\/(?:pages|components)\//, /^src\/(?:App|main|entry-server)\.tsx$/, /^src\/index\.css$/, /^index\.html$/]
const SHARED = [/^src\/(?:lib|data|types|context|archtest)\//, /^api\//]
// 경계·계층 시험: 앱·웹이 서로·공통 계층에 대해 지켜야 할 규칙이라 어느 범위로 돌려도 함께 돌린다(가볍다).
const ALWAYS = [/^src\/app\/boundary\.test\.ts$/, /^src\/archtest\/[^/]+\.test\.ts$/]

const any = (rules: RegExp[], p: string) => rules.some((r) => r.test(p))

/** 시험 파일 하나가 속한 범위(경로 기준). 어디에도 안 맞으면 null — 범위 선택에서는 항상 돌린다(닫힌 방향). */
export function scopeOfTest(path: string): TestScope | null {
  if (any(APP, path)) return 'app'
  if (any(WEB, path)) return 'web'
  if (any(SHARED, path)) return 'shared'
  return null
}
export const isAlwaysTest = (path: string): boolean => any(ALWAYS, path)

/** 범위 `scope`를 돌릴 때 이 시험 파일을 돌려야 하는가. 'all'은 전부. */
export function includeTest(path: string, scope: TestScope | 'all'): boolean {
  if (scope === 'all') return true
  const s = scopeOfTest(path)
  return s === null || s === scope || isAlwaysTest(path)
}

/** 바뀐 파일 목록 → 돌려야 할 범위. 앱·웹 전용 파일만 바뀌었을 때만 그 범위로 줄이고, 공통(lib·data·types·context·archtest·api)이 하나라도 있거나
 *  어디에도 안 맞는 파일(문서·워크플로·크롤러 등)이 있거나 목록이 비면 전부(웹·앱 양쪽)다 — 모르면 넓게. */
export function scopesForChanges(files: string[]): Array<TestScope> | 'all' {
  if (files.length === 0) return 'all'
  const found = new Set<TestScope>()
  for (const f of files) {
    if (any(APP, f)) found.add('app')
    else if (any(WEB, f)) found.add('web')
    else return 'all'
  }
  return [...found]
}
