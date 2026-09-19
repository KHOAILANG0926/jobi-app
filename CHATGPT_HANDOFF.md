# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

**"Gần tôi" 결과를 지도+핀으로 표시(2026-09-20, "다음 결정사항 17번"을
같은 세션에 바로 착수)**: "다음 세션에 하자"고 문서에 남겨둔 직후 사용자가
"그냥 지금 시작하자"로 바로 진행 지시 — 1차 버전(검색창+지도+핀, 핀↔카드
양방향 하이라이트 연동은 다음 단계로 보류)으로 구현.
- [JobLocationMap.tsx](src/components/JobLocationMap.tsx): `JobLocationMapMarker`에
  `href?: string` 추가 — 있으면 팝업을 `bindPopup(문자열)` 대신 DOM으로
  직접 조립(`document.createElement('a')` + `textContent`)해서 클릭하면
  그 공고 상세페이지로 이동. **XSS 주의**: label(공고 제목 등 employer
  입력값)을 그대로 HTML 문자열에 꽂지 않고 `textContent`로만 넣어 안전하게
  처리 — href 없을 땐 기존 동작(문자열 그대로 `bindPopup`) 완전히 그대로 유지.
- [Home.tsx](src/pages/Home.tsx): `JobLocationMap`을 `lazy()`로 지연
  로딩(Home은 모든 방문자가 거치는 페이지라 Leaflet 148KB를 "Gần tôi"
  실제 사용 시에만 불러오게 함, JobDetail.tsx는 거의 항상 지도를 쓰므로
  그쪽은 즉시 import 그대로 유지). `nearMe && userCoords && filtered.length
  > 0`일 때 결과 리스트 위에 지도 렌더 — `extraMarkers`에 내 위치(반투명
  원, `precise:false`로 공고 핀과 시각적 구분) + `filtered`의 좌표 있는
  공고 전부(`href: /viec-lam/{id}`)를 같이 넣음. 좌표 없는 공고는 지도
  핀에서만 빠지고 리스트에는 그대로 남음(filtered 자체는 안 건드림).
- 새 CSS `.near-me-map`/`.near-me-map__loading`([index.css](src/index.css))
  — 결과용 지도는 공고 상세페이지 지도(220px)보다 크게(320px, 핀 여러 개
  한눈에 보이게).
- `npx tsc --noEmit` 클린, `npm run build` 성공(lazy chunk 분리 확인),
  `npm test` 6/6 파일 통과. **로컬 dev엔 Geoapify 키가 없어 실제 지도
  렌더/핀 클릭까지는 로컬에서 검증 못 함**(페이지 로드 자체엔 새 콘솔
  에러 없음만 확인) — Production 배포 후 실제 핀 클릭→공고 이동까지
  반드시 재확인 필요(다음 최우선 확인 항목).
- **남은 것(핀↔카드 양방향 하이라이트)**: 이번엔 핀 클릭 시 팝업의 링크로
  공고 상세로 "이동"만 되고, 리스트 카드 쪽에서 지도 핀을 하이라이트하거나
  그 반대(핀 hover 시 카드 강조)는 아직 없음 — 필요하면 다음에 추가.

**"Gần tôi" 위치 확인 문구 + 주소 직접 검색 추가(2026-09-20, 여러 라운드
대화 끝에 확정)**: "Dùng vị trí hiện tại" 버튼이 "한 번에 안 눌린다"는
제보를 조사하다가(로딩 상태 없어서 그런 것으로 결론, 아래 절에서 이미
`locating` state로 수정) 사용자가 더 근본적인 질문 제기 — "현재위치면
가입자한테 내가 어디 있냐고 물어봐야 하는거 아니야?" → "GANTOI가 필요한
기능인가 의문" → "공고는 금방 쌓을 수 있다"(밀도 문제로 기능을 없앨
이유는 아님) → "핸드폰이나 PC로 위치 공유하면 바로 인근 일자리 찾아줄
수 있어?"(이미 됨, calcDistanceKm 기반 반경 필터는 기존에 있었음) →
최종적으로 "1,3" 선택(AskUserQuestion): **주소 검색창 + GPS로 받은 좌표를
사람이 읽을 주소로 확인시켜주기**.
- 조사 결과 **이 프로젝트에 런타임 지오코딩(좌표↔주소 변환)이 전혀 없었음**
  확인(Explore 에이전트로 전체 코드베이스 조사) — 크롤러가 오프라인으로
  미리 계산해 DB에 저장한 값만 소비하는 구조였음. 지도 타일용
  `VITE_GEOAPIFY_API_KEY`([JobLocationMap.tsx](src/components/JobLocationMap.tsx))는
  이미 있어서, 같은 키로 Geoapify의 지오코딩 API도 재사용(새 키/공급자
  도입 없음).
- [src/lib/geoapify.ts](src/lib/geoapify.ts) 신규 — `reverseGeocode(lat,lng)`
  (좌표→"구/현, 성/시" 짧은 주소 문자열, 실패 시 null), `searchAddress(query)`
  (텍스트→좌표 후보 최대 5개, 베트남 내로 필터). 필드명(`results`/`formatted`/
  `lat`/`lon`/`suburb`/`district`/`county`/`city`/`state`)은 Geoapify
  공식 문서로 확인 후 작성(로컬 dev엔 키가 없어 실제 API 응답으로 직접
  검증은 못 함 — Production 배포 후 확인 필요).
- [Home.tsx](src/pages/Home.tsx): `nearAddressLabel`/`addressQuery`/
  `addressSearching`/`addressSuggestions`/`addressSearched` state 추가.
  GPS 성공 시 `reverseGeocode()` 호출해 "Đang tìm việc gần {주소}"로
  기존 "Vị trí hiện tại của bạn" 문구 교체(역지오코딩 실패해도 기존처럼
  좌표만으로 계속 동작 — 가짜 주소 안 만듦). `renderAddressSearch()`
  렌더 도우미 함수(컴포넌트 아님, Home() 클로저 상태 공유)로 prompt/error
  두 상태 블록에 동일한 주소 검색 폼(입력창+검색 버튼+제안 목록) 추가 —
  제안 클릭 시 GPS와 동일한 경로(`clearQuickFilters`→`setUserCoords`→
  `setNearMe(true)`)로 합류.
- 새 CSS `.near-me-address-search`/`.near-me-address-suggestions`
  ([index.css](src/index.css)) — 페이지 배경(카드 아님) 위에 놓이는
  요소라 다른 `.near-me-status__*`처럼 다크모드 오버라이드 없이 라이트
  톤 그대로(이 앱 다크모드는 페이지 배경 자체는 안 바뀌는 기존 패턴).
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일
  통과. 로컬 dev 서버로 검색창 렌더/입력/버튼 클릭/"Không tìm thấy" 빈
  결과 안내까지 확인(로컬은 키가 없어 실제 지오코딩 결과 자체는 미확인).
  **Production 배포 후 실제 주소 검색 결과가 나오는지 반드시 재확인
  필요**(다음 세션 최우선 확인 항목).

**Home.tsx 스크롤 이동이 고정 헤더에 가려지던 버그 수정(2026-09-20,
사용자가 "Gần tôi" 메뉴 클릭해보라고 지시 후 실사이트 스크린샷 5장으로
재현 경로 제시)**: "GAN TOI 눌러보고 연결상태가 이상하다"는 제보 →
직접 재현 시도했으나 처음엔 Claude 내장 브라우저가 위치 권한을 자동
거부해서 재현 실패 → 사용자가 실제 기기에서 찍은 스크린샷 5장(거리별
결과 없음, 10km 확장, 전체보기 복귀 등)을 보내 "1. 클릭하면 변화없음"
지적 → "Tìm việc theo khu vực thay vào đó"(위치 거부 시 대안 버튼)를
직접 클릭해 재현: 실제로는 스크롤이 발생하지만(`window.scrollY` 실측
확인), **목적지 섹션(지역 패널)의 맨 위(제목+실제 클릭할 지역명)가
`position: sticky` 고정 헤더 뒤에 가려져서** 사용자 눈에는 "아무 일도
안 일어난 것"처럼 보였던 것 — 모바일은 헤더가 3줄이라 ~200px로 더 심함.
- [Home.tsx](src/pages/Home.tsx): 새 헬퍼 `scrollToRefBelowHeader(el,
  behavior)` — 클릭 시점에 `.layout__header`의 실제 렌더 높이를
  `getBoundingClientRect()`로 측정해서 그만큼(+12px 여유) 띄운 위치로
  `window.scrollTo()` 직접 이동. 기존 CSS `scroll-margin-top` 고정값
  방식은 모바일(~200px)/데스크톱(~130px) 헤더 높이 차이 때문에 하나로
  못 맞춰서 대신 채택. 이 파일의 `scrollIntoView({block:'start'})` 호출
  5곳(`scrollToRegionPanel`/지역 결과 이동/급구 리스트 이동 3곳) 전부를
  이 헬퍼로 교체 — 하나만 고치지 않고 같은 패턴 전부 일괄 수정(사용자가
  이전에 "지적한 것만 보지 말고 같은 상황이면 전체 적용"이라고 강조한
  원칙 재적용). `block:'center'`인 `categorySelectRef` 스크롤 1곳은
  같은 결함 재현 확인을 못 해 손대지 않음.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일
  통과. 로컬 dev 서버로 모바일(375px)/데스크톱(1280px) 둘 다 확인 —
  모바일은 클릭 후 지역 패널 제목("Việc làm theo khu vực")과 지역명
  링크가 헤더 밑에 온전히 보임(수정 전엔 헤더에 가려 카테고리
  드롭다운만 보였음), 데스크톱은 헤더가 짧아 애초에 스크롤 자체가
  거의 필요 없어 정상 표시. 콘솔에 새 에러 없음.
- **디버깅 메모**: 자동화 브라우저 스크린샷 도구가 `smooth` 스크롤
  애니메이션 도중이나 경쟁 상태에서 간헐적으로 스크롤 전 상태를 캡처하는
  현상을 겪음(`window.scrollY` 실측값은 이미 바뀌었는데 스크린샷은 이전
  화면) — 이런 경우 스크린샷만 믿지 말고 `window.scrollY`/
  `getBoundingClientRect()` 실측치로 교차 확인할 것.

**로그인 화면에도 비밀번호 확인란 추가(2026-09-20, 바로 아래 절 작업
직후)**: 로그인/회원가입 비밀번호 확인란을 만들고 나서 사용자가 로그인
화면 스크린샷을 다시 보여주며 "확인란은 없는데?"로 재지적 — 처음엔
"로그인은 기존 계정에 들어가는 거라 확인란이 개념상 불필요하다"고
판단해 회원가입에만 넣었는데, 사용자가 "비밀번호 입력하는 것에는(=
어디든) 추가 확인란 넣어달라고 얘기했다"고 명확히 정정 — 로그인 포함
비밀번호 입력칸이 있는 곳 전부에 확인란을 넣으라는 뜻이었음.
- [Login.tsx](src/pages/Login.tsx): `confirmPassword` state + 두 번째
  `PasswordField`("Xác nhận mật khẩu") 추가, 제출 시 `password !==
  confirmPassword`면 "Mật khẩu xác nhận không khớp."로 막음(Signup.tsx와
  동일한 검증 패턴).
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일
  통과. 로컬 dev 서버로 로그인 화면에 "Xác nhận mật khẩu" 필드 정상
  렌더 확인.
- **교훈**: 사용자가 같은 지적을 화면 캡처로 두 번 반복했을 땐 "이미
  판단해서 스킵한 이유"를 다시 설명하기보다, 범위를 더 넓게 해석해서
  물어봐야 했음(이번엔 다행히 사용자가 직접 정정해줘서 빠르게 확인됨).

**로그인/회원가입 비밀번호 UX 개선(2026-09-20, 사용자가 로그인 화면
스크린샷으로 직접 지적)**: "비밀번호 숨김 표시만 있으면 내가 뭘 썼는지
모른다" + "비밀번호 확인란이 더 있어야 한다"는 지적. 수정 전에 "지적한
화면만 보지 말고 같은 상황이면 전체 적용"하라는 지시에 따라 프로젝트
전체에서 `type="password"` 입력칸을 전수 검색 — Login.tsx/Signup.tsx
**두 곳뿐**(비밀번호 변경 등 다른 화면 자체가 없음)임을 확인하고 이해한
내용을 먼저 사용자에게 설명해 확인받은 뒤 진행.
- [src/components/PasswordField.tsx](src/components/PasswordField.tsx)
  신규 — 보기/숨기기 토글(눈 아이콘, lucide-react Eye/EyeOff) 달린 비밀번호
  입력 공용 컴포넌트. 로그인 1개, 회원가입 2개(비밀번호+확인) 총 3곳에서
  중복 없이 재사용.
- [Login.tsx](src/pages/Login.tsx): 기존 `<input type="password">`를
  `PasswordField`로 교체(토글만 추가, 확인란은 로그인 개념상 불필요 —
  이미 있는 계정으로 들어가는 화면이라 "확인" 대상이 없음).
- [Signup.tsx](src/pages/Signup.tsx): `PasswordField`로 교체 + **"Xác
  nhận mật khẩu"(비밀번호 확인) 필드 신규 추가**, `confirmPassword` state,
  제출 시 `password !== confirmPassword`면 "Mật khẩu xác nhận không
  khớp." 에러로 막음(필수 입력 체크에도 포함).
- 새 CSS `.password-field`/`.password-field__toggle`([index.css](src/index.css))
  — 입력칸 오른쪽에 눈 아이콘 겹쳐서 배치. 이 앱 폼 입력칸은 다크모드에서도
  항상 흰 배경이라(기존 `.field__input` 다크 오버라이드 없음, 확인함)
  토글 아이콘도 별도 다크모드 색 없이 라이트 톤 그대로 사용.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버로 로그인 화면 비밀번호 입력 후 토글 클릭 → 평문 노출
  확인, 회원가입 화면 비밀번호/확인란에 일부러 다른 값 입력 후 제출 →
  "Mật khẩu xác nhận không khớp." 에러 정상 표시 확인. 콘솔에 새 에러 없음.

**"Việc làm" 메가메뉴가 세로로 길게 늘어지던 버그 수정(2026-09-20, 사용자가
배포 직후 실사이트 스크린샷으로 지적)**: 바로 위 라운드에서 "Theo thời
gian"/"Theo điều kiện" 2개 열을 추가하며 `.mega-menu__inner`에
`flex-wrap: wrap`만 추가했는데, 실사이트에서 열어보니 한 줄에 2열씩만
배치되고 세로로 3줄까지 길게 늘어졌다("기존에 가로로 했는데 왜 세로로
길게 뻗었냐"로 지적받음). 원인은 `.mega-menu`가 `position: absolute`(좌표만
`left:0`, `width` 없음)라 flex-wrap 컨테이너의 shrink-to-fit 너비 계산을
브라우저가 실제 사용 가능한 공간 기준이 아니라 좁게(콘텐츠 낱개 기준과
비슷하게) 잡아버려, 넓은 화면에서도 필요 이상으로 일찍 줄바꿈됐던 것.
- [index.css](src/index.css) `.mega-menu__inner`에 `width: max-content`
  추가 — "줄바꿈 없이 다 폈을 때"의 실제 너비를 먼저 계산시키고, 기존
  `max-width: 92vw`는 그대로 둬서 진짜 좁은 화면에서만 줄바꿈되게 함.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버로 1440px(6열 한 줄에 다 배치)/1024px(4+2로 자연스럽게
  줄바꿈, 화면 밖으로 안 넘침) 둘 다 스크린샷 확인. 콘솔에 새 에러 없음
  (기존 404만).

**"Công cụ" 허브 페이지 신설(2026-09-20, 알바몬 6개 탭 전수조사 후 확정)**:
사용자가 "Công cụ만 그런 게 아니라 알바몬은 6개 탭 클릭하면 각자 전용
공간으로 들어가잖아, 그게 필요한 방향 아니냐"고 물어, 알바몬 6개 탭을
전부 직접 클릭해 확인함 — 채용정보→`/jobs/home`, 브랜드알바→`/jobs/brand`,
회원서비스→`/user-account/login`(비로그인 시), 인재정보→인재검색 페이지,
알바토크→`community.albamon.com`(별도 서브도메인), 고객센터→
`/service-center/qna/register`. **예외 없이 전부 실제 이동**했음을 확인.
다만 우리 사이트 규모상 6개 섹션 전부에 알바몬만큼 깊은 하위 페이지
구조를 지금 미리 만드는 건 과하다고 판단(콘텐츠 없는 빈 페이지만 늘어날
위험) — 사용자도 동의해 **"Công cụ" 하나만 먼저 채우고 나머지는 콘텐츠가
쌓이는 걸 보며 판단**하기로 확정.
- [src/pages/ToolsHub.tsx](src/pages/ToolsHub.tsx) 신규 — 기존 "Công cụ"
  드롭다운 4개 그룹(Hồ sơ xin việc/Hoạt động ứng tuyển/Công cụ việc làm/
  Tài khoản)을 카드 그리드로 보여주는 허브 페이지. 각 카드는 드롭다운에
  이미 있던 것과 동일한 링크(일부는 `/ho-so`로 가되 `state.openCvTab`/
  `openApplicationsTab`로 탭 지정 — Layout.tsx 드롭다운과 동일 패턴
  재사용, 새 데이터/로직 없음).
- [App.tsx](src/App.tsx)에 `/cong-cu` 라우트 추가(lazy load), [Layout.tsx](src/components/Layout.tsx)의
  "Công cụ" 탭 `to`를 `/tinh-luong`(급여계산기로 곧장 점프)에서 `/cong-cu`로
  변경 — 이제 라벨 클릭 시 급여계산기 하나가 아니라 4개 그룹 전체를 보여줌.
- 새 CSS `.th-*`([index.css](src/index.css)) — 카드 그리드(`auto-fill,
  minmax(220px,1fr)`), 다크모드 포함.
  **구현 중 대비 버그 1건 발견·즉시 수정**: 이 앱 다크모드는 페이지
  배경(body) 자체는 안 바뀌고 카드류만 어둡게 뒤집는 방식인데(jd2-card와
  동일 패턴), `.th-group__heading`은 카드가 아니라 페이지 배경 위에 바로
  있는 텍스트라는 걸 놓치고 다크모드에서 거의 흰색(#f1f5f9)으로 바꿔서
  밝은 배경 위에 거의 안 보이는 상태였음 — 로컬 다크모드 스크린샷으로
  직접 발견, 다크모드 오버라이드 자체를 제거(라이트모드 색을 그대로 씀)
  해서 수정.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버(1280×900)로 `/cong-cu` 라이트/다크 모드 둘 다 스크린샷
  확인(수정 후 다크모드 헤딩 정상 렌더), "Hồ sơ của tôi" 카드 클릭 →
  `location.pathname`이 `/ho-so`로 실제 이동하는 것 JS로 직접 확인, 헤더
  탭 active 상태(빨간 밑줄)도 `/cong-cu`에서 정상 표시 확인. 콘솔에 새
  에러 없음.

**헤더 탭 클릭 시 실제 이동 안 하던 문제 수정(2026-09-20, 사용자가 알바몬
스크린샷으로 직접 지적)**: 사용자가 알바몬 "인재정보" 탭을 클릭하면 별도
페이지로 이동하는 화면을 캡처해 보여주며 "우리는 이 부분 클릭하면 개별
페이지로 안 넘어가잖아"로 지적 — 드롭다운이 있는 탭(Việc làm/Thương
hiệu/Công cụ)은 라벨을 클릭해도 `navigate()` 없이 드롭다운 토글만
했던 게 원인([Layout.tsx](src/components/Layout.tsx) 기존 로직). 데스크톱은
이미 hover로 드롭다운이 열려서 안 드러났지만, 알바몬처럼 "라벨 클릭 =
그 섹션 대표 페이지로 이동"은 전혀 안 되고 있었음.
- 드롭다운 있는 탭만 버튼을 **라벨/화살표 두 개로 분리** — 라벨 클릭 시
  `navigate(item.to)`(Việc làm→`/`, Thương hiệu→`/franchise-jobs`,
  Công cụ→`/tinh-luong`), 화살표 클릭 시(`stopPropagation`) 드롭다운
  토글만. 모바일(hover 없음, `isMobileNav()`)은 화살표로 계속 드롭다운
  접근 가능 — 라벨 클릭이 네비게이션으로 바뀌어도 드롭다운 자체를 잃지
  않도록 분리했음(알바몬도 동일 패턴으로 추정).
- 새 CSS `.header-tab--split`/`.header-tab__label`/`.header-tab__arrow-btn`
  ([index.css](src/index.css)) — 기존 `.header-tab`은 그대로 두고(드롭다운
  없는 단순 탭·기업모드 헤더가 계속 씀), 분리형 탭만 패딩을 라벨/화살표
  버튼으로 나눠 가져 전체 탭 크기는 그대로 유지.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버로 "Việc làm" 라벨 클릭 → `location.pathname`이 실제로
  `/`로 바뀌는 것 JS로 직접 확인, 화살표 클릭 → 드롭다운 열리고 URL은
  그대로 유지되는 것 확인(라벨/화살표 분리 정상 동작). 375px 모바일에서도
  화살표 클릭으로 드롭다운 정상 오픈 확인. 콘솔에 새 에러 없음.

**남은 논의 — 기업용 "인재 검색"(알바몬 "인재정보") 기능 부재**: 위 지적과
별개로, 사용자가 알바몬 "인재정보" 탭을 보여주며 확인 — 이건 구직자용이
아니라 **기업이 구직자 이력서 DB를 검색하는 화면**(전체 인재 수 카운트,
지역/업직종 필터, 인재 카드 목록)이었음. 우리는 "기업이 공고를 올리고
지원을 기다리는" 모델만 있고, "기업이 먼저 구직자를 찾아보는" 기능 자체가
없음 — 이번 세션에 처음 발견한 격차. 이건 지금까지 한 배지/메뉴/탭 작업과
급이 다름(구직자 프로필을 지원 안 해도 기업에게 노출하는 거라 개인정보
동의 범위 재설계 필요, 새 화면 여러 개 필요한 규모) — **AskUserQuestion으로
방향을 물었으나 두 번 다 응답 없이 스킵됨, 착수 여부/범위 전혀 미정** —
다음 세션에서 사용자가 먼저 꺼내지 않으면 이쪽에서 다시 확인 필요.

**헤더 메가메뉴 탐색축 세분화 + 상세페이지 탭 구조(2026-09-20, 알바몬 벤치마킹
남은 항목 1·2번, 사용자가 "1,2번 진행하고 별도 허락받지말고 진행해줘"로
위임)**: DB 변경 없는 순수 프론트 작업이라 구현→검증→commit→push→Production
배포까지 한 번에 진행.
- [Layout.tsx](src/components/Layout.tsx) "Việc làm" 메가메뉴에 두 섹션
  신설 — **"Theo thời gian"**(job_duration 7구간 중 대표 4개로 급구
  페이지 `?duration=` 프리셋 진입) / **"Theo điều kiện"**(💰 Lương cao →
  Home `?sort=salary`, 🤝 Có cam kết hợp đồng/BHXH → 급구 페이지
  `?pledge=1`, 바로 전 라운드에서 추가한 자가서약 필드를 실제로 활용).
  전부 실제 동작하는 필터 프리셋이며 가짜 링크 없음. 컬럼이 4→6개로
  늘어 `.mega-menu__inner`에 `flex-wrap: wrap` 추가(기존엔 `display:flex`
  뿐이라 좁은 화면에서 넘칠 수 있었음).
- [UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx): `jobDurations`
  초기값을 `?duration=` URL에서 읽도록 수정(province와 동일한 기존 패턴).
  새 상태 `pledgeOnly`(`?pledge=1`에서 초기화) 추가 — "Điều kiện khác"
  패널에 "Độ tin cậy" 행 신설(체크박스, `.jm-workhour-exclude` 기존 클래스
  재사용), `filtered`/`activeFilterCount`/`clearAllFilters`/패널 count
  배지 전부에 반영.
- [Home.tsx](src/pages/Home.tsx): 기존 URL 동기화 useEffect(cat/region/
  urgent/near/brand/q)에 `sort` 파라미터 추가 — `sort=salary`/`recommended`
  값이면 이미 있던 퀵필터 칩(`handleQuickSalary` 등)과 동일한 `sortMode`를
  URL만으로도 설정 가능해짐.
- [JobDetail.tsx](src/pages/JobDetail.tsx): 알바몬처럼 **탭 3개**로 재구성
  — "Thông tin tuyển dụng"(정보그리드+지도+사진, 기본 활성)/"Mô tả công
  việc"(설명, 없으면 안내문구)/"Thông tin công ty"(신뢰카드+리뷰). 사이드바
  (지원/저장/신고/Zalo/사기방지안내)는 탭과 무관하게 항상 노출 — 알바몬도
  지원 관련 사이드는 탭 밖에 고정. `id` 바뀌면(다른 공고로 이동) 탭을
  'info'로 리셋하는 effect 추가. 새 CSS `.jd2-tabs`/`.jd2-tab`(밑줄 탭,
  기존 `.it2-tab`은 알약형이라 이 페이지 카드 톤과 안 맞아 새로 만듦)
  다크모드 포함.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버(1280×1000)로 메가메뉴 두 섹션 렌더 확인(줄바꿈 정상,
  overflow 없음), "Có cam kết hợp đồng/BHXH" 클릭 → 급구 페이지 "Điều
  kiện khác (1)"+체크박스 실제 체크 확인, "Theo thời gian" 클릭 → "Thời
  gian làm việc (1)" 확인, `?sort=salary` → "Lương cao" 퀵필터 active 클래스
  JS로 직접 확인. 상세페이지 탭 3개 전환 데스크톱+375px 모바일 둘 다 클릭
  동작 확인(모바일은 좁아서 탭 라벨이 2줄로 줄바꿈되지만 깨지지 않고
  정상 클릭됨). 콘솔에 새 에러 없음 — `int64`/404 에러는 손대지 않은
  Home에서도 동일하게 떠서 기존부터 있던 무관한 이슈로 확인.

**공고 상세페이지 "신뢰 정보" 카드 1단계(2026-09-20, 알바몬 구조 벤치마킹
착수 첫 항목)**: 사용자가 "베트남 사이트 틀을 알바몬처럼 잡되, 베트남에
안 맞는 건 빼고 필요한 건 작은 표시까지 다 따라가고 싶다"는 방향을 제시,
Claude in Chrome으로 알바몬 실제 화면(헤더 메가메뉴/전체알바 목록/공고
상세)을 직접 둘러보고 격차를 정리해 보고 → 상세페이지의 "신뢰 배지(기업인증/
근로계약서약속/4대보험 등)"와 "사기방지 안내"가 가장 가치 있는 격차로 확정.
단, 알바몬 배지 중 상당수는 **실제 검증 절차**(사업자등록 확인, 국민연금공단
연동 등)가 뒷받침돼 있어 그대로 베끼면 이 프로젝트가 지켜온 "가짜 필터/배지
금지" 원칙에 어긋남 — 그래서 실제 데이터만 쓰는 1단계와, 별도 검증 절차
설계가 필요한 2단계(기업인증 배지 등, STRICT 대상)로 나눠 1단계만 먼저 진행.
- [src/lib/jobRows.ts](src/lib/jobRows.ts) `fetchEmployerJobCount()` 신규 —
  공개 상세페이지 누구나 볼 수 있어야 하므로 공개 목록과 동일한
  `.eq('active', true)` 필터로 해당 기업(employer_id)의 등록 공고 수만
  count(head:true)로 조회(행 전체를 가져오지 않음). `fetchEmployerJobs()`의
  테스트용 주입 인터페이스(JobsQueryBuilder)는 count/head 옵션 모양이 안
  맞아 쓰지 않고 실제 supabase 클라이언트를 바로 사용.
- [JobDetail.tsx](src/pages/JobDetail.tsx): 기존 "Thông tin công ty" 카드에
  `employerJobCount` fact 한 줄 추가("Đã đăng N tin tuyển dụng trên Việc Gần
  Bạn") — 크롤링 공고(employerId 없음)는 조회 자체를 스킵. 사이드바(지원
  버튼 밑)에 사기방지 안내 박스(`.jd2-scam-notice`, 계좌/OTP/선입금 요구
  경고, 한국어 원문 번역이 아니라 베트남 상황에 맞게 새로 작성) 추가 —
  `.it2-tip`(InterviewTips.tsx의 기존 경고박스 패턴)과 동일한 시각 언어를
  재사용해 새 CSS 패턴을 발명하지 않음, 다크모드 대응도 기존 jd2- 다크블록에
  같이 추가.
- `npx tsc --noEmit` 클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
  로컬 dev 서버로 실제 공고(`sb-4638`) 상세페이지 라이트/다크 모드 둘 다
  스크린샷 확인 — 사기방지 박스 정상 렌더, 기존 레이아웃 회귀 없음.
  "Đã đăng N tin" 줄은 Production에 employer_id 채워진 active 공고가
  0건이라(직전 세션에서 테스트 등록 후 삭제함) 당시엔 실측 못 했었는데,
  **바로 아래 자가서약 작업에서 테스트 행으로 같이 실측 확인 완료**(id=4668,
  확인 직후 삭제).

**신뢰 정보 2단계 — 자가서약(pledge) 배지(2026-09-20, 위 1단계 바로 이어서
같은 세션에 진행)**: 사용자가 "기업인증 같은 실제 검증도 나중에 필요하냐"고
물어 "장기적으로 필요하지만, 지금은 employer_id 채워진 활성 공고가 0건이라
검증할 대상 자체가 없어 지금 우선순위는 아니다 — 대신 비용이 낮은 자가서약형
(자기가 체크하는 것, 검증 아님)은 지금 해도 된다"고 답변 → 사용자가 "1번(자가
서약) 먼저, 2번(관리자 검증) 언제든 이어갈 수 있게"로 확정.
- **DB 마이그레이션 적용 완료**(Production) —
  [supabase/migrations/20260920060000_local_jobs_employer_pledges.sql](supabase/migrations/20260920060000_local_jobs_employer_pledges.sql):
  `local_jobs`에 `labor_contract_pledge`/`social_insurance_pledge` boolean
  컬럼 추가(job_duration과 동일 패턴 — nullable, CHECK 없음, 순수 additive).
  `information_schema` 재조회로 컬럼 생성 확인. **자동 모드 분류기가 첫
  시도를 "Production Deploy"로 한 번 자동 차단**했다가 사용자 재승인 후
  진행됨(이전 세션의 RLS 수정 때와 동일한 패턴) — Production DB 쓰기는
  항상 이 확인 절차를 한 번 더 거칠 것으로 예상.
- [src/types/job.ts](src/types/job.ts)/[jobRows.ts](src/lib/jobRows.ts)/
  [JobsContext.tsx](src/context/JobsContext.tsx): `laborContractPledge`/
  `socialInsurancePledge` 필드 추가 — select 컬럼 목록, `rowToJob()` 매핑,
  `addPostedJob()` insert 전부 반영(기존 gender/age_requirement과 동일한
  자리에 나란히 추가).
- [PostJob.tsx](src/pages/PostJob.tsx): "Cam kết với người lao động" 섹션에
  체크박스 2개("Cam kết ký hợp đồng lao động rõ ràng" / "Cam kết đóng
  BHXH/BHYT đầy đủ theo quy định") 추가, urgent 체크박스와 동일한 기존
  `field field--row` 패턴 재사용.
- [JobDetail.tsx](src/pages/JobDetail.tsx): "Thông tin công ty" 카드에
  기존 관리자 검증 배지(`companyVerified`="✓ Doanh nghiệp đã xác minh")와
  **시각적으로 구분되는 별도 목록**(`jd2-company__pledges`, 🤝 아이콘)으로
  자가서약 표시 — 검증된 사실처럼 보이지 않도록 문구도 "Cam kết"(약속)로
  명확히 구분.
- **실측 검증**: Production DB에 테스트 행 직접 insert(id=4668, 실제 기업
  계정 employer_id 사용, labor_contract_pledge/social_insurance_pledge
  둘 다 true) → 로컬 dev 서버에서 해당 공고 상세페이지 열어 "Đã đăng 1 tin
  tuyển dụng trên Việc Gần Bạn" + 서약 배지 2개 전부 정상 렌더 스크린샷으로
  확인 → 확인 직후 테스트 행 삭제, 잔여 데이터 없음. `npx tsc --noEmit`
  클린, `npm run build` 성공, `npm test` 6/6 파일 통과.
- **남은 항목(보류)**: 기업인증(관리자 승인 플로우, 베트남 Mã số thuế 조회
  기반 — AdminDashboard.tsx의 기존 브랜드 승인 패턴 재사용 가능)은 실제
  employer 가입이 늘어날 때 착수하는 게 맞다고 판단해 계속 보류. 헤더
  메가메뉴 탐색축 세분화도 범위 밖, 별도 라운드로 보류.

**korea_jobs "저장한 공고" 기능 확장(2026-09-19, 옵션 2 선택·구현 완료 —
아래 "다음 결정사항" 7번 재조사 후 진행)**: "다음 결정사항" 7번에 적혀있던
4가지 선택지 설명 중 2곳이 실제와 달랐던 걸 재조사로 먼저 바로잡음 —
① `KoreaConsultModal`이라는 컴포넌트는 코드에 아예 없었음(옵션 3 "기존
모달 확장" 전제가 틀림), ② "저장한 공고"는 DB 테이블(`saved_jobs`)이 아니라
순수 `localStorage`(`storage.ts`의 `vgb_saved_job_ids`)라서 옵션 2도
"FK 하나 추가"가 아니라 **DB 변경 없이 프론트만으로 가능**했음. 이 사실을
사용자에게 설명 후 "니 선택으로 가자"로 옵션 2 진행 위임받음.
- `local_jobs.id`와 `korea_jobs.id`가 서로 다른 bigint 시퀀스라 저장 목록에
  그대로 섞으면 숫자가 겹칠 수 있어, korea_jobs 쪽만 `kr-` 접두사를 붙여
  저장([koreaJobFormat.ts](src/lib/koreaJobFormat.ts)의 `koreaSavedId`/
  `parseKoreaSavedId` 신규).
- [KoreaJobCard.tsx](src/components/korea/KoreaJobCard.tsx): 북마크
  토글 버튼 추가(JobCard.tsx의 Zalo 버튼과 동일한 이유로 `<a>` 안에 `<button>`
  + preventDefault/stopPropagation). [KoreaJobs.tsx](src/pages/KoreaJobs.tsx)/
  [KoreaHome.tsx](src/pages/KoreaHome.tsx) 둘 다 저장 상태 연결.
- [KoreaJobDetail.tsx](src/pages/KoreaJobDetail.tsx): 상세페이지 헤더에도
  북마크 버튼 추가.
- [SavedJobsPage.tsx](src/pages/jobsMenu/SavedJobsPage.tsx): 저장 id를
  `kr-` 접두사 유무로 local/korea 분리, korea 쪽은 `fetchKoreaJobs()`로
  별도 조회 → "Việc làm Hàn Quốc" 섹션 신설(찾은 공고/삭제된 공고 둘 다
  기존 local 섹션과 동일한 UX로 표시).
- CSS: `.kjc__save` 신규(`.kjc`에 `position: relative` 추가).
- `npx tsc --noEmit` 클린, `npm run build` 성공. 로컬 dev 서버 브라우저로
  직접 확인: 홈 화면 카드 북마크 클릭 → `localStorage`에 `["kr-2"]` 저장
  확인 → `/viec-lam/da-luu`에서 "Việc làm Hàn Quốc (1)" 섹션에 정확한
  제목/회사/지역/급여로 표시 확인 → ✕로 언세이브 시 빈 상태로 정상 복귀
  확인 → 상세페이지(`/viec-han-quoc/2`) 북마크 버튼도 "Lưu tin"↔"Bỏ lưu tin"
  정상 토글 확인. 콘솔 에러 없음(무관한 404 2건은 기존부터 있던 것).
- **배포 직후 실사이트에서 버그 1건 발견·즉시 수정**: 저장 직후 다른
  페이지로 이동하면 `fetchKoreaJobs()`가 끝나기 전 순간에 "Tin Hàn Quốc
  không còn tồn tại"(삭제됨)로 잘못 표시되는 깜빡임 — `koreaLoading` state
  추가해 fetch 완료 전엔 "Đang tải..."만 보이게 수정(`429e969`). **git
  push(`c4979d6`→`429e969`) → Vercel Production 재배포 → 실사이트에서
  "Đang tải..." → "Việc làm Hàn Quốc (1)" 정상 전환 재확인 완료**, 테스트로
  넣었던 `localStorage` 값도 정리함(DB 변경이 아니라 브라우저 저장소라
  별도 DB 롤백 불필요).

**Truyền thông/마케팅 소분류 누락 수정(2026-09-19, `crawler/classifier.py`만
변경 — 프론트엔드/Vercel 배포 대상 아님, 다음 크롤러 실행부터 반영)**:
지난 세션이 "`_TRUYEN_THONG` 정규식에 marketing/PR 키워드가 없다"고 남겨둔
보류 항목을 재조사한 결과, **애초에 marketing/PR은 `truyen_thong`(미디어=
촬영/편집/방송 스태프) 소관이 아니라 `van_phong`(사무직) 소관으로 설계돼
있었다**는 걸 확인함(`src/data/subcategories.ts:93-94`,
`crawler/classifier.py:666-667`의 `marketing_quang_cao`/`marketing_sns`가
전부 `van_phong` 밑에 있음 — 알바몬 원본 구조 그대로). 그리고 `_OFFICE`
대분류 정규식(`classifier.py:207-223`)엔 이미 `marketing`/`social media`
등이 포함돼 있어 **대분류 라우팅 자체는 원래도 맞았음**. 진짜 빠진 건
`_SUBCATEGORY_RULES["office"]`에 marketing 관련 소분류 규칙이 아예 없어서
마케팅 공고가 대분류만 맞고 소분류는 항상 None으로 빠지던 것 — 이번에
`marketing_sns`(social media/content creator/KOL/tiktok 특정)와
`marketing_quang_cao`(marketing/quảng cáo/PR 일반) 두 소분류 규칙을 추가하고
`LEGACY_SUB_TO_NEW` 매핑도 같이 추가함. `python crawler/classifier.py`
자체 테스트 전체(대분류 22/22, 소분류 20/20 — 신규 케이스 3개 포함, 신규
체계 매핑 18/18, 새 대분류 12/12) 통과 확인.

**PostJob.tsx 실사용 검증 완료(2026-09-19, 코드 변경 없음 — 실제 기업 계정으로
라이브 테스트만 진행)**: "발견된 문제"에 남아있던 마지막 미검증 항목 해결.
Claude in Chrome으로 실제 로그인된 기업 계정("이종민")에서 `/dang-tin` 폼에
제목/회사명/카테고리=Thiết kế/소분류=Thiết kế web · Mobile/급여/지역/근무기간=
1-3 tháng/성별=Nam/연령=25-34 tuổi/전화/설명을 채워 제출 → `sb-4667`로 정상
등록 확인. **중간에 한 번 "필수 항목을 채워주세요" 검증 실패 발생** — 원인은
카테고리 select를 바꾸는 과정에서 제목/회사명/급여/지역 텍스트 입력란 값이
폼 리렌더로 비워진 것으로 추정(브라우저 자동화 stale ref 문제가 아니라 JS로
직접 `.value` 덤프해 확인한 실제 현상). 네 필드를 다시 채운 뒤 재제출하니
정상 등록됨 — PostJob.tsx 자체의 재현 가능한 폼 상태 버그일 가능성이 있으니
사용자가 실제로 카테고리를 여러 번 바꿔가며 등록해볼 때 같은 현상이 재현되면
알려달라고 안내 필요(코드 수정은 이번에 하지 않음, 범위 밖).
Production DB(`edhuesdnuxlbcfephutq`)에서 `select ... where company='TEST
Company - DELETE'`로 저장된 값 전부 정확함을 확인(category/subcategory/
job_duration/gender_requirement/age_requirement/phone/description 전부
의도한 값 그대로) → 확인 즉시 `delete ... where id=4667`로 테스트 행 삭제,
잔여 데이터 없음.

**집 PC 이어서 진행(2026-09-20, `ed5ef50`→`7eeb667`, commit/push/Production
배포 완료 + RLS 보안 수정 1건)**:
1. 신규 대분류 5개(cntt_ky_thuat/thiet_ke/truyen_thong/y_te_dieu_duong/
   giao_duc_giang_day) 전용 Unsplash 이미지 추가(`categoryVisuals.ts`) —
   전부 URL 실제 로드 확인 후 반영. `JobCard.tsx`의 폴백 카테고리가 폐기된
   `'other'`를 참조하던 죽은 코드도 같이 `'khac'`으로 수정.
2. **`applications_insert` RLS tautology 보안 수정(운영 DB 적용 완료)** —
   `l.employer_id = l.employer_id`(항상 참, 검증 무효)를
   `l.employer_id = applications.employer_id`(실제 소유 검증)로 교체.
   수정 전엔 로그인한 구직자가 API를 직접 조작해 임의의 employer_id로
   지원서를 위조해 저장할 수 있었음(데이터 무결성 문제). 마이그레이션
   [supabase/migrations/20260920043000_fix_applications_insert_employer_check.sql](supabase/migrations/20260920043000_fix_applications_insert_employer_check.sql).
   **검증**: 운영 DB에서 트랜잭션 롤백 기반 시뮬레이션(`set_config`+
   `set local role authenticated`, 끝에 `rollback`으로 흔적 없음)으로
   정상 지원(employer_id 일치) 성공·위조 지원(employer_id 불일치) 차단
   둘 다 실측 확인. Supabase MCP 쓰기 작업이 "Modify Shared Resources"로
   한 번 자동 차단됐다가 사용자 재승인 후 진행됨 — 운영 DB DDL은 항상 이
   확인 절차를 거칠 것.
3. korea_jobs 통합은 "제일 큰 안건이라 나중에"로 보류, applications_insert
   다음 순서로 categoryVisuals를 먼저 처리(사용자가 번호 순서대로 진행
   지시). **선택지 4가지를 이번에 재구성**(원본 상세는 과거 세션 문서
   스냅샷 정책으로 유실됨) — 아래 "다음 결정사항" 참고.
4. **기업 계정 헤더에 "Việc làm" 링크 추가**(`c68f235`) — 기업 로그인 시
   구직자 메뉴 전체가 사라져 급구 페이지 등에 URL 직접 입력 없이는 접근
   불가능했던 문제. 전체 메가메뉴 대신 홈("/")으로 가는 링크 1개만 추가.
   **검증 완료(2026-09-20, 같은 날 재연결 후)**: Claude in Chrome이 한 번
   끊겼다가 사용자가 확장 재연결 후 실제 기업 계정("이종민")으로 로그인해
   직접 확인 — 헤더에 "Bảng điều khiển"/"Đăng tin"/"Việc làm" 3개가
   정확히 노출되고 "Việc làm" 링크가 홈("/")으로 정상 연결됨.
5. **구/현 "전체 선택" 원클릭 필터 + 지역 검색창에 구/현 이름 인덱싱**
   (`ad1b587`) — Xã/Phường 열 맨 위에 업직종 패널과 동일한 "Tất cả
   <구/현명>" 항목 추가(클릭 시 그 구/현의 동/사 전체를 selectedWards에
   합침). 지역 검색창도 성/시+동/사뿐 아니라 구/현 이름으로도 검색되게
   확장. 로컬 개발 서버에서 검색("Binh Thuy" → "Cần Thơ · Quận Bình
   Thuỷ" 클릭)과 3열 UI 직접 클릭 둘 다 "Khu vực (6)"로 정확히 반영되는
   것 실측 확인.
6. `backup-home-2026-09-18-workperiod-panel` 로컬 브랜치 삭제 — 이미
   다른 세션이 같은 목표(패널 라벨-왼쪽 레이아웃)를 더 최신 상태로
   달성해서 완전히 중복이라 판단(코드 변경 아님, git 정리만).

**추가 반영(다른 PC 세션, `f2c5da7`→`f1c5068`, commit/push/Production 배포
완료)**:
1. 급구 페이지 지역 기본값(Cần Thơ 자동 선택)을 제거 — 아무 필터도 선택 안
   한 초기 상태에서 전체 급구 공고 목록이 바로 보이도록 함. 아래 "다음
   결정사항" 10번 항목이 이걸로 해결됨(상세는 맨 아래 새 절 참고).
2. 필터 패널이 열릴 때 아래 공고 목록을 덮던 문제 수정 — 패널을
   `position:absolute`로 띄우던 방식에서 `createPortal`로 필터 줄 바로
   아래 일반 문서 흐름에 그리는 방식으로 변경, 패널이 열리면 목록이 자연
   스럽게 밀려 내려감(상세는 맨 아래 새 절 참고).
3. **성별/연령 조건 실제로 작동하게 만듦** — "발견된 문제"에 있던 "UI만
   있고 필터링 안 됨" 항목 해결. `local_jobs`에 `gender_requirement`/
   `age_requirement` 컬럼 추가(Production 적용 완료), 급구 페이지 Giới
   tính/Độ tuổi를 실제 filtered 로직에 연결, PostJob.tsx에 성별/연령
   조건 입력란 + 그동안 없던 소분류 드롭다운도 같이 추가(상세는 맨 아래
   새 절 참고).

이 커밋들을 push할 때 origin/master가 이미 15개 커밋 앞서있어(아래
job_duration 라운드 등) 일반 `git push`가 한 번 거부됨 → `git fetch` +
`git rebase origin/master`로 안전하게 합침(충돌 없음, 강제 push 안 씀) —
두 PC가 동시에 작업할 때는 세션 시작 시 `git fetch origin && git status`로
먼저 동기화 여부 확인 필요.

**이전 라운드 세션 최종 상태(여러 라운드 거쳐 완료, commit/push/Production 배포
전부 끝남 — 라운드별 상세 경위는 아래 요약만 유지, 코드가 실제 근거):**

- `job_duration`(근무기간 7구간) 컬럼 추가 + PostJob.tsx 필드 + 급구 "Thời
  gian làm việc" 패널 필터.
- "Thời gian làm việc" 패널: 라벨 왼쪽-굵게 행 레이아웃(`.jm-filter-row`),
  "근무요일"/"근무시간"에 "목록에서 선택/직접선택"(사각 버튼) 전환 — 비활성
  쪽은 숨기지 않고 흐리게(`jm-workhour-inactive`)만, 두 모드 다 항상 같이
  보임. "협의 제외"는 workDays/hours 빈 공고를 제외하는 실제 필터로 구현.
- "Điều kiện khác" 패널도 동일한 `.jm-filter-row` 레이아웃으로 통일, 알바몬
  캡처본과 같은 4행 구성: **Giới tính**(Nam/Nữ 칩, "Không giới hạn" 없음)/
  **Độ tuổi**(드롭다운)/**Loại hình công việc**(work_period, 급구 공고에
  실제 존재하는 값만 동적 — job_duration과 달리 크롤러 자유텍스트라 고정
  목록 아님, 한 번 고정 목록으로 시도했다 사용자 지시로 되돌림)/**Từ
  khóa**(Bao gồm+Loại trừ 통합). **성별/연령은 DB 컬럼이 없어 실제 필터링에
  반영 안 되는 UI만**(genderFilter/ageFilter state, activeFilterCount·
  clearAllFilters 미포함) — 알바몬과 "동일하게" 만들라는 명시적 지시로
  구조만 맞춤, 추후 실데이터 생기면 연결 필요.
- 0016 orphan draft migration 삭제(`job_duration`/`work_period`가 이미
  같은 개념 커버, 운영 DB에 한 번도 적용 안 됐던 파일).
- **Home.tsx + 맞춤공고(RecommendSection.tsx)에 소분류 필터 추가**(급구
  페이지 지역/업종 2단 구조를 다른 화면에도 확대하는 안건 중, 사용자가
  "지금 UX 유지 + 소분류만 추가"로 확정): Home은 기존 대분류만 있던(실은
  UI 자체가 없어 죽어있던 categorySelectRef까지 같이 고침) 곳에 대→소분류
  select 2단 추가 + 안 쓰던 F&B(cafe/restaurant, 구 카테고리 체계 잔재)
  특수 그룹핑 dead code 제거. RecommendSection은 categories(소프트 스코어링
  10점)에 subcategories(추가 5점) 매칭 보너스로 추가 — 지역(하드 필터)과
  달리 소프트 조건이라 URL 필터가 아니라 점수 가산. 저장한 공고/지도는
  원래 지역·업종 필터 자체가 없던 화면이라 이번 확대 범위에서 제외(사용자
  확인).

이전 세션들(A~I 라운드: 대분류/소분류 체계 전면 재설계, Khu vực 패널 UX 다수
수정, 옛 Quận/Huyện 중간 단계 복원, 검색창/그리드/글자크기 재조정)은 전부
master push + Vercel Production 배포까지 완료된 상태(`0a7af24`까지) — 자세한
내용은 git log(`0a7af24` 이전 커밋들)로 확인 가능, 이 문서는 최신 스냅샷만
유지하므로 과거 라운드 상세 내역은 누적하지 않는다.

## 변경 내용

### DB 마이그레이션 (적용 완료, Production)
- `ALTER TABLE local_jobs ADD COLUMN job_duration text;` — Supabase MCP로
  실제 운영 프로젝트(`edhuesdnuxlbcfephutq`)에 적용 완료, `information_schema`
  재조회로 컬럼 존재 확인함. nullable, CHECK 제약 없음.
- 마이그레이션 파일: [supabase/migrations/20260918112447_local_jobs_job_duration.sql](supabase/migrations/20260918112447_local_jobs_job_duration.sql)
  — 아직 커밋 전(git status 확인, add 필요).
- **주의**: 기존 `supabase/migrations/0016_local_jobs_work_duration_draft.sql`
  이라는 draft가 이미 있었음 — 이름이 비슷한(`work_duration`) 별개 컬럼으로,
  ViecLam24h 원문 자유텍스트 계약기간 개념(예: "Dài hạn")이었고 **사용자
  승인 전 상태로 한 번도 운영 DB에 적용된 적 없음**(grep으로 코드 전체에서
  참조 0건 확인, 순수 orphan draft). 이번에 추가한 `job_duration`은 알바몬
  스타일 고정 7구간이라 이름/값 체계가 다른 **별개의 새 컬럼**이다. 0016은
  지우지 않고 그대로 뒀음 — 지울지는 사용자 판단 필요(아래 "다음 결정사항"
  참고).

### 프론트엔드
- [src/data/jobDuration.ts](src/data/jobDuration.ts) — 근무기간 7종
  (`Một ngày`/`Dưới 1 tuần`/`1 tuần - 1 tháng`/`1 - 3 tháng`/`3 - 6 tháng`/
  `6 tháng - 1 năm`/`Trên 1 năm`) 공유 상수. PostJob.tsx와
  UrgentJobsPage.tsx 둘 다 이 파일 하나를 참조.
- [src/types/job.ts](src/types/job.ts) — `Job.jobDuration?: string` 추가.
- [src/lib/jobRows.ts](src/lib/jobRows.ts) — `rowToJob()`에 `job_duration`
  매핑 추가, `EMPLOYER_JOBS_SELECT_COLUMNS`에 컬럼 추가.
- [src/context/JobsContext.tsx](src/context/JobsContext.tsx) — 공개 목록
  select 컬럼에 `job_duration` 추가, `addPostedJob()` insert에
  `job_duration: draft.jobDuration ?? null` 추가.
- [src/pages/PostJob.tsx](src/pages/PostJob.tsx) — "Thời hạn làm việc"
  select 필드 추가(선택 안 함 기본값, 7종 옵션). 기존 "Thời gian làm việc"
  (근무시간 자유텍스트, `hours` 컬럼) 필드와 라벨이 겹치지 않도록 별도
  문구로 뺐다 — `hours`="근무시간"(예: "08:00–17:00"), `jobDuration`=
  "근무기간/계약기간"(하루~1년 이상 구간)으로 개념이 다름.
- [src/pages/jobsMenu/UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx):
  1. "Thời gian làm việc" 필터 패널의 "Hình thức" 섹션(work_period, 다이나믹
     값)을 제거하고, 그 자리에 "Thời hạn làm việc" 섹션(job_duration, 고정
     7구간 — work_period와 달리 실제 존재하는 값만 뽑지 않고 항상 7개 다
     보여줌, PostJob.tsx가 정해진 값만 넣게 하므로 가능)을 새로 추가.
  2. "Điều kiện khác"(상세조건) 패널에 "Loại hình công việc" 섹션 신설 —
     기존 work_period 다중선택(`workPeriods` state, `workPeriodOptions`
     다이나믹 목록)을 여기로 그대로 옮김. 라벨은 CHATGPT_HANDOFF.md 이전
     합의대로 "Hình thức làm việc"를 재사용하지 않고 "Loại hình công việc"
     로 새로 지음(person-centric 고용형태 프레임에 맞춤).
  3. `activeFilterCount`/`clearAllFilters`/각 패널 count·초기화 버튼에
     `jobDurations` 추가, `Điều kiện khác` 패널 count·초기화에 `workPeriods`
     포함되도록 이동.
  4. 상단 주석 2곳(컴포넌트 설명, 예전엔 "성별/연령/고용형태 데이터 없어
     상세조건에서 제외"라던 부분)을 실제 반영된 상태로 갱신.

### "Thời gian làm việc" 패널 레이아웃 재구성 (같은 날, 알바몬 캡처본 참고)
- 새 CSS 클래스([src/index.css](src/index.css) `.jm-workhour-row` 계열,
  `.jm-keyword-group__label` 근처): 라벨을 그룹 위가 아니라 왼쪽(고정폭
  84px)에 굵게 배치, 옵션은 오른쪽 `.jm-workhour-row__body`에. 480px 이하
  모바일은 미디어쿼리로 세로 스택으로 전환.
- **"Ngày làm việc" 행**: 기존 "Ngày làm việc"(요일 프리셋)와 "Số ngày làm
  việc/tuần"(주N일) 두 섹션을 한 행으로 합침 — "Chọn từ danh sách" 모드에서
  프리셋 칩 + 주N일 칩을 같은 줄에, "Chọn thủ công" 모드에서 요일 하나씩
  (월~일) 직접 토글. **두 모드 다 기존 `selectedDays`/`selectedDayCounts`
  state를 그대로 써서 완전히 동작하는 진짜 기능**(가짜 UI 아님).
- **"Khung giờ" 행**: "Chọn từ danh sách" 모드는 기존 시간대 프리셋+버킷
  칩(그대로), "Chọn thủ công" 모드는 시작/종료 시각 드롭다운(00:00~23:00,
  `HOUR_OPTIONS`)을 보여주지만 **실제 필터링에는 반영하지 않는 순수 UI**
  — local_jobs.hours가 자유텍스트라 정확한 시/분 단위로 거를 데이터가
  없음(workScheduleParse.ts는 버킷 단위 파싱만 가능). 화면에 "Bộ lọc theo
  giờ chính xác chưa khả dụng..." 안내 문구로 명시해 사용자를 속이지
  않도록 함(사용자에게 이 트레이드오프 확인 후 진행 — AskUserQuestion으로
  확인함).
- "목록에서 선택/직접선택" 전환 버튼은 캡처본의 동그라미 라디오 대신
  기존 사각 버튼 스타일(`.jm-workhour-mode-btn`)로 — 사용자 지시
  ("동그라미 말고 네모칸 유지").
- **(수정판)** 처음엔 모드 전환 시 비활성 그룹을 완전히 숨겼는데, 사용자가
  캡처본을 다시 보여주며 "동일하게 만들어" — 캡처본은 두 칩 그룹이 항상
  같이 보이고 선택 안 된 쪽만 흐리다. `.jm-workhour-inactive`(opacity 0.4,
  DOM에서 제거 안 함 — 클릭도 계속 가능)로 교체. "Ngày làm việc" 행은
  프리셋+주N일 칩과 개별 요일 칩이 항상 같이 보임(모드에 따라 어느 쪽이
  흐려질지만 바뀜), "Khung giờ" 행은 프리셋+버킷 칩과 시작/종료 드롭다운이
  항상 같이 보임.
- **"협의 제외" 체크박스 추가**(1차에서 임의로 뺐던 것 — 사용자가 "뺄 건
  뺐는데"로 지적, 캡처본에 있는 요소는 그대로 살려야 함): 알바몬 원본을
  그대로 베끼면 대응 데이터가 없어 가짜 필터가 되므로, 같은 의도(정보
  불명확한 공고 제외)를 실제 데이터로 구현 — "Loại trừ tin chưa rõ ngày
  làm việc"(workDays 빈 공고 제외)/"Loại trừ tin chưa rõ giờ làm việc"
  (hours 빈 공고 제외), 둘 다 `parseWorkDays`/`parseWorkHourBuckets` 파싱
  결과가 0건인 공고를 제외하는 진짜 필터(`excludeUnspecifiedDays`/
  `excludeUnspecifiedHours` state, activeFilterCount·초기화 버튼에도 포함).

### "Điều kiện khác" 패널도 같은 행 레이아웃으로 통일 (세 번째 라운드)
- CSS 클래스 일반화: `.jm-workhour-row`/`__label`/`__body` → `.jm-filter-row`/
  `__label`/`__body`(sed로 전체 치환, "Thời gian làm việc"/"Điều kiện khác"
  둘 다 이제 이 클래스를 공유). `.jm-workhour-mode-toggle` 등 근무시간
  패널 전용 요소는 이름 그대로 유지(다른 패널에서 안 씀).
- "Loại hình công việc" 행: 기존 `jm-keyword-group`(라벨 위) → `jm-filter-row`
  (라벨 왼쪽) 변경, 내용물(work_period 다중선택 칩)은 그대로.
- "Chỉ hiện tin chứa từ khóa"/"Loại trừ tin chứa từ khóa" 두 개 별도
  `jm-keyword-group`을 "Từ khóa" 라는 하나의 `jm-filter-row`로 합침(알바몬
  캡처본의 "키워드" 행이 포함/제외 둘 다 한 라벨 아래 있는 구조와 동일) —
  내부에 `jm-keyword-group__label`(작은 서브라벨) "Bao gồm (n)"/"Loại trừ
  (n)"로 구분, 기존 카운트가 없던 것에 개수 표시만 추가(알바몬처럼 "0/20"
  같은 임의 상한은 만들지 않음 — 우리 쪽엔 실제 글자수 제한이 없어서).
- 더 이상 아무 데서도 안 쓰는 `.jm-keyword-group + .jm-keyword-group` CSS
  규칙(이전엔 옛 구조의 그룹 간 여백용)도 같이 제거.

### "Loại hình công việc" 고정 목록 시도 → 되돌림 (네 번째 라운드)
- job_duration과 같은 원칙(고정 목록 항상 표시)을 work_period에도 적용해봤다가,
  사용자 지적("근무기간하고 왜 동일하게 하지?")으로 되돌림 — work_period는
  크롤러 자유텍스트(닫힌 enum 아님)라 job_duration의 "우리가 정의한 닫힌
  값 집합"과 성격이 다름. 원래대로 급구 공고에 실제 존재하는 값만 동적으로
  보여주는 방식 유지(+"데이터 없음" hint 문구도 복원).

### "Điều kiện khác" Giới tính/Độ tuổi 행 추가 (다섯 번째 라운드)
- 사용자가 "상세조건 상단에 성별/연령/고용형태/키워드 이렇게 구성해달라고
  알바몬하고 동일하게 만들어달라고 캡처해서 보내줬잖아"로 명확히 지시 —
  이전엔 "DB 컬럼 없어 가짜 필터가 됨"이란 이유로 성별/연령을 제외했었는데,
  이번엔 구조를 알바몬과 동일하게 맞추라는 명시적 지시라 그대로 따름.
- **Giới tính**: "Nam"/"Nữ" 칩 버튼(`genderFilter` state, 토글).
- **Độ tuổi**: `AGE_OPTIONS`(18-24/25-34/35-44/45-54/55+ tuổi) select
  드롭다운(`ageFilter` state).
- **둘 다 local_jobs에 대응 컬럼이 없어 `filtered` 계산에는 반영 안 함** —
  UI 상태만 존재(activeFilterCount/clearAllFilters에도 미포함, "Điều kiện
  khác" 패널 초기화 버튼에서만 같이 리셋). 나중에 성별/연령 데이터가 생기면
  실제 필터로 연결 필요.

### 지역 기본값 제거 — 무필터 상태에서 전체 목록 표시 (`f2c5da7`)
[UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)의 `selectedProvince`
초기값을 `VN_PROVINCES[0]`(Cần Thơ)에서 다시 `null`로. 배경: 이전 라운드에서
Khu vực 패널을 기본으로 열어두는 수정(`openPanel` 초기값 `'region'`)을
했었는데, 그것과 "Cần Thơ 자동 선택" 로직이 같이 있으면 처음 들어왔을 때
패널은 열려있지만 그 뒤의 목록은 계속 0건으로 보이는 상태였다. 사용자가
캡처본 2장(우리 사이트의 빈 목록 vs 알바몬의 실제 목록)을 비교해서 "아무것도
선택하지 않아도 기본테이블 보이게 해줘"로 명확히 지시 — 지역을 아예 선택 안
한 무필터 상태를 기본값으로 되돌려 전체 급구 공고가 바로 보이게 했다.
(참고: 이 지시 전에 사용자가 알바몬 캡처의 "서울 전체 ✕" 칩을 보여주며
칩 바 부활을 원하는 건지 확인차 되물었는데, 그건 아니었고 순수히 "목록이
안 보인다"는 지적이었음 — 칩 바는 이전 결정대로 계속 제거된 상태 유지.)

### 필터 패널이 공고 목록을 덮던 문제 수정 (`f1c5068`)
위 수정 후 사용자가 실제로 패널을 열어보고 "상단 클릭하면 공고가 가려지지?"
로 새 문제를 지적 — `.jm-filter-dropdown__panel`이 `position: absolute`로
떠 있어서(2026-09-17에 "필터 줄 전체 폭에 맞추려고" 도입한 방식), 패널이
열릴 때마다 그 아래 있는 공고 목록을 덮어버리고 있었다(알바몬은 패널이
열리면 목록이 밀려 내려감, 덮지 않음).

**원인**: 각 `FilterDropdown`이 자기 버튼 바로 밑에 패널을 `position:
absolute`로 렌더 — `.jm-urgent-filters`(필터 4버튼 한 줄) 안의 한 버튼
DOM 서브트리에 속해있어서, 일반 문서 흐름으로 바꾸면 그 버튼 하나만 커지고
나머지 3버튼이 옆으로 밀리는 이상한 레이아웃이 됨.

**해결**: `FilterDropdown`이 패널을 자기 자리에 직접 렌더하지 않고,
`createPortal`로 `.jm-urgent-filters` 줄 바로 다음에 있는 공유 DOM 노드
(`panelSlot`, `<div ref={setPanelSlot} className="jm-urgent-panel-slot" />`)
에 그리도록 변경 — 버튼 4개는 그대로 한 줄에 남고, 열린 패널만 그 줄 밑에
일반 블록으로 나타나 아래 내용을 자연스럽게 밀어낸다. CSS도
`position:absolute`+`left/right:0` 조합을 제거하고 `width:100%`인 평범한
블록으로 바꿈. 바깥 클릭 감지(`FilterDropdown`의 `useEffect`)도 버튼
DOM(`btnRef`)뿐 아니라 포털된 패널(`panelSlot`) 안쪽 클릭까지 "안쪽"으로
인식하도록 같이 고쳤다(안 그러면 패널 안을 클릭해도 바로 닫혀버림).

### 성별/연령 조건 실제 필터로 연결 + PostJob 소분류 추가 (`543cafa`)
사용자가 "다음 뭐하지?" 질문에 대한 답으로 남아있던 미결정 항목("Giới
tính/Độ tuổi UI는 있는데 DB 컬럼이 없어 실제 필터링 안 됨")을 골랐고, "8개
항목 중 같이 할 만한 거 있나?"에 PostJob 소분류 드롭다운(우선순위 있던
별도 미착수 항목)을 같이 묶는 걸로 확정했다.

- **DB(Production 적용 완료)**: `local_jobs`에 `gender_requirement`/
  `age_requirement` text 컬럼 추가(job_duration과 동일 패턴 — nullable,
  CHECK 제약 없음, `information_schema` 재조회로 존재 확인).
  [migration 파일](supabase/migrations/20260919030243_local_jobs_gender_age_requirement.sql).
- **[data/jobRequirements.ts](src/data/jobRequirements.ts)** 신규 —
  `AGE_REQUIREMENT_OPTIONS`(급구 필터에 있던 5구간, `UrgentJobsPage.tsx`
  로컬 상수에서 이동)/`GENDER_REQUIREMENT_OPTIONS`("Nam"/"Nữ"). PostJob.tsx
  ·UrgentJobsPage.tsx 둘 다 공유(job_duration.ts와 동일 패턴).
- **[UrgentJobsPage.tsx](src/pages/jobsMenu/UrgentJobsPage.tsx)**: 지금까지
  클릭만 되고 결과에 아무 영향 없던 `genderFilter`/`ageFilter`를 `filtered`
  useMemo에 실제로 연결. **다른 필터(workPeriod/jobDuration 등)와 다르게
  설계** — 성별/연령은 "공고 자체의 성질"이 아니라 "누가 지원 가능한가"라는
  조건이라, 조건 값이 비어있는(null) 공고는 "제한 없음"을 뜻하므로 어느
  값을 선택해도 계속 보여야 한다(반대로 strict 매칭했다면 지금 이 값을
  채운 공고가 0건이라 필터를 건드리는 순간 결과가 전부 사라져버렸을 것).
  `genderFilter` 내부 타입도 `'male'|'female'`에서 DB 값과 그대로 같은
  `'Nam'|'Nữ'`로 바꿔 번역 레이어 없앰. "Điều kiện khác" 버튼 자체의 카운트
  배지(`count` prop)도 gender/age 반영하도록 같이 수정(빠뜨렸으면 배지에는
  안 뜨는데 실제로는 필터가 걸리는 어긋남이 생겼을 것 — 직접 브라우저로
  발견해서 수정).
- **[PostJob.tsx](src/pages/PostJob.tsx)**: 대분류만 있고 없던 **소분류
  드롭다운** 추가(`SUBCATEGORY_LABELS[category]` 기반, 대분류 바꾸면 초기화,
  'khac'은 소분류 규칙 자체가 없어 select 숨김) + **Giới tính/Độ tuổi
  조건 선택란** 추가. 겸사겸사 `category` 기본값이 2026-09-17에 폐기된
  구 8분류 잔재 `'other'`로 남아있던 걸 발견해 `'khac'`으로 수정(대분류를
  안 건드리고 등록하면 DB에 유효하지 않은 값이 들어가던 잠재 버그 —
  `as JobCategory` 타입 단언 때문에 tsc가 못 잡고 있었음).
- 크롤러 소스는 이 정보를 안 주므로(job_duration과 동일 이유) 값은 앞으로
  PostJob.tsx로 직접 등록하는 공고부터만 채워진다.

## 테스트 결과

- `npx tsc --noEmit` 클린.
- `npm run build` 성공(`jobDuration-46umscL_.js` 청크 생성 확인).
- `npm test` 6/6 파일 전부 통과(회귀 없음, jobRows.test.ts 포함).
- 로컬 dev 서버(`http://localhost:63624/viec-lam/tuyen-gap`) 브라우저로
  직접 확인: "Thời gian làm việc" 패널에 "Thời hạn làm việc" 7개 칩 정상
  렌더, "Điều kiện khác" 패널에 "Loại hình công việc" 섹션(급구 공고 실제
  값 기준 "Bán thời gian cố định"/"Toàn thời gian cố định" 2개) 정상 렌더.
  콘솔 에러 없음(무관한 404 2건은 기존부터 있던 리소스, 이번 변경과 무관).
- **DB에 실제 job_duration 값이 채워진 공고가 아직 0건**이라(PostJob.tsx로
  아직 아무도 등록 안 함) 실제 필터링 동작(칩 선택 → 결과 줄어듦)은 로컬
  테스트로 검증 못 함 — 코드 로직은 기존 workPeriod 필터와 완전히 동일한
  패턴이라 구조적으로는 신뢰 가능.
- 패널 레이아웃 재구성 후 재확인: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과(회귀 없음). 로컬 브라우저(데스크톱+375px
  모바일)로 라벨 왼쪽/굵게, "Chọn từ danh sách"↔"Chọn thủ công" 전환(요일
  칩↔개별 요일, 시간 프리셋↔시작/종료 드롭다운) 전부 정상 렌더 확인,
  콘솔 에러 없음(무관한 404 2건은 기존부터 있던 것).
- **수정판(흐림 처리 + 협의 제외) 재확인**: `npx tsc --noEmit` 클린,
  `npm run build` 성공, `npm test` 6/6 파일 통과. 브라우저로 "Chọn từ danh
  sách"/"Chọn thủ công" 전환 시 비활성 그룹이 숨겨지지 않고 흐려지기만
  하는 것 확인(`get_page_text`로 두 그룹 텍스트가 항상 같이 나오는 것
  확인), "Loại trừ tin chưa rõ..." 체크박스 렌더 확인.
- **"Điều kiện khác" 레이아웃 통일 재확인**: `npx tsc --noEmit` 클린,
  `npm run build` 성공, `npm test` 6/6 파일 통과. 브라우저 900px 폭에서
  "Loại hình công việc"/"Từ khóa" 라벨이 왼쪽에 굵게, 내용은 오른쪽에
  나란히 배치되는 것 스크린샷으로 확인(480px 이하에서는 기존 미디어쿼리로
  세로 스택 — "Thời gian làm việc" 패널과 동일 반응형 규칙 공유).
- **되돌림(동적 목록) + Giới tính/Độ tuổi 추가 재확인**: `npx tsc --noEmit`
  클린, `npm run build` 성공, `npm test` 6/6 파일 통과. `get_page_text`로
  "Điều kiện khác" 패널이 Giới tính/Độ tuổi/Loại hình công việc(급구 공고
  실제 값 기준 2개, 동적)/Từ khóa 4행으로 렌더되는 것 확인.
- **지역 기본값 제거 재확인**: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과(회귀 없음, rebase로 합쳐진 job_duration
  라운드 코드까지 포함해서 재검증). 로컬+Production 둘 다 브라우저로
  `get_page_text` 확인 — 필터 버튼이 "Khu vực"(카운트 없음)로 뜨고, 패널
  닫으면 "Tổng 3 việc làm tuyển gấp"로 전체 목록이 즉시 표시됨 확인.
- **패널 오버레이 수정 재확인**: `npx tsc --noEmit` 클린, `npm run build`
  성공, `npm test` 6/6 파일 통과. 로컬 브라우저로 패널 연 상태에서 스크린샷
  → 목록이 패널 밑으로 정상 표시(가려지지 않음) 확인, 패널 안(지역 선택)
  클릭해도 안 닫히는 것 확인(Hà Nội 선택 후 "Khu vực (1)"로 정상 반영),
  바깥 클릭 시 정상적으로 닫히는 것 확인, 375px 모바일에서도 레이아웃
  정상 확인. Production 배포 후 `getBoundingClientRect()`로 실측 —
  `panelBottom: 780.9px`, `toolbarTop: 794.5px`(목록이 패널보다 아래)로
  실제 반영 확인.
- **성별/연령/소분류 확인**: `npx tsc --noEmit` 클린, `npm run build` 성공,
  `npm test` 6/6 파일 통과. Production DB `information_schema` 재조회로
  `gender_requirement`/`age_requirement` 컬럼 실제 생성 확인. 로컬+
  Production 둘 다 브라우저로 "Điều kiện khác" 패널에서 "Nam" 칩 클릭 →
  버튼 배지가 "Điều kiện khác (1)"로 반영됨을 `querySelector`로 직접 확인,
  현재 이 값을 채운 공고가 0건이라 "Tổng 3 việc làm"으로 결과가 그대로
  유지되는 것도 확인(strict 매칭이었다면 0건이 됐을 것 — null-passthrough
  로직이 의도대로 동작). PostJob.tsx는 `RequireEmployer` 라우트 가드 뒤에
  있어(로그인 필요, 테스트 계정 없음) 브라우저 직접 조작 검증은 못 했고
  `tsc`/`build` 통과로만 구조적 정합성을 확인함 — 다음에 실제 기업 계정으로
  한 번 등록해보고 소분류/성별/연령 값이 DB에 제대로 들어가는지 확인 필요.
- **PostJob.tsx 실등록 라이브 테스트(2026-09-19)**: 실제 기업 계정으로
  `/dang-tin`에서 전 필드(소분류/근무기간/성별/연령 포함) 채워 제출 →
  `sb-4667` 정상 등록 → Production DB에서 저장 값 전부 정확함 확인(아래
  값 그대로: category=thiet_ke, subcategory=thiet_ke_web_mobile,
  job_duration="1 - 3 tháng", gender_requirement="Nam",
  age_requirement="25 - 34 tuổi") → 확인 직후 테스트 행 삭제, 잔여 데이터
  없음. 이로써 위 "구조적으로는 신뢰 가능"이었던 상태가 실측 검증으로 격상.

## 발견된 문제

- ~~PostJob.tsx 실사용 미검증~~ — 해결(2026-09-19, 위 새 절 참고). 실제
  기업 계정으로 소분류/성별/연령/근무기간까지 포함해 실등록 → DB 값 확인
  → 테스트 행 삭제까지 완료. **단, 제출 중 카테고리 변경 후 제목/회사명/
  급여/지역 텍스트 필드가 비워지는 현상을 한 번 관찰** — 재현성 미확인,
  다음에 실제로 등록하다 같은 현상이 또 나오면 PostJob.tsx 폼 상태 로직
  점검 필요(이번엔 범위 밖이라 코드 수정 안 함).
- `PostJob.tsx`의 `category` 기본값이 2026-09-17에 폐기된 구 8분류 잔재
  `'other'`로 남아있던 잠재 버그 발견·수정(2026-09-19, `'khac'`으로) —
  `as JobCategory` 타입 단언 때문에 tsc가 못 잡았던 사례. 다른 파일에도
  비슷하게 타입 단언으로 숨겨진 구 타입값이 더 있을 수 있음(전수조사는
  안 함, 필요하면 별도 지시).
- 위 "주의" 참고 — `0016_local_jobs_work_duration_draft.sql`이 이번 작업
  전부터 존재했으나 아무도 적용하지 않은 orphan draft였음. 두 세션(회사/집
  PC) 사이에 이런 미적용 draft가 있었다는 걸 이번에 처음 발견 — 앞으로 새
  컬럼을 추가하기 전에는 `supabase/migrations/` 디렉토리에 관련 draft가
  이미 있는지 먼저 확인하는 습관이 필요함.
- ~~`applications_insert`의 tautology 조건~~ — 해결(2026-09-20, 위 새 절
  참고, 운영 DB RLS 정책 수정 + 트랜잭션 시뮬레이션 검증 완료).
- ~~`categoryVisuals.ts` 신규 대분류 5개 전용 이미지 없음~~ — 해결
  (2026-09-20, 위 새 절 참고). **화면 검증도 완료**: 홈 화면 "Ngành nghề"
  select를 "Thiết kế"로 걸어 이미지 없는 실제 공고("3D Rigger", job
  id=4633)를 찾아 fallback 이미지가 카드에 정상 렌더되는 것 스크린샷으로
  확인.
- ~~기업 계정 헤더 "Việc làm" 링크 실제 화면 검증~~ — 완료(위 새 절 4번
  참고, Claude in Chrome 재연결 후 실제 기업 계정 로그인 화면으로 확인).
- (이전부터 있던 항목, 계속 유지) korea_jobs 구조 통합 미결정(방금 "제일
  큰 안건"으로 뒤로 미룸), 기업 계정 헤더에 구직자 메뉴 링크 없음,
  `.git/hooks/post-commit` 자동 push 훅, `jobCategoryRules.ts` 제거 완료
  (DB 값이 유일한 진실 공급원), truyen_thong/y_te_dieu_duong 분류 규칙
  미검증(2026-09-20 재확인해도 여전히 실표본 0건 — 위 "다음 결정사항" 4번
  참고), PostJob.tsx에 소분류 선택 필드 없음.
- **근무기간(job_duration) 실데이터가 당장 0건**이라 급구 페이지 새 필터
  섹션은 한동안 "선택해도 결과가 안 줄어드는" 상태로 보일 수 있음 — 이건
  버그가 아니라 PostJob.tsx로 신규 등록이 쌓이길 기다려야 하는 정상 상태
  (work_period 때와 같은 논리, 사용자가 이미 승인한 방향).

## 다음 결정사항

1. ~~Giới tính/Độ tuổi 실제 데이터 연결~~ — 해결(2026-09-19). "실제로 작동
   하게 만들기"로 확정, gender_requirement/age_requirement 컬럼 추가 +
   필터 연결 완료(위 새 절 참고). 크롤러는 안 채우므로 PostJob.tsx 직접
   등록 공고에 값이 쌓이는 걸 계속 지켜볼 것.
2. ~~`0016_local_jobs_work_duration_draft.sql`~~ — 삭제 완료(2026-09-18).
   의도했던 두 개념(근무기간/고용형태)이 job_duration·work_period로 이미
   커버됨, 원본 데이터도 이 정보를 거의 안 줘서 실익 낮다고 판단.
3. ~~PostJob.tsx에 소분류 드롭다운 추가~~ — 해결(2026-09-19, 성별/연령
   작업과 같이 진행, 위 새 절 참고).
4. truyen_thong/y_te_dieu_duong 분류 규칙을 언제 실제 데이터로 재검증할지
   (2026-09-20 재확인: 현재 active category='khac' 55건 전수 재조사해도
   두 카테고리 매칭 0건, 이전과 동일 — "R&D 산업 연구직을 헬스케어로
   오분류하는지"도 같이 확인했는데 `_Y_TE_DIEU_DUONG` 정규식이 y tá/
   điều dưỡng/hộ lý 등 구체적 의료 용어만 매칭해서 오분류 없음 확인).
   여전히 실표본 0건이라 정규식 확장 여부는 보류 상태 유지.
   ~~"마케팅/PR이 truyen_thong에서 안 잡힌다"는 이슈~~ — **재조사 결과
   애초에 오분류가 아니었음이 확인돼 해결(2026-09-19, 위 새 절 참고)**.
   marketing/PR은 설계상 `van_phong`(사무직) 소관이고 대분류 라우팅은
   원래부터 정상이었으며, 실제로 비어있던 건 `office`의 marketing 소분류
   규칙뿐이라 그것만 추가함 — `truyen_thong`(영상제작/방송 스태프) 정규식
   자체는 건드리지 않음.
5. ~~지역/업종 2단 구조 확대~~ — Home/맞춤공고에 소분류 완료(2026-09-18).
   저장한 공고/지도는 원래 지역·업종 필터가 없던 화면이라 범위에서 제외
   (필요하면 별도 지시).
6. ~~`categoryVisuals.ts`에 신규 5개 대분류 전용 이미지 추가~~ — 해결
   (2026-09-20, 위 새 절 참고).
7. korea_jobs 통합 / 공개 구직자 검색 — **2026-09-19 재조사로 선택지 설명
   2곳 정정 후 옵션 2 실행 완료**(위 새 절 참고). 재조사 결과: `KoreaConsultModal`
   컴포넌트는 코드에 없었음(옵션 3 전제 오류), "저장한 공고"는 애초에
   DB 테이블이 아니라 localStorage라 옵션 2에 FK 자체가 불필요했음. 정정된
   내용 사용자에게 설명 후 "니 선택으로 가자"로 옵션 2(저장한 공고 확장)
   위임받아 구현·검증 완료.
   ~~2) 가벼운 통합(저장한 공고 기능 추가)~~ — 완료.
   남은 선택지(계속 보류, 착수 여부 미정):
   1) 현행 유지(조회+번역+외부 링크만, 리스크 없음)
   3) 상담 리드캡처 신규 제작(상세페이지에 이름/전화/희망공고 받는 폼 —
      기존 모달 확장이 아니라 처음부터 새로 만들어야 함, 새 DB 테이블
      1개 + RLS 필요, STRICT 절차 적용 대상)
   4) 전체 통합(local_jobs/applications와 스키마 합치기) — **korea_jobs엔
      애초에 `employer_id` 컬럼 자체가 없어서**(지역 사장님이 직접 올리는
      공고가 아니라 외부 수집 공고라서) "FK 재설계"보다 더 큼, 에이전시/
      고용주 계정 개념을 새로 발명해야 함. 실제 필요(에이전시 제휴 등)가
      생기기 전까진 계속 보류 권장.
   **중요 — 사용자가 2026-09-19에 명시적으로 언급**: "한국 사이트(korea_jobs
   쪽)는 나중에 비엣간반과 분리할 가능성이 많다." 확정된 결정은 아니지만,
   이 가능성이 있는 한 옵션 3/4처럼 local_jobs/applications 등 본체 스키마와
   더 깊게 엮는 방향은 **분리 시 다시 풀어내야 하는 결합**을 만드므로 더욱
   신중해야 한다. 오늘 구현한 옵션 2("저장한 공고" 확장)는 `localStorage`
   접두사(`kr-`)만 쓰고 DB 결합이 없어 분리돼도 관련 프론트 코드만 걷어내면
   되는 안전한 선택이었음 — 앞으로 korea_jobs 관련 기능을 추가할 때마다 이
   "분리 가능성"을 먼저 고려할 것(가능하면 로컬 상태/프론트 레벨에서 해결,
   본체 DB 스키마와 엮는 선택은 분리 결정이 확정되기 전까진 지양).
8. ~~`applications_insert`의 tautology 조건 수정~~ — 해결(2026-09-20, 위
   새 절 참고, 보안 관련 수정이라 트랜잭션 시뮬레이션으로 검증까지 완료).
9. ~~기업 계정 헤더에 "Việc làm" 링크 추가~~ — 구현·배포·화면 검증 전부
   완료(2026-09-20, 위 새 절 참고).
10. ~~급구 페이지 첫 방문 시 지역 기본값이 Cần Thơ(공고 0건)인 문제~~ —
    해결(2026-09-19). "실제 공고 많은 지역으로 바꾸기" 대신 "지역 필터
    자체를 기본 미선택 상태로" 방식으로 확정 — 무필터 상태에서 전체 급구
    공고 목록이 바로 보임(위 새 절 참고).
11. ~~구/현 "전체 선택" 원클릭 필터, 지역 검색창에 구/현 이름 인덱싱~~ —
    둘 다 구현·배포 완료(2026-09-20, 위 새 절 참고).
12. ~~`backup-home-2026-09-18-workperiod-panel` 브랜치 재적용 여부~~ —
    해결(2026-09-20). 이미 다른 세션이 "Thời gian làm việc"/"Điều kiện
    khác" 패널을 `.jm-filter-row`(라벨-왼쪽/옵션-오른쪽)로 재구성해서
    같은 목표를 더 최신 상태로 이미 달성했음 확인 — 백업 브랜치는 12개
    대분류 개편 이전의 훨씬 오래된 버전이라 재적용하면 오히려 퇴행이라고
    판단, 완전히 중복이라 브랜치 삭제함(`git branch -D`, 로컬 전용이라
    원격에 영향 없음).
13. **알바몬 구조 벤치마킹 — 남은 항목**(2026-09-20, 위 세 새 절 참고):
    신뢰 정보 1단계(가입 데이터 기반 카드+사기방지 안내), 2단계 자가서약,
    헤더 메가메뉴 탐색축 세분화, 상세페이지 탭 구조까지 전부 완료. 남은
    항목은 아래 하나뿐:
    - ~~기업인증/근로계약서작성약속/4대보험 배지~~ — **자가서약형은 완료**
      (위 "신뢰 정보 2단계" 절 참고). **기업인증(관리자 실제 검증)만
      계속 보류** — 실제 employer 가입이 늘어야 검증할 대상이 생긴다는
      사용자 판단으로 지금은 착수 안 함(Mã số thuế 조회+AdminDashboard.tsx
      기존 브랜드 승인 패턴 재사용 방향까지는 정리됨, 착수 시점만 미정).
    - ~~헤더 메가메뉴 탐색축 세분화~~ — 완료(위 새 절 참고). "Theo thời
      gian"(기간별)/"Theo điều kiện"(근무조건별, Lương cao+자가서약 필터)
      2개 섹션 추가. 청소년/장년/장애인 같은 베트남에 안 맞는 대상별 축은
      의도적으로 제외.
    - ~~상세페이지 탭 구조~~ — 완료(위 새 절 참고). 근무조건/상세요강/
      기업정보 3탭, 사이드바는 탭과 무관하게 항상 노출.
    - 유료 노출 등급 구조(플래티넘-VIP 등)는 알바몬 수익모델이라 벤치마킹
      대상에서 제외하기로 확인됨(다시 논의 안 해도 됨).
14. ~~헤더 탭 클릭 시 드롭다운만 열리고 페이지 이동 안 하던 문제~~ — 해결
    (2026-09-20, 위 새 절 참고). 라벨/화살표 버튼 분리로 수정, master
    push+Production 배포+실사이트 확인까지 완료.
15. **기업용 "인재 검색" 기능(알바몬 "인재정보") 신설 여부** — 미정(위
    "남은 논의" 새 절 참고). 사용자가 알바몬 화면을 보여주며 우리 사이트에
    이 기능 자체가 없다는 걸 확인시켜줬으나, 착수할지/어떤 범위로 할지는
    전혀 정해지지 않음(AskUserQuestion 두 번 무응답). 다음에 사용자가
    먼저 언급 안 하면, 이 항목이 남아있다는 걸 먼저 상기시킬 것 — 착수하면
    구직자 개인정보 노출 동의 범위 재설계가 필요해 STRICT급 논의가 먼저
    필요하다는 점도 같이 상기.
16. ~~"알바몬처럼 각 상단 탭이 전용 공간으로 이동하는 구조"를 6개 섹션
    전부에 적용할지~~ — **"Công cụ" 하나만 먼저 채우는 걸로 확정**
    (2026-09-20, 위 "Công cụ 허브 페이지 신설" 새 절 참고). 알바몬 6개
    탭을 실제로 전부 클릭해본 결과 예외 없이 전용 페이지로 이동했지만,
    우리는 아직 그 정도 콘텐츠/트래픽이 없어 나머지 섹션(Việc làm/Thương
    hiệu/Cộng đồng/Hàn Quốc)은 이미 각자 전용 페이지가 있는 걸로 충분하다고
    판단 — 더 깊은 하위 페이지 구조는 실제 콘텐츠가 쌓이면 그때그때
    개별 판단하기로 사용자와 합의.
17. **"Gần tôi" 결과 화면을 지도 기반(카카오맵 스타일)으로 재설계 —
    다음 세션 최우선 작업으로 확정**(2026-09-20, 긴 대화 끝에 합의, 아직
    미착수). 경위:
    - "Dùng vị trí hiện tại" 옆에 "Tìm việc theo khu vực thay vào đó"
      버튼 + 오늘 새로 만든 주소 검색창까지 있으니 "이 자리에 요소가 너무
      많다/역할이 겹친다"는 지적 → 처음엔 "지역이동 버튼만 빼고 인기지역
      칩으로 채우자"고 제안했으나 "그래도 많이 빌 것 같다"는 반박 →
      "그럼 카카오맵처럼 지도로 크게 바꾸는 게 낫지 않냐"로 수렴.
    - **한 번 잘못된 제안을 했다가 사용자가 바로잡아준 것**: 급구
      페이지(Tuyển gấp)의 성/시→구/현→동/사 캐스케이딩 선택기를 Gần tôi에도
      재사용하자고 했다가, 사용자가 "그럼 Tuyển gấp이랑 완벽히 겹치네"로
      지적 — 맞는 지적이었음. Gần tôi는 애초에 행정구역 경계가 아니라
      좌표+반경(km) 기반이라 급구 페이지의 지역필터와 성격 자체가
      다르므로, 그 캐스케이딩 선택기를 가져오면 오히려 새로운 중복을
      만드는 것이었음 — 이 제안은 폐기.
    - **최종 확정 방향**: "검색(GPS 또는 주소 검색창, 오늘 이미 만든 것)
      → 지도가 뜨고 그 위에 주변 공고가 핀으로 자동 표시 → 핀 클릭 ↔
      리스트 카드 연동"(카카오맵/네이버맵/구글맵이 공통으로 쓰는
      검색+지도+리스트 3분할 패턴). 지도 엔진은 새로 안 만들고 기존
      [JobLocationMap.tsx](src/components/JobLocationMap.tsx)의
      `extraMarkers`(공고 상세페이지에서 여러 근무지 마커 찍을 때 이미
      씀)를 그대로 확장해서 "내 주변 N개 공고 = 핀 N개"로 재사용하면 됨
      — Leaflet+Geoapify 그대로, 새 API/키 불필요.
    - **구글맵 전환 논의도 같이 정리됨(결론: 지금은 안 바꿈)**: 크롤러
      지오코딩([crawler/geocode.py](crawler/geocode.py))부터 프론트
      지도 타일까지 이미 전부 Geoapify로 일관돼 있음을 git log로 재확인
      (`ae3c5b4` 커밋 — 원래 OSM 쓰다가 일부 네트워크에서 OSM 타일 서버가
      막혀서 "무료 티어로도 상업적 사용 공식 허용"하는 Geoapify로 전환한
      것). 구글은 결제카드 등록 필수+사용량 과금이라 지금 단계에서 바꿀
      이유 없음, 품질 문제가 실제로 드러나면 그때 재검토하기로 함.
    - ~~아직 구현 안 함~~ — **같은 세션에 바로 착수, 1차 버전 완료**(위
      "Gần tôi" 결과를 지도+핀으로 표시" 새 절 참고). 검색+지도+핀 클릭→
      상세이동까지는 됨, 핀↔카드 양방향 하이라이트만 남음.
