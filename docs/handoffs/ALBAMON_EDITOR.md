# Claude 실행 인계 — 알바몬 기준 상세모집요강 편집기

## 요청과 현재 결과

**최신 사용자 지시가 이전 디자인 지시보다 우선한다.**

PC·휴대폰을 알바몬 원본 화면과 같은 구조/배치/동작으로 먼저 맞춘다. 추가 디자인 변경은 그 뒤 사용자가 지정한 부분만 한다.
Codex가 임의로 만든 오른쪽 설정 패널·2열 갤러리·청록색 테마·6종 자체 그림은 **승인된 디자인이 아니다.** 이를 그대로 앱에 연결하지 않는다.
기존 데모는 입력 보존/문서 계약/정제/미리보기 기능 코드의 참고자료로만 사용한다. 원본과 동일하게 완성됐다고 보고하지 않는다.

### 원본 확인 상태

- PC: 사용자 제공 화면에서 3개 가로 탭(간편! 템플릿/에디터/직접입력), 왼쪽 설정 패널, 오른쪽 편집 본문을 확인했다.
- PC 템플릿: 가로로 긴 이미지 썸네일이 세로 1열로 나열된다. 2열 정사각 카드/클래식·북스 등 임의 분류로 대체하지 않는다.
- PC 설정: 템플릿 전체보기/페이지 표시, 원형 컬러칩, 항목 추가·선택·삭제, PC/Mobile 미리보기.
- 본문: 회사명/공고 제목/큰 이미지, 회사소개, 모집부문 표, 근무조건 등의 순서. 사용자 제공 원본의 간격/크기/입력 동작을 비교한다.
- 휴대폰: 원본 편집 화면 및 모바일 공고 미리보기를 아직 직접 확인하지 못했다. 임의로 2열·3열 갤러리나 세로 스택을 설계해 동일하다고 주장하지 않는다.
- 공개 검색으로 공식 3개 탭 안내는 확인했지만, 기업회원 편집기/모바일의 세부 화면과 동작은 확인하지 못했다. 원본을 볼 수 있는 자료가 확보되면 비교해서 확정한다.

기술 연결은 아래 지도를 활용하되, 화면 기준이 확보되지 않은 부분은 추측 구현하지 않는다.

- 저장소: `KHOAILANG0926/jobi-app`
- 구현 브랜치: `demo/albamon-editor`
- 소스 고정 커밋: `d3287c209a1a61d3f51f05075633b0ebf098c527`
- 최신 데모: `https://jobi-hj5chr2i5-mshw1895-6089s-projects.vercel.app/demos/albamon-editor/index.html`
- 최신 배포 `dpl_FCztGVLGDThn4WDBgDA7kv6gJrSC`: 고정 커밋과 일치하는 READY, HTTP 200, 6종 개별 삽화/공통 renderer/본문 카드 보존 코드 반영 직접 확인. 이전 주황색 배포는 사용하지 않는다.
- 이 데모는 자체 그림 6종을 사용한 시제품이다. 알바몬 PC·휴대폰 동일 구현본이 아니며, 최신 사용자 지시의 디자인 기준으로 쓰지 않는다.

## 1. 기존 데모 기능 코드를 참고할 때 가져올 파일

자신의 AGENTS/CLAUDE/RULES와 현재 git status를 먼저 확인한다. 진행 중인 변경을 stash/reset/checkout으로 치우지 않는다.
별도 브랜치/워크트리에서 현재 앱의 최신 기준을 유지하고 아래 파일 **3개만** 가져온다.
`CHATGPT_HANDOFF.md`와 `WORK_LOG.md`는 가져오지 않는다. 데모 브랜치 전체 merge/cherry-pick도 하지 않는다.

```sh
git fetch origin demo/albamon-editor
# 아래 경로가 현재 작업에서 이미 수정됐으면 먼저 diff를 비교하고 기존 변경을 보존한다.
git restore --source=d3287c209a1a61d3f51f05075633b0ebf098c527 -- \
  public/demos/albamon-editor/index.html \
  public/demos/albamon-editor/README.md \
  scripts/demo/albamon-editor.browser.mjs
```

데모 HTML은 CSS/JS/SVG가 한 파일에 들어 있어 외부 패키지·이미지 다운로드 없이 열린다.
구현 코드의 `initial`, `templateNames/templateStyles`, `artworkSVGs/imageURIs`, `heroHTML`, `renderDocument`, `sanitize`, `window.JobEditor`를 읽는다.
썸네일은 heroHTML의 축소본, 편집/HTML/미리보기는 renderDocument(editable) 한 코드 경로다. 별도의 renderer를 다시 만들지 않는다.
6종은 클래식(강사), 보드(칠판), 북스(책), 온라인(노트북), 노트(공책), 클래스(두 사람)로 모두 다른 SVG를 포함한다.

## 2. 화면 연결

- 기존 React 18/TypeScript/Vite 구조를 유지한다. 새 앱/새 디자인 시스템을 만들지 않는다.
- `PostJob.tsx`의 마지막 `Mô tả công việc` 섹션이 입력 연결 위치다. 기존 상단 근무조건·모집조건·위치 입력과 인증/등록 절차를 보존한다.
- 시각 기준은 사용자 제공 알바몬 원본이다. 데모의 오른쪽 설정/2열 갤러리/자체 삽화 배치는 재사용하지 않는다. 탭 전환·입력 보존·항목 편집·정제·미리보기 기능만 참고한다.
- 앱 연결 시 필요한 베트남어 문구를 적용하되 원본으로 확정한 배치/간격/기능 흐름을 유지한다. 기존 앱의 회사명·제목은 편집기와 중복된 서로 다른 값이 되지 않도록 한 상태로 연결한다.
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
- 그림과 본문이 어긋나는 문제가 수정되었다. `heroHTML`/`renderDocument`를 재사용해 6종 그림/배경/배치의 일치를 유지한다. 편집용 입력칸/삭제 버튼은 출력에서 빠지는 것이 정상이다.
- SVG data URI는 내장된 `imageURIs` 여섯 개만 허용한다. 입력 HTML의 임의 SVG나 임의 data URL까지 허용하지 않는다.

## 5. 완료 검사 — 원본 비교를 포함해 한 번에

- [ ] 알바몬 PC 원본과 템플릿 목록/탭/설정 위치/본문/버튼/색상·크기를 나란히 비교.
- [ ] 휴대폰 원본을 확보해 편집 화면과 공고 미리보기를 같은 화면 폭에서 비교. 확인하지 않은 상태를 동일 구현 완료로 보고하지 않음.
- [ ] 신규 공고: 템플릿/색상/표/항목 입력 → 저장 → 상세 표시 → 다시 열어 같은 값 복원.
- [ ] 기존 공고: description만 있는 공고는 기존 틀/글/지도/이미지 그대로.
- [ ] 수정: 회사명/제목 동기화, 숨김/복구, 행 추가/삭제, 자유 HTML 탭 왕복에도 내용 보존.
- [ ] 로그인 고용주와 게스트 관리 경로 모두 저장/권한/실패 처리를 검증. 타인 수정 불가.
- [ ] 6종 각각 썸네일/편집/미리보기 그림과 배경/배치가 일치하고 그림이 로딩되는지 검사.
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

- 브라우저: 6종 삽화 중복 없음, 썸네일/본문/출력 이미지 일치/로딩, 6종 배경/배치/본문 카드 유지 일치, 모두 390px 폭 유지, 입력 보존, 색상/행/항목, rich/HTML 왕복, HTML 주입 제거, sandbox, JSON 복원 통과. 캐시를 끄고 현재 소스를 검사한다.
- `npx tsc --noEmit` / `npm run build` 통과. 원격 Actions 배포 빌드도 통과.
- 전체 `npm test`: 113/114. `_ingest-one-door-guard.test.ts`에서 sandbox `spawnSync git EPERM`; 해당 파일만 허용된 실행 환경에서 재실행하여 732개 파일 검사 통과. 전체 suite 114/114를 한 번에 통과했다고 주장하지 않음.
- 운영 DB/공고/기존 앱 화면 변경 없음. 데모는 별도 브랜치에서만 배포.
