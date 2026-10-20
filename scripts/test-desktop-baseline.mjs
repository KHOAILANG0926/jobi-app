// Compare restored PC sources to immutable pre-mobile source hashes, allowing import redirects only.
// 2026-10-21: JobDetail.tsx — 상세 지도 핀을 메인 지도와 같은 점으로(Lee: '핀 위치가 안 맞는다, 큰 문제').
// 2026-10-20 밤: LayoutDesktop.tsx 메뉴 업종 링크를 실제 업종 값으로 고침(Lee: 'Sản xuất 눌렀는데 안 나와').
// 2026-10-20: JobDetail.tsx·index.css·DesktopHomeMapExplorer.tsx 기준값을 Lee 지시 변경(#148 근무조건 줄, #161 길찾기, #163·#165 상세요강, 첫 방문 위치 허용 창) 반영값으로 갱신. master에서 이미 #148 이후 기준값과 달랐음(이 검사가 홈 파일 PR에서만 돌아 못 잡음).
// 2026-10-18: JobDetail.tsx·index.css 기준값을 Lee 지시 변경(PR #136·#137·#138·#140·#145·#146) 반영값으로 갱신. 상세 화면 틀은 이제 도면(결정 0005)으로도 검사.
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const baseline = [
  {
    "path": "src/pages/HomeDesktop.tsx",
    "sha256": "59dbf57675ad272b13278a0fe6bdd2742803ef9b9bfc043b7ca1adae81b2ec9a",
    "restore": [
      [
        "../components/home/DesktopHomeMapExplorer",
        "../components/home/HomeMapExplorer"
      ]
    ]
  },
  {
    "path": "src/components/LayoutDesktop.tsx",
    "sha256": "7801572f6f3b93dad17efee2413203b46ec63d625cc3084066a0a1c6edff1ad4",
    "restore": []
  },
  {
    "path": "src/components/home/DesktopHomeMapExplorer.tsx",
    "sha256": "110a7b4f68459d849c483bb5cd768dc9cb6f1018c2b3f931682167cad63c8630",
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
    "sha256": "e16e24a6a7fd66836d125d1ec0e65176e58666bd40ae1c09a19fb9dbf9ed80ab",
    "restore": []
  },
  {
    "path": "src/index.css",
    "sha256": "dc4151fb39a4c66d72e7b1cd6e0bdfe5285f3a3b0ea514ca069f028c36bbc916",
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
