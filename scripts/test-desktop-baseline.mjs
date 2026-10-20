// Compare restored PC sources to immutable pre-mobile source hashes, allowing import redirects only.
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
    "sha256": "adf14427edb4bfaa8318cf7487d824d51603a8684397794be0255d4ee86d9c52",
    "restore": []
  },
  {
    "path": "src/components/home/DesktopHomeMapExplorer.tsx",
    "sha256": "92482ca2cf005d49aa368c9da99265e0c92d4c03add04c8a501d4a31bdcc65b2",
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
    "sha256": "2c2268ae32c6dfc37fe03aff780b8e065c2c3347a8e6058119eb610ad8e8b687",
    "restore": []
  },
  {
    "path": "src/index.css",
    "sha256": "400138b734e1a441ca246843ffccd936c305069d55402c7c1a942bef7721865c",
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
