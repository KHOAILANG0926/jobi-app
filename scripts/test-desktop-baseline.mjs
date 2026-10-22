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
    "sha256": "10bc053be18254be4d172cbb18d97d40a2a49d2c10b366559a28b78914c07de2",
    "restore": [
      [
        "../components/home/DesktopHomeMapExplorer",
        "../components/home/HomeMapExplorer"
      ]
    ]
  },
  {
    "path": "src/components/LayoutDesktop.tsx",
    "sha256": "bc7cc1cc1be0825120bc0cc7ab65a9f4a113bd9820858a016bf72c26c0ce7a27",
    "restore": []
  },
  {
    "path": "src/components/home/DesktopHomeMapExplorer.tsx",
    "sha256": "b6c629a4eeddde84c151de34310d11e9563ffd5184ff0625e73e1e9afec0bb72",
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
    "sha256": "7b1defc9f6d1f97d5e2cfe1d47475eec4988d49c52dd618cfe42852559bf7c78",
    "restore": []
  }
]
baseline.push(...[
  {
    "path": "src/pages/JobDetail.tsx",
    "sha256": "0ab7e52a21200e6472ca108187ea6d717edcdeae921f4d5c7f1e2ac5921a8bce",
    "restore": []
  },
  {
    "path": "src/index.css",
    "sha256": "0cb8b1b8bb6e61a441268302c7bc4c7200f21901fb24e43e23f2c354b752620c",
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
