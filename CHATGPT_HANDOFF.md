# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/jobdetail-map-reliability` 브랜치(master 기준)에서 JobDetail 지도의 신뢰성 문제를
조사하고 수정했다. 이전 스냅샷까지는 지도가 `Xem bản đồ` 토글 뒤에 접혀 있었는데, 이번에
**항상 펼쳐진 상태로 변경**했고, OSM 타일이 최근(2026-03) 정책 변경으로 요구하게 된
`Referer` 헤더를 우리 쪽에서 명시적으로 보내도록 고쳤다. 위치 우선순위(exact/region/
default) 로직은 그대로 유지 — 다시 설계하지 않았다.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 로컬/Production 모두에서 DOM 레벨
  검증 완료(토글 제거, 항상 렌더링, overflow 없음, marker 자산 200 OK). 실제 타일 렌더링은
  아래 "남아 있는 제약" 참고.
- `DEPLOYED`: 진행 중 — 이 문서는 브랜치 커밋 시점 스냅샷이며, master merge·push·Vercel
  배포는 바로 이어서 진행한다.

## 변경 내용 (원인 조사 → 조치)

1. **`src/components/JobLocationMap.tsx`**
   - `L.tileLayer(...)`에 `referrerPolicy: 'strict-origin-when-cross-origin'` 추가.
     **원인**: OpenStreetMap Foundation이 2026년 3월부터 `tile.openstreetmap.org`에
     `Referer` 헤더가 없는 요청을 정책적으로 차단하기 시작했고([Leaflet/Leaflet#10156]
     (https://github.com/Leaflet/Leaflet/issues/10156)), 우리가 쓰는 Leaflet
     1.9.4는 이 옵션을 지원은 하지만(`referrerPolicy: false`가 기본값) 명시적으로 설정해
     주지 않으면 브라우저/환경의 기본 리퍼러 정책에 그대로 맡겨진다 — 즉 리퍼러가 어떤
     이유로든 비어 있는 환경에서는 타일이 차단될 수 있다. Leaflet을 업그레이드하지 않고도
     이미 설치된 버전(`node_modules/leaflet`)이 이 옵션을 지원함을 소스에서 직접 확인하고
     최소 변경으로 적용했다.
   - `map.invalidateSize()`를 mount 직후 `requestAnimationFrame`으로 한 번 호출하도록
     추가. 지도가 이제 페이지 로드 시 바로 렌더링되므로(토글 제거), 위쪽 콘텐츠 레이아웃이
     완전히 자리잡기 전에 Leaflet이 container 크기를 잘못 계산하는 고전적인 케이스를
     방지하는 방어적 조치(표준 Leaflet 권장 패턴).
2. **`src/pages/JobDetail.tsx`**: `Xem bản đồ` 토글 버튼과 `mapOpen` state를 제거 —
   "Khu vực làm việc" 카드가 열릴 때부터 지도를 바로 렌더링한다. `ChevronDown`(더 이상 안
   씀) import 제거.
3. **`src/index.css`**: 더 이상 쓰이지 않는 `.jd2-map-toggle`(라이트/다크 모드 규칙 포함)
   제거.
4. **위치 우선순위(exact/region/default) 로직은 미수정** — `resolveMapLocation()`,
   `MapCoordinateSource`, marker/안내문 분기 모두 이전 스냅샷 그대로.

## 대체 tile provider 조사 결과 — OSM 유지로 판단

- **CARTO**: 월 500만 타일까지 무료지만 API 키 발급이 필수(사용자 요구사항상 "API 키 필요한
  서비스는 후보로만" → 도입 보류).
- **Stadia Maps**: localhost 외 도메인에서는 계정/키 필요 → 후보로만.
- **OpenFreeMap**: API 키·가입·사용량 제한 없이 무료(Cloudflare 대역폭 후원) — 조건은 가장
  좋지만 **벡터 타일**만 제공해 지금의 raster 기반 `L.tileLayer`/Leaflet 구성과 호환되지
  않는다(쓰려면 MapLibre GL JS로 지도 렌더링 방식 자체를 바꿔야 함 — "단순 URL 교체"가 아닌
  아키텍처 변경). 향후 후보로 기록만 해두고 이번에 도입하지 않았다.
- 결론: 지금 겪은 문제는 (검증 도구 한정) 네트워크 차단 + (실사용자 전반에 잠재적으로 영향
  가능한) 리퍼러 정책 미준수였고, 후자는 코드로 고쳤다. OSM 자체의 ODbL 라이선스는 상업적
  사용에 문제 없고, 남은 실제 결함이 없어 **OSM을 primary로 유지**했다. 자동 fallback
  provider는 구현하지 않았다(조건에 맞는 raster 후보가 없었음).

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과.
- 로컬 dev 서버 `sb-3888`: 토글 없이 지도 카드가 바로 렌더링됨(`mapAutoRendered: true`),
  주소 "Hồ Chí Minh", 안내문 "Vị trí hiển thị là vị trí gần đúng theo khu vực tuyển dụng."
  정상. 데스크톱(1280px) 가로 overflow 없음(scrollWidth 1265 < 1280), 모바일(375px)도
  overflow 없음. marker 자산(`marker-icon(-2x)/shadow`) 전부 200 OK. 콘솔에 새 JS 에러
  없음(기존 tile 네트워크 실패 메시지만 존재).
- Production(viecganban.vn) `sb-3888`: 동일하게 토글 없이 지도 카드 바로 렌더링, 안내문
  정상 확인.

## 남아 있는 실제 제약

- **이 검증 도구(브라우저 자동화 샌드박스)는 `tile.openstreetmap.org`/
  `a.tile.openstreetmap.org`에 대한 네트워크 연결 자체가 막혀 있다** — `fetch()`로
  리퍼러 정책을 바꿔가며(있음/`strict-origin-when-cross-origin`/`no-referrer`) 직접
  테스트한 결과 모두 동일하게 `TypeError: Failed to fetch`(연결 자체가 성립하지 않음)로
  실패했고, 같은 페이지에서 다른 외부 도메인(`cdn1.vieclam24h.vn`, `google.com`)은 정상
  응답을 받았다 — 이는 HTTP 403 같은 정책 거부가 아니라 이 도구의 네트워크 경로에서
  `openstreetmap.org`로 가는 연결 자체가 차단되어 있다는 뜻이며, 리퍼러 헤더를 어떻게
  바꿔도 바뀌지 않는다(즉 이번에 고친 리퍼러 문제와는 별개의, 코드로 해결할 수 없는 이
  도구만의 네트워크 제약). 실제 사용자 브라우저는 이 제약과 무관하다.
  - 참고로 웹 검색으로 확인한 바, OSM은 2026-03부터 `Referer` 미포함 요청을 차단하는
    정책을 시행 중이며 이는 실제 사용자에게도 영향을 줄 수 있는 이슈였다 — 이번에 고친
    `referrerPolicy` 설정이 바로 이 부분에 대한 실질적 방어 조치다.
- **별개 항목**: `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`)는 이번 지도 작업에 섞지
  않고 그대로 별도 브랜치에 유지했다 — 아직 master 미병합.

## 다음 결정사항

1. 상세주소/구(district) 데이터나 geocoding이 실제로 필요해지면 `MapCoordinateSource`의
   `'address'`/`'district'`를 채우는 작업을 별도로 진행.
2. `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`) master merge를 별도로 승인/진행할지 결정.
3. 실제 타일 렌더링에 대한 육안 확인이 필요하면, 이 세션의 검증 도구가 아닌 다른 경로
   (예: 사용자의 일반 브라우저, 또는 다른 네트워크의 자동화 도구)로 한 번 확인하는 것을
   권장 — 이번 조사로 도구 자체의 네트워크 제약임이 상당히 뚜렷하게 확인됐다.
