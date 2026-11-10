// 2026-11-08: index.css — Lee "적용해도 괜찮아"(데모 A안): 휴대폰(≤640px)에서만 정렬 줄(JobsListToolbar) 칸이 넘치면 아래 줄로. PC 틀·CSS 동작 변경 없음(폭 1280 정렬 줄 위치·크기 수정 전후 같음).
// 2026-11-09: JobDetail.tsx·index.css — Lee "2번"(#579): 연락처 없을 때만 PC 안내 상자를 제목 줄에 띄우지 않고 흐름에 둠(표·지도 겹침 고침). 연락처 있을 때 Gọi/Zalo 배치·모바일·KDA 틀 변경 없음.
// 2026-11-09: JobDetail.tsx — Lee "적용"(demo/legacy-frame): 예전 Quyền lợi 틀 3건(sb-4878·4879·4982)을 새 4칸 틀로 합치고 그 틀 전용 코드 삭제. KDA 틀·데이터 변경 없음.
// 2026-11-08: JobDetail.tsx — Lee B안("B로 바꾸고"·"마무리먼저"): 간편 템플릿으로 쓴 공고는 ④ 상세요강을 템플릿 모양 그대로(description_html), 추가 고용형태 이름. 다른 칸·KDA 틀 변경 없음.
// 2026-11-08: JobDetail.tsx — Lee "3 적용": 공고 등록 미리보기용 previewJob 입력(/xem-truoc-tin, 단추 막힘·안내 한 줄). 공개 상세 화면 틀 변경 없음.
// 2026-11-08: JobDetail.tsx — Lee "운영 링크만 빼고 통일": 문구 속 이름 Việc Gần Bạn → Việc gần Bạn(글자만). 틀 변경 없음.
// 2026-11-08: LayoutDesktop.tsx — Lee "로고는 하나로 맞춰 브라우저 탭으로": 머리 줄 로고 글자 Việcganban → Việc gần Bạn. 틀 변경 없음.
// 2026-11-08: LayoutDesktop.tsx — Lee 지시("메인 화면만 빼고 다 적용"): 머리 줄·메뉴·바닥 알바몬 기준(검색 칸, 메뉴 이모지 빼기·4칸 배열, 바닥 SiteFooter). 메인 본문·공고 카드·상세 변경 없음. (#542 메뉴·바닥 링크 추가로 master가 이미 달랐음)
// 2026-11-07: 기준값 갱신 — LayoutDesktop.tsx는 #520(Lee 승인: 브랜드 로고 그림 우선, 메뉴 로고 그림)으로 master가 이미 달랐음. 이번 PR(#531 카드 상호 2줄·지점 지역 줄)은 이 파일을 바꾸지 않음.
// 2026-11-06: JobDetail.tsx·index.css — Lee 데모 적용(demo/contact-separate): 4칸 중 한 칸이 통째로 없으면 상자를 빼고 아래 칸이 올라옴. Gọi·Zalo 버튼은 상자와 별도로 원래 위쪽 자리 그대로. KDA·예전 틀 변경 없음.
// 2026-11-05 Lee PC 흰 화면 오류: WebGL 초기화 예외를 잡고 비WebGL 2D 지도로 전환. 정상 PC 틀/CSS 변경 없음.
// 2026-11-05 Lee 요청: 상세 상단 대표 사진 클릭 확대. 기존 슬롯 치수·간격·하단 사진 유지.
// 2026-11-04 Lee 명시 지시: 대표 이미지 공통 순서에 images[0] 추가. 상세 하단 사진·레이아웃·CSS 변경 없음.
// 2026-11-04: JobDetail.tsx — Lee "왼쪽 자리 왜 비운거지?": 최신 틀 근무조건 칸 한쪽이 비면 보이는 항목을 두 칸에 나눔. KDA·예전 틀 변경 없음.
// 2026-11-03: DesktopHomeMapExplorer.tsx — Lee "거리재는 거 어디 갔냐, 그냥 보이게 해": 반경 칸 항상 표시(고르면 거리 검색 켜짐). 위치 칸 펼침 메뉴·중복 Gần tôi 제거(Lee "꼭 필요한 거야?" → 진행). 다른 PC 틀 변경 없음.
// 2026-11-03: LayoutDesktop.tsx·DesktopHomeMapExplorer.tsx·index.css — Lee 지시: PC 메인 왼쪽 칸 위치·급여만("거리하고 기본 금액만"), 메뉴 "Theo khu vực" 34개 성·급구 → 지역별 일자리(/viec-lam/khu-vuc), 지역별 페이지 전용 CSS(.jm-urgent-page 아래)·지도. 공고 카드·상세 틀 변경 없음.
// 2026-11-04: JobDetail.tsx·index.css — Lee 지시("데모를 좀 먼저 보자"): 최신 4칸 틀(.jd2-page--v2)만 디자인 정리(상자 높이·간격·테두리·급여 크기·상세요강·보험 짧은 표시, 여러 직무 급여 직무|금액 두 칸). KDA·예전 틀 변경 없음.
// 2026-11-03: JobDetail.tsx — Lee 지시("오케이 진행", #440): 여러 직무 공고 근무조건 급여 칸에 직무별 금액 줄(원문 그대로, 최대 3줄). 칸 순서·위치·머리 카드 등 PC 틀 변경 없음.
// 2026-11-03: JobDetail.tsx·index.css — Lee 지시(11-03 "123수정"): 급여 아래 상여·수당 줄 작은 회색 글씨·금액과 정렬(#415), 식비 수당 이름 Phụ cấp ăn·아이콘 중복 태그 숨김(#415·#416). 칸 순서·위치 등 PC 틀 변경 없음. 기준값 갱신이 늦어 master가 이미 달랐음(이 검사는 홈 파일 PR에서만 돎).
// 2026-11-01: index.css — Lee "수평 전개": 급여 표시 한 곳(SalaryText) 색 규칙 추가. PC 틀 변경 없음.
// 2026-11-01: JobDetail.tsx — Lee 지시(브랜드 로고 수평 전개): 등록 브랜드 공고는 로고 자리에 브랜드 공식 사이트 아이콘. 틀 변경 없음.
// 2026-11-01: 기준값 갱신 — master가 이미 달랐음(이 검사는 모바일 홈 파일 PR에서만 돌아 못 잡음): LayoutDesktop.tsx(#403 브랜드 로고 흰 바탕), JobDetail.tsx(#397 오토바이가 핀을 따라감), HomeDesktop·DesktopHomeMap*(이미 병합된 PR). index.css는 이번 PR(#407 Lee 적용: 공고 카드 급여 한 줄·단위 색, 모바일 목록 같은 규칙) 포함. PC 틀 변경은 카드 급여 줄 글자·색뿐.
// 2026-10-30: JobDetail.tsx — Lee 적용: 상단 복리후생 아이콘 7종 움직임(있는 것만, 칸 PC 52px·휴대폰 44px).
// 2026-10-30: JobDetail.tsx — Lee 지시: 비공개 공고를 관리자만 같은 상세 화면으로 미리 보기(맨 위 비공개 안내). 공개 화면 틀 변경 없음.
// 2026-10-30: JobDetail.tsx — Lee 지시(신규부터): 새 공고는 #4828 4칸 틀, 기존 공개 공고·KDA 그대로.
// 2026-10-30: JobDetail.tsx — Lee 지시: 근무지 1곳 위치 확정 공고 길찾기 버튼을 기준(KDA)처럼 지도 아래로.
// 2026-10-30: JobDetail.tsx — Lee 지시: 위치 확정 공고 길찾기도 기준(KDA) Google 버튼 하나로(예전 작은 버튼 두 개 제거). 다른 틀 변경 없음.
// 2026-10-30: index.css — Lee: 모든 지도 핀 한 모양(대략 위치 색 구분 없앰, 정확도는 글로).
// 2026-10-30: index.css — Lee 데모 1번 확정: 지도 핀을 빨간 물방울 + 흰 점으로(압정 모양 대체). 지도 외 변경 없음.
// 2026-10-30: index.css — Lee 지시 지도 핀 📍 압정 모양(메인·상세, PC·휴대폰 공통). 지도 외 화면 CSS 변경 없음.
// 2026-10-30: JobDetail.tsx — Lee "알바몬처럼"(먼저 sb-4828만): Quyền lợi 없이 근무조건에 받는 것 복사, 상세요강 원문 전체.
// 2026-10-29: JobDetail.tsx — Lee 결정 상세페이지 새 구성(CLAUDE.md "공고 상세페이지 구성 확정"): ② Quyền lợi 추가, 근무조건은 일하는 방식만, 02 지원 자격→모집조건. 기준 공고 sb-4824(KDA)는 기존 틀 유지.
// 2026-10-29: JobDetail.tsx 기준값을 이미 병합된 #282(Lee 승인 복수직무 표시, db2d4b8) 값으로 맞춤 — master가 이미 달랐음(이 검사는 홈 파일 PR에서만 돌아 못 잡음). 이번 PR은 JobDetail.tsx를 바꾸지 않음.
// 2026-10-29: HomeDesktop.tsx — Lee 지시("PC는 4열로 밑으로"): PC 추천 공고 4개만, 나머지는 전체 결과 4칸 목록으로. 모바일·카드 틀 변경 없음.
// 2026-10-27: LayoutDesktop freeze refreshed to already-approved master PR #273 (same source; no layout edit here).
// 2026-10-27: PR #277 / docs/plans/2026-10-26-location-single-source.md final review approved
// DesktopHomeMapExplorer canonical-only reads, DesktopGeoapify marker provenance and JobDetail canonical pins.
// index.css hash also follows approved PR #273 / 6affdc2 (HEAD equals trusted master; no CSS edit).
// HomeDesktop/canvas/apply.css freezes remain intact; all exact hash checks stay enabled.
// 2026-10-22: Lee 최종 선택 2번 — 급여 티켓(선택 금액·사각 금액표·일급/시급·협의), 검색 기준 유지.
// 2026-10-22: Lee 승인 — 급여로 찾기에 일급·시급/협의 추가, 월 금액은 공고 월급 기준.
// 2026-10-22: Lee 확정 — 월 기본급만 검색, 6/8/10/12/15M 구간. 최대 총급여 기준 폐기.
// 2026-10-22: Lee 데모 수정 — 빈 조건에서도 기존 공고 유지, 급여 버튼 재클릭 유지·명시된 최대/기본 월급만 비교.
// 2026-10-22: Lee 요청 — 기간·계약/보험 조건을 메인 공고 목록 상단으로 이동. 카드·지도 틀 유지.
// 2026-10-22: Lee 승인 — 기간별/계약·사회보험 메뉴를 급구가 아닌 전체 공고 검색으로 연결. 메뉴 모양·다른 링크 유지.
// 2026-10-22: Lee 요청 — 요약 클릭 검색 결과를 지도 바로 아래·추천 영역 위로 이동. 반경 직접 입력 단위는 m로 변경.
// 2026-10-22: Lee 요청 — PC 지도 반경을 km 숫자로 입력하고 Enter/입력칸 이탈 시 적용(기존 슬라이더·빠른 버튼 유지).
// 2026-10-22: Lee 요청 — 지도 요약 업종 클릭을 유료 추천과 독립된 하단 결과·선택 해제·20개 페이지·스크롤에 연결(데모, 데이터 축적 후 테스트).
// 2026-10-22: Lee 요청 데모 — PC 지도 오른쪽 공고 목록을 현재 화면·반경의 업종 요약으로 변경. 모바일·카드 틀 유지.
// 2026-10-21: Lee 반경 검색 수정 — 대표 위치 포함 결과 문구를 실제 필터와 일치.
// 2026-10-21: Lee 2~5번 — 지도 정확도·점 선택·직선거리 제거, PC 화면 안 공고 목록, 핀 창 B안(데모만).
// 2026-10-21: fix/fit-after-pins — 위치 다음에 도착한 핀 재조정만 변경, PC JSX/CSS 변경 없음.
// Compare restored PC sources to immutable pre-mobile source hashes, allowing import redirects only.
// 2026-10-21: JobDetail.tsx — 상세 지도 핀을 메인 지도와 같은 점으로(Lee: '핀 위치가 안 맞는다, 큰 문제').
// 2026-10-21: index.css — 위치 창 안내 한 줄(Lee 지시).
// 2026-10-21: DesktopHomeMapExplorer.tsx — 내 위치를 켜면 가까운 공고 핀까지 보이게(Lee '메인 화면에 핀이 없어').
// 2026-10-20 밤: LayoutDesktop.tsx 메뉴 업종 링크를 실제 업종 값으로 고침(Lee: 'Sản xuất 눌렀는데 안 나와').
// 2026-10-20: JobDetail.tsx·index.css·DesktopHomeMapExplorer.tsx 기준값을 Lee 지시 변경(#148 근무조건 줄, #161 길찾기, #163·#165 상세요강, 첫 방문 위치 허용 창) 반영값으로 갱신. master에서 이미 #148 이후 기준값과 달랐음(이 검사가 홈 파일 PR에서만 돌아 못 잡음).
// 2026-10-18: JobDetail.tsx·index.css 기준값을 Lee 지시 변경(PR #136·#137·#138·#140·#145·#146) 반영값으로 갱신. 상세 화면 틀은 이제 도면(결정 0005)으로도 검사.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const baseline = [
  {
    "path": "src/pages/HomeDesktop.tsx",
    "sha256": "2e7e8b6b0427498001bf0e95a5ebb57c1b414c17ef863882ce7de463dc6bf25f",
    "restore": [
      [
        "../components/home/DesktopHomeMapExplorer",
        "../components/home/HomeMapExplorer"
      ]
    ]
  },
  {
    "path": "src/components/LayoutDesktop.tsx",
    "sha256": "8d5ece123728f3c5d10f7be9d3ce9cd06b4a546a1c14f4a2dc14a49386316a61",
    "restore": []
  },
  {
    "path": "src/components/home/DesktopHomeMapExplorer.tsx",
    "sha256": "1d31ed7c817dbd0327e2ae6c7e3068e8dae7405de311c391134ed027cc152ab9",
    "restore": [
      [
        "'./DesktopHomeMapCanvas'",
        "'./HomeMapCanvas'"
      ]
    ]
  },
  {
    "path": "src/components/home/DesktopHomeMapCanvas.tsx",
    "sha256": "3a5f55476b9df0ab17c71d281af42e4dfd159a9c017a1c02a15adeabca65d7ef",
    "restore": [
      [
        "'./map/DesktopGeoapifyMapCanvas'",
        "'./map/GeoapifyMapCanvas'"
      ]
    ]
  },
  {
    "path": "src/components/home/map/DesktopGeoapifyMapCanvas.tsx",
    "sha256": "b1fe33c02596e1ba80be63cfab82e06aef2f799630897c756887bff6de226c47",
    "restore": []
  }
]
baseline.push(...[
  {
    "path": "src/pages/JobDetail.tsx",
    "sha256": "26f47e482bc4bbb3ccbfdc227fda8bb2d7fbc4f342213d6468faa1dee7c64e99",
    "restore": []
  },
  {
    "path": "src/index.css",
    "sha256": "2edfa0185aaf33a0c4128401ed510a87d70a7c4f48a0a663d39f0380f4639be8",
    "restore": []
  },
  {
    "path": "src/components/apply.css",
    "sha256": "c8f499748176a4ae8ae08c0b2e1bae9ee12239fb7b62225d16af661d10ab244e",
    "restore": []
  }
])

for (const file of baseline) {
  let source = readFileSync(file.path, 'utf8')
  for (const [from, to] of file.restore) source = source.replaceAll(from, to)
  assert.equal(createHash('sha256').update(source).digest('hex'), file.sha256, file.path)
}
console.log(`Exact pre-mobile desktop baseline: ${baseline.length}/${baseline.length} source files match`)
