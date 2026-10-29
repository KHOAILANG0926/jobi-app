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
    "sha256": "87b75498e1bab9e7f50411e31ad028f334627ffc7ff768f13144c68ef2f8f1d6",
    "restore": []
  },
  {
    "path": "src/components/home/DesktopHomeMapExplorer.tsx",
    "sha256": "4ab250005407b0b03ac745a35df52738abbc39617c9ec2d185db33757be0a5ae",
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
    "sha256": "892c98a2d52e763867a91119ee80e2a58a84120ed447285123e58035607328a4",
    "restore": []
  }
]
baseline.push(...[
  {
    "path": "src/pages/JobDetail.tsx",
    "sha256": "b8fae37d63115af0476f64d0cc0b2675dde76da7c1ad0ffcad5c7856d3b46e19",
    "restore": []
  },
  {
    "path": "src/index.css",
    "sha256": "aa6015de2bd36f01be603cb690177c52674edfb2d3f76179e54c5be138b92282",
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
