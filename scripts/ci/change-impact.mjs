// 변경 영향 범위 판정(3순위, Lee 2026-11-24: "기존 검사를 변경 영향 범위에 필요한 것만 적용, 중복은 통합").
// PR의 바뀐 파일 목록 → 실제 화면 검사(app-screen-check.yml)에서 어떤 기존 검사를 돌릴지. 새 검사를 만들지 않고, 이미 있는 검사를 고르기만 한다.
//   screen : 앱 화면·서버·검사 도구에 닿는 변경 → 기존 화면 검사 전부(지금과 같음)
//   map    : 위치·핀·지도 캐시·공개 위치 응답에 닿는 변경 → 기존 HEAD 격리 핀 검사(location-canonical-browser-fixtures)를 PR 단계에서도
//   menu   : 메인 목록·메뉴 검색에 닿는 변경 → 기존 메뉴 검색 검사(menu-search-check)를 PR 단계에서도
// 예전에는 map·menu 검사를 브랜치 이름(demo/map-summary…, fix/menu-full-search…)으로 골랐다 — 같은 일을 파일 기준 한 곳으로 합친다.
// 닫힌 방향: 목록을 못 받거나 비었으면 전부 돌린다. screen을 끄는 것은 아래 '화면과 무관' 목록에만 맞는 파일뿐일 때다.
// 분류되지 않은 파일(화면과 무관·지도·메뉴 어디에도 안 맞음)은 영향을 모르는 것이므로 화면·지도·메뉴 검사를 모두 돌린다(Lee 2026-11-24).
// 워크플로는 이 판정기를 PR 사본이 아니라 BASE(master) 사본으로 돌린다 — PR이 판정기를 고쳐 자기 검사를 끄지 못하게.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

// 화면과 무관(앱 빌드·실행·화면 검사 도구에 쓰이지 않음). 화면 도면(docs/decisions/drawings)은 화면 검사가 읽으므로 제외.
const NO_SCREEN = [
  /^(?!docs\/decisions\/drawings\/).*\.md$/,
  /^crawler\//,
  /^supabase\/tests\//,
  /^supabase\/pending\//,
  /^scripts\/ci\//,
  /^scripts\/status\//,
  /^\.claude\//,
  /^\.github\/(?!workflows\/app-screen-check\.ya?ml$)/,
  /^docs\/(?!decisions\/drawings\/)/,
]
// 위치·핀·지도 캐시·공개 위치 응답(DB 변경은 공개 응답에 닿을 수 있어 포함)
const MAP = [
  /^src\/lib\/(jobCoords|directionsPlan|mapR1|mapSummary|mapPlace|mapPushPin|homeMap\w*|screenAudit|jobRows)\.tsx?$/,
  /^src\/components\/(JobLocationMap|JobVietMap|MapView)\.tsx$/,
  /^src\/components\/home\/[^/]*[Mm]ap[^/]*$/,
  /^api\/(map-locations|_map-r1)[^/]*$/,
  /^scripts\/ops\/(map-summary-check|location-point-oracle)\.mjs$/,
  /^supabase\/migrations\//,
]
// 메인 목록·메뉴 검색
const MENU = [
  /^src\/lib\/(jobSearch|jobSearchMenu|homeDiscovery|homeMapFilters|representativeSearchPages|jobQualityFilter)\.tsx?$/,
  /^src\/pages\/(Home|HomeDesktop|HomeMobile|JobSearchPage)\.tsx$/,
  /^src\/pages\/jobsMenu\//,
  /^src\/components\/home\//,
  /^scripts\/ops\/menu-search-check\.mjs$/,
]
const hit = (rules, f) => rules.some((r) => r.test(f))

/** 바뀐 파일 목록(null = 못 받음) → 영향 범위. 이유는 근거 파일(최대 5개). */
export function changeImpact(files) {
  if (!Array.isArray(files) || files.length === 0) return { screen: true, map: true, menu: true, reason: '바뀐 파일 목록 없음 — 전부 실행' }
  const screenFiles = files.filter((f) => !hit(NO_SCREEN, f))
  const mapFiles = files.filter((f) => hit(MAP, f))
  const menuFiles = files.filter((f) => hit(MENU, f))
  const unknownFiles = screenFiles.filter((f) => !hit(MAP, f) && !hit(MENU, f))
  const unknown = unknownFiles.length > 0
  return {
    screen: screenFiles.length > 0, map: mapFiles.length > 0 || unknown, menu: menuFiles.length > 0 || unknown,
    reason: [`화면 ${screenFiles.slice(0, 5).join(', ') || '없음'}`, `지도 ${mapFiles.slice(0, 5).join(', ') || '없음'}`, `메뉴 ${menuFiles.slice(0, 5).join(', ') || '없음'}`, `미분류(전부 실행) ${unknownFiles.slice(0, 5).join(', ') || '없음'}`].join(' / '),
  }
}

// CLI: node change-impact.mjs <BASE_SHA> <HEAD_SHA> → GITHUB_OUTPUT에 screen·map·menu, 요약에 근거. git이 실패하면 전부 실행.
if (process.argv[1]?.endsWith('change-impact.mjs')) {
  let files = null
  try { files = execFileSync('git', ['diff', '--name-only', process.argv[2], process.argv[3], '--'], { encoding: 'utf8' }).split('\n').filter(Boolean) } catch { files = null }
  const r = changeImpact(files)
  const out = `screen=${r.screen}\nmap=${r.map}\nmenu=${r.menu}\n`
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, out); else process.stdout.write(out)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### 변경 영향 범위\n- 화면 검사 ${r.screen ? '실행' : '생략(화면과 무관한 파일만)'} · 격리 핀 검사 ${r.map ? '실행' : '해당 없음'} · 메뉴 검색 검사 ${r.menu ? '실행' : '해당 없음'}\n- 근거: ${r.reason}\n`)
  console.log(r.reason)
}
