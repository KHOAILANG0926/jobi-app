# Claude 실행 인계 — 알바몬 기준 상세모집요강 편집기

## 요청과 현재 결과

최신 사용자 요청: 알바몬의 편집 흐름을 참고하되 100% 같은 외형은 피하고, 디자인을 조금 수정한다.
현재 기준은 JOBI 청록색/둥근 탭과 패널/사각 컬러칩/본문 왼쪽 브랜드·밑줄 제목이다. 이전 주황색 데모로 되돌리지 않는다.
현재 작업 중인 큰 작업을 마친 후 이 문서 순서대로 연결한다. 데모를 다시 개발하거나 사용자가 파일을 옮기게 하지 않는다.
이 문서는 **독립 데모를 실제 앱에 연결하는 인계**다. 운영 기능이 완성됐다는 뜻이 아니다.

- 저장소: `KHOAILANG0926/jobi-app`
- 구현 브랜치: `demo/albamon-editor`
- 소스 고정 커밋: `09eaf1d89be7b50daf9dec2cfeb610a82d3ea998`
- 최신 데모: `https://jobi-nr3gnlsnl-mshw1895-6089s-projects.vercel.app/demos/albamon-editor/index.html`
- 최신 배포 `dpl_HK8DfWeufucUpjyDMoX8KJwUZHYS`: 고정 커밋과 일치하는 READY, HTTP 200, 새 테마/탭/청록색 코드 반영 직접 확인. 이전 주황색 배포는 사용하지 않는다.
- 데모는 6개 자체 배치/12색이며, 알바몬 원본 78개 템플릿이나 원본 사진·로고를 복제한 것은 아니다.

## 1. 현재 작업을 보존하고 필요한 파일만 가져온다

자신의 AGENTS/CLAUDE/RULES와 현재 git status를 먼저 확인한다. 진행 중인 변경을 stash/reset/checkout으로 치우지 않는다.
별도 브랜치/워크트리에서 현재 앱의 최신 기준을 유지하고 아래 파일 **3개만** 가져온다.
`CHATGPT_HANDOFF.md`와 `WORK_LOG.md`는 가져오지 않는다. 데모 브랜치 전체 merge/cherry-pick도 하지 않는다.

```sh
git fetch origin demo/albamon-editor
# 아래 경로가 현재 작업에서 이미 수정됐으면 먼저 diff를 비교하고 기존 변경을 보존한다.
git restore --source=09eaf1d89be7b50daf9dec2cfeb610a82d3ea998 -- \
  public/demos/albamon-editor/index.html \
  public/demos/albamon-editor/README.md \
  scripts/demo/albamon-editor.browser.mjs
```

데모 HTML은 CSS/JS/SVG가 한 파일에 들어 있어 외부 패키지·이미지 다운로드 없이 열린다.
구현 코드의 `initial`, `templateView`, `generatedHTML`, `sanitize`, `render`, `window.JobEditor`를 읽는다.

## 2. 화면 연결

- 기존 React 18/TypeScript/Vite 구조를 유지한다. 새 앱/새 디자인 시스템을 만들지 않는다.
- `PostJob.tsx`의 마지막 `Mô tả công việc` 섹션이 입력 연결 위치다. 기존 상단 근무조건·모집조건·위치 입력과 인증/등록 절차를 보존한다.
- 데모에서 재사용할 화면: 상단 간편 템플릿/에디터/직접입력, 좌측 템플릿/색상/항목, 우측 직접 입력, PC/모바일 미리보기.
- 한국어 UI 문구를 베트남어로 바꾸되 배치/간격/기능 흐름은 유지한다. 기존 앱의 회사명·제목은 편집기와 중복된 서로 다른 값이 되지 않도록 한 상태로 연결한다.
- React 컴포넌트로 분리하되 제목/표 등의 입력 중 DOM 재생성으로 커서가 사라지지 않게 한다. 데모 자체는 입력 이벤트에서 전체 render를 하지 않는다.
- 기존 데이터가 없는 공고를 자동으로 새 템플릿으로 재작성하지 않는다. 기존 description만 있는 공고는 기존 표시를 유지한다.

### 재사용 가능한 문서 계약

```ts
type EditorDocument = {
  version: 1
  template: number
  color: string
  showLogo: boolean
  company: string
  title: string
  intro: string
  roleHead: string
  dutyHead: string
  roles: { name: string; duties: string }[]
  sections: ('roles' | 'conditions' | 'eligibility' | 'application' | 'contact')[]
  bodies: { conditions: string; eligibility: string; application: string; contact: string }
  custom: { title: string; body: string }[]
  richHTML: string | null
  activeMode: 'template' | 'editor' | 'direct'
}
```

데모에서 `window.JobEditor.getDocument()`, `.setDocument(doc)`, `.getHTML()`로 시험할 수 있다.
변경 이벤트는 같은 document의 `job-editor:change`이며 event.detail은 정제된 JSON 사본이다.
실제 React 연결에서는 `value/onChange` 방식으로 문서와 현재 모드의 안전한 HTML을 가져온다.

**탭 규칙:** 템플릿 JSON과 자유 편집 HTML은 별개 초안으로 보존한다. 에디터 내부 HTML모드와 직접입력 탭은 같은 HTML 초안을 공유한다.
자유 HTML을 구조화 템플릿으로 자동 역변환하지 않는다. `현재 템플릿으로 다시 가져오기`는 확인 후 자유 편집 내용을 교체한다.
사용자가 항목을 숨겨도 값은 보존하고, 저장 후 다시 열면 template/color/activeMode/표/숨긴 항목을 모두 복원한다.

## 3. 등록·수정·읽기·상세를 한 묶음으로 연결

아래 경로는 고정 커밋에서 직접 확인했다. Claude의 작업이 끝난 시점의 최신 코드와 다시 대조한다.

| 경로 | 현재 동작 / 연결할 것 |
|---|---|
| `src/types/job.ts` | `description: string`. 편집 문서/안전 HTML의 선택 필드를 타입에 추가할 때 기존 공고와 호환 유지 |
| `src/pages/PostJob.tsx` | `composeDescription(...)` → `baseFields.description`. 제목/회사명과 문서 상태 연결, 저장 중/오류/성공 처리 |
| `src/lib/postJobForm.ts` | `composeDescription()`은 텍스트와 기존 소제목 생성. HTML로 덮어쓰지 않음 |
| `src/context/JobsContext.tsx` | `addPostedJob()` → `checkedPublicJobInsert()`. `JOB_INSERT_RETURN_COLUMNS`와 insert payload, `updateJob()`의 payload 모두 확인 |
| `src/lib/jobPolicyWrite.ts` | 신규는 checked insert/단일 ingest 입구, 수정도 기존 검사 경유. 직접 local_jobs insert로 우회 금지 |
| `src/lib/jobRows.ts` | `rowToJob()`, `EMPLOYER_JOBS_SELECT_COLUMNS` 등 읽기 mapper/열 목록 확인 |
| `src/lib/fetchJobsData.ts` | 목록/상세 fetch 경로에 새 필드가 필요한지 확인. 큰 HTML을 목록 전체로 전송할 필요는 없음 |
| `src/pages/ManageGuestJob.tsx` | `get_guest_job` 조회와 `checkedGuestJobUpdate` 수정. 게스트 관리 토큰을 일반 조회/문서 안에 노출하지 않음 |
| `src/pages/JobDetail.tsx` | `showDescriptionSection`, `visibleTabs`, 상세요강 section 렌더링에 문서 존재도 반영. 위쪽 승인된 틀은 보존 |
| `api/ssr.js` | JSON-LD/검색 요약은 기존 순수 텍스트 description 유지. HTML을 메타태그에 넣지 않음 |

**데이터 원칙:** `description`은 기존 직종/정책/상세 파서가 쓰는 순수 텍스트다. HTML·JSON을 여기에 직렬화하거나 임의 숨김 구분자로 끼워 넣지 않는다.
편집기의 현재 표시 문서에서 유도한 순수 텍스트를 기존 소제목 계약에 맞춰 만든다. 자유 편집 탭에서 수정한 내용이 오래된 템플릿 텍스트와 어긋난 채 게시되지 않게 한다.
새 문서/HTML 저장을 위한 기존 필드나 승인된 경로가 있는지 먼저 확인한다. 없으면 nullable 문서 저장 설계와 dry-run SQL/production_check를 준비한다.
**이 사용자의 진행 지시는 신규 DB DDL 승인으로 간주하지 않는다.** 저장소 규칙대로 구체적인 DB 변경안을 준비한 다음 필요한 승인만 한 번 요청한다. 운영 DB 직접 SQL 금지.

**표시 원칙:** 새 문서가 있는 공고에만 상세요강 본문으로 렌더링한다. 같은 내용을 기존 텍스트 상세요강과 두 번 보여주지 않는다.
이전 공고는 기존 fallback을 유지한다. 이미지 갤러리는 보존한다. 제목·상단 카드·급여·근무조건·모집조건·지도 틀은 변경하지 않는다.

## 4. 보안과 한계

- 브라우저 정제는 데모 방어다. 실제 저장은 신뢰 가능한 서버에서도 동일한 허용 목록으로 정제한다.
- HTML/붙여넣기의 script/onerror/javascript:/iframe/object/svg/외부 CSS를 제거한다. 스타일이 부모 화면에 영향을 주지 않게 격리한다.
- 데모 미리보기는 sandbox iframe + CSP를 사용한다. 그대로 유지한다.
- 데모는 `document.execCommand`를 쓰는 기본 에디터이며 브라우저별 IME/선택 영역/실행 취소 검증이 필요하다. 기존 앱에 검증된 에디터가 있으면 같은 화면 구성에 활용하되 새 디자인으로 바꾸지 않는다.
- 데모에는 서버 저장/자동저장/실제 이미지 업로드가 없다. 새로고침하면 입력이 사라진다. 이를 실제 앱 기능으로 보고하지 않는다.
- 데모 `generatedHTML`은 편집 UI 전체 CSS를 그대로 복제한 렌더러가 아니다. 실제 게시 전 선택한 배치의 PC·모바일 출력이 편집 화면과 일치하도록 공통 renderer를 사용하고 비교한다.

## 5. 완료 검사 — 이것까지 한 번에

- [ ] 신규 공고: 템플릿/색상/표/항목 입력 → 저장 → 상세 표시 → 다시 열어 같은 값 복원.
- [ ] 기존 공고: description만 있는 공고는 기존 틀/글/지도/이미지 그대로.
- [ ] 수정: 회사명/제목 동기화, 숨김/복구, 행 추가/삭제, 자유 HTML 탭 왕복에도 내용 보존.
- [ ] 로그인 고용주와 게스트 관리 경로 모두 저장/권한/실패 처리를 검증. 타인 수정 불가.
- [ ] PC/390px에서 편집/미리보기/실제 상세 비교. 긴 글·긴 단어·빈 값·이미지 실패에도 바깥 가로 넘침 없음.
- [ ] HTML 주입과 CSS 부모 침범 차단, 서버 정제, 순수 텍스트 정책 검사와 SSR 유지.
- [ ] `npx tsc --noEmit`, `npm run build`, 영향 테스트 및 필수 CI. 동일 SHA의 이미 성공한 무관 테스트를 반복하지 않음.
- [ ] 승인된 배포 절차와 실제 운영 화면 확인까지 끝낸 후에만 운영 적용 완료로 보고.

### 데모 기능 재현 검사

```sh
# 터미널 1: 프로젝트 루트의 정적 HTTP 서버
python3 -m http.server 8093 --bind 127.0.0.1
# 터미널 2: 테스트 전용 Chrome 프로필 (사용자의 실제 브라우저 프로필 사용 금지)
chromium --headless --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222 --user-data-dir=/tmp/jobi-editor-chrome about:blank
# 터미널 3: Node 22+ (global WebSocket 필요)
node scripts/demo/albamon-editor.browser.mjs
```

`CDP_URL`, `EDITOR_URL`, `EDITOR_SCREENSHOT_DIR` 환경변수로 포트/페이지/캡처 경로를 지정할 수 있다.
원격 미리보기 접근은 환경 네트워크 정책/배포 보호를 따라야 하며 테스트가 이를 자동 우회하지 않는다.

## Codex가 이미 확인한 검사

- 브라우저: 템플릿 변경 후 입력 유지, 색상/행/항목, rich/HTML 왕복, HTML 주입 제거, sandbox, 390px 가로 넘침, JSON API 복원 통과.
- `npx tsc --noEmit` / `npm run build` 통과. 원격 Actions 배포 빌드도 통과.
- 전체 `npm test`: 113/114. `_ingest-one-door-guard.test.ts`에서 sandbox `spawnSync git EPERM`; 해당 파일만 허용된 실행 환경에서 재실행하여 732개 파일 검사 통과. 전체 suite 114/114를 한 번에 통과했다고 주장하지 않음.
- 운영 DB/공고/기존 앱 화면 변경 없음. 데모는 별도 브랜치에서만 배포.
