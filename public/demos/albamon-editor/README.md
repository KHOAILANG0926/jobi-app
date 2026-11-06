# 알바몬 기준 상세모집요강 편집기 — 독립 데모

2026-11-07 (Asia/Bangkok). 기존 JOBI 공고 등록/상세/운영 DB는 수정하지 않았다.

## 실행

프로젝트 루트에서 `python3 -m http.server 8093 --bind 127.0.0.1` 실행 후
`http://127.0.0.1:8093/public/demos/albamon-editor/index.html`을 연다.
Vite 개발/Preview/배포에서는 `/demos/albamon-editor/index.html`로 연다.
외부 라이브러리, API 키, 로그인, 네트워크 이미지 없이 동작한다.

## 구현 내용

사용자가 제공한 알바몬 화면의 상단 3개 탭, 좌측 242px 설정 패널, 우측 직접 편집 화면을 기준으로 구성했다.
- 간편 템플릿: 6개 배치 변형, 12색, 회사명/제목/회사소개, 모집분야 표와 행 추가/삭제.
- 로고/모집부문/근무조건/지원조건/접수방법/담당자 항목 표시/숨김. 숨겨도 입력값은 유지.
- 사용자 항목 추가/제목·내용 편집/삭제.
- 자유 에디터: 제목, 굵게, 기울임, 밑줄, 목록, 정렬, 글자색, 표, 링크/이미지 HTTPS 주소 삽입, 실행 취소/다시 실행.
- 에디터 내부 HTML 모드와 별도 직접입력 탭은 같은 자유 편집 문서를 공유한다.
- 템플릿 입력 내용과 자유 편집 문서는 각각 보존한다. 자유 편집을 템플릿으로 역변환하지 않는다.
- PC/390px 모바일 미리보기, 안전한 HTML 복사, 반응형 설정 패널.
- 그림/로고는 자체 SVG/JOBI. 알바몬의 사진/로고나 78개 원본 템플릿을 가져오지 않았다.

## 기존 앱 연결 지점 (아직 연결하지 않음)

`src/pages/PostJob.tsx`의 마지막 `Mô tả công việc` 섹션이 입력 연결 위치다.
기존 `composeDescription()`은 텍스트를 만들어 `baseFields.description`에 저장하므로
이 값을 HTML로 바로 교체하면 기존 상세 파서/검사와 호환되지 않는다.
기존 description(업무·조건·공식 직종 근거용 텍스트)은 유지하고, 별도 문서 데이터와
정제된 HTML의 저장/수정/조회 계약을 먼저 연결해야 한다.
DB 스키마/권한 변경은 저장소 규칙대로 승인된 migration+production_check 경로를 사용한다.
상세의 승인된 상단 카드/근무조건/모집조건/근무지역 틀은 그대로 두고 상세요강 안에만 표시한다.
운영 연결 시 한국어 UI는 기존 앱의 베트남어 문구 체계에 맞춘다.

### 데모 API

같은 출처의 iframe 또는 독립 페이지 안에서 다음 API를 쓸 수 있다.

```js
const doc = window.JobEditor.getDocument(); // version:1 JSON, activeMode 포함
const html = window.JobEditor.getHTML();    // 현재 모드의 정제된 HTML
window.JobEditor.setDocument(doc);          // 저장한 문서로 복원
// 문서가 바뀔 때마다 같은 document에서 발생
// event.detail은 JSON 사본이며 richHTML도 정제된다.
document.addEventListener('job-editor:change', event => {
  // 실제 앱 연결 시 인증된 저장 API로 전달. 데모는 저장 요청을 하지 않는다.
  console.log(event.detail.version);
});
```

문서: template/color/showLogo/company/title/intro/roleHead/dutyHead/roles[]/sections[]/bodies/custom[]/richHTML/activeMode.
저장/자동저장/DB 요청/브라우저 영구 저장은 구현하지 않았다. 새로고침하면 작성 내용이 사라진다.
HTML 복사는 클립보드 권한이 필요하며 실패하면 직접입력 탭에서 수동 복사할 수 있다.

## 보안 경계

HTML·붙여넣기는 태그/속성/스타일 허용 목록으로 정제하고 스크립트, 이벤트, SVG, iframe, 위험 URL을 제거한다.
미리보기는 빈 sandbox 속성의 iframe과 CSP로 스크립트 실행/부모 접근을 차단한다.
URL 이미지는 제3자 서버 요청이므로 no-referrer를 적용한다. 실제 업로드/Storage는 연결하지 않았다.
운영 저장 시 서버에서도 독립적으로 HTML을 정제해야 한다. 브라우저 정제만을 신뢰하지 않는다.

## 직접 검증

Chromium CDP 브라우저 테스트 `scripts/demo/albamon-editor.browser.mjs`:
템플릿 변경 후 입력 보존, 색상, 모집행, 항목 추가, rich/HTML 동기화, 악성 HTML 제거,
sandbox PC/모바일 미리보기, 390px 바깥 가로 넘침 없음, JSON API 저장/복원 검증.

```sh
# 별도 터미널에서 Chromium을 전용 임시 프로필과 로컬 디버깅 포트로 실행
chromium --headless --no-sandbox --disable-dev-shm-usage --remote-debugging-port=9222 --user-data-dir=/tmp/jobi-editor-chrome about:blank
# HTTP 서버 실행 후
node scripts/demo/albamon-editor.browser.mjs
# Vite Preview/원격 데모 검사 시 EDITOR_URL을 지정할 수 있다.
```

참고 자료: https://www.albamon.com/service-center/notice/4634 (2025-01-08 공식 3개 탭 안내).
로그인 후 원본 편집기의 전체 기능과 78개 템플릿은 직접 조작 검증하지 못했다.
