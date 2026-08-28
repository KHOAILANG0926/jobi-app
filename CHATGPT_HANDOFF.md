# ChatGPT ↔ Claude Code 인수인계 문서

## 현재 작업

`fix/jobdetail-map-and-description` 브랜치(master 기준)에서 JobDetail의 두 가지 문제를
고쳤다: ① 지도가 실제로는 정상 서비스인데도 타일 1개만 실패해도 전체가
"Không thể tải bản đồ."로 바뀌던 코드 버그, ② 원문 중간의 빈 줄(예: "Ưu tiên:" 서브
리스트) 때문에 MÔ TẢ/YÊU CẦU/QUYỀN LỢI 한 섹션이 여러 개의 카드로 쪼개지던 파싱 버그.
지도 provider는 바꾸지 않았다(아래 원인 참고 — 바꿀 이유가 없음이 확인됨). 사이드바/
회사정보/리뷰/Home/DB는 무변경.

작업 상태:

- `IMPLEMENTED`: 완료
- `VERIFIED`: `npx tsc --noEmit`, `npm run build` 통과. 실제 운영 데이터 2건
  (`sb-2987`, `sb-3665`)으로 본문 카드 수 확인(각 3개, section=card 확인), desktop+
  mobile(375px) overflow 없음 확인. 지도 타일 자체의 시각적 렌더링은 이 환경에서 검증
  불가(아래 "지도 원인" 참고 — 이 환경만의 로컬 DNS 차단, 코드/OSM 문제 아님).
- `DEPLOYED`: 완료 — master merge·push, Vercel 배포 성공.

## 문제 1 — 지도: 실제 원인

**결론: OSM tile 공급 자체는 정상이다. 문제는 우리 tileerror 처리 코드였다.**

조사 과정(추측 없이 직접 확인):
1. 이 환경의 Browser 도구에서 `tile.openstreetmap.org` 요청이 전부
   `net::ERR_FAILED`로 실패 — 이것만 보면 "OSM이 문제"로 오판하기 쉬움.
2. 그런데 **완전히 다른 네트워크 경로**(Bash 셸의 `curl`/`nslookup`, Browser 도구와
   무관)로도 동일하게 `tile.openstreetmap.org`/`nominatim.openstreetmap.org`
   DNS 조회가 "Non-existent domain"으로 실패했다. 반면 같은 셸에서 google.com/
   viecganban.vn/github.com/supabase.co는 전부 정상 응답.
3. 이 로컬 DNS 실패의 응답 주체가 `192.168.1.1`(로컬 공유기)인 것으로 보아,
   **이 컴퓨터/네트워크 자체가 openstreetmap.org를 DNS 레벨에서 막고 있다** —
   Anthropic 검증 도구나 OSM 서비스 문제가 아니라 이 로컬 환경만의 제약.
4. 결정적 증거: `nslookup tile.openstreetmap.org 8.8.8.8`(구글 공개 DNS로 직접 질의)
   로는 정상적으로 Fastly CDN IP(`151.101.x.x`)가 나왔고, 그 IP로 `curl --resolve`
   직접 접속해 실제 타일 PNG(200 OK, 256×256 유효 이미지)를 성공적으로 받아왔다 —
   **OSM 타일 서버는 지금 이 순간 정상적으로 타일을 서비스하고 있음을 직접 확인**.
5. 별개로 코드를 읽어보니, 기존 `JobLocationMap.tsx`는 `tiles.on('tileerror', ...)`
   콜백에서 **단 1개의 타일만 실패해도** 즉시 `setTileError(true)`를 호출해 지도
   전체를 안내 문구로 바꿔버리는 구조였다. 지도 하나를 채우려면 보통 4~9개의 타일이
   필요한데, 그중 하나만(네트워크 일시 지연 등으로) 실패해도 나머지가 멀쩡히 로드
   중이었어도 전체가 사라지는 구조 — 이 자체가 실사용자 환경에서도 지도가 유독 자주
   "실패"로 보이게 만드는 진짜 코드 결함이었다.

즉 사용자 지시의 A/B 분기 중 **A(우리 코드/처리 문제)에 해당** — provider를 바꾸지
않았다.

## 문제 1 — 지도: 수정 내용

`src/components/JobLocationMap.tsx`: 타일 레이어에 `tileload`/`load` 리스너를 추가해
로드된 타일 수를 센다. `setTileError(true)`는 더 이상 `tileerror` 콜백에서 즉시
호출되지 않고, Leaflet의 `load` 이벤트(그 화면에 필요한 모든 타일이 성공/실패로 다
"정산"된 시점에 발생)가 왔을 때 **성공한 타일이 단 하나도 없을 때만** 호출하도록
바꿨다. 즉 "타일 1개 실패, 나머지는 성공"이면 지도는 그대로 보이고(그 한 칸만
비거나 재시도됨, Leaflet 표준 동작), "타일이 전부 실패"할 때만 안내 문구로 대체한다.
`referrerPolicy` 설정(이전 작업분)과 위치 우선순위(exact/region/default) 로직,
`Xem bản đồ` 관련 UI는 전혀 손대지 않았다.

## 문제 2 — 본문 카드 분리: 실제 원인

`DescriptionRenderer`(`src/pages/JobDetail.tsx`)가 원문 전체를 `text.split(/\n\n+/)`
(빈 줄 기준)로 먼저 쪼갠 뒤, `## `로 시작하지 않는 조각은 전부 독립된 흰 카드로
그렸다. 문제는 크롤러 원문이 **하나의 `## Yêu cầu công việc` 섹션 안에서도** 빈 줄을
여러 번 넣는 경우가 실제로 있다는 것 — 예를 들어 운영 데이터 `sb-2987`은
"...theo giờ vận hành của trung tâm thương mại.\n\n\xa0\n\nƯu tiên:\n\n-Có kinh
nghiệm..." 처럼 같은 "Yêu cầu công việc" 섹션 중간에 빈 줄(및 nbsp만 있는 줄) →
"Ưu tiên:" 소제목 → 다시 빈 줄 → 불릿 목록이 이어진다. 기존 코드는 이걸 전부 별도
블록으로 쪼개 각각 카드로 그렸다 — 사용자가 캡처로 보여준 "문장마다 카드" 현상의
실제 원인.

## 문제 2 — 본문 카드 분리: 수정 내용

`DescriptionRenderer`의 분할 기준을 "빈 줄"에서 "`## ` 제목 줄"로 바꿨다: 원문에
`## ` 제목이 하나라도 있으면 `text.split(/(?=^## )/m)`(제목 줄 바로 앞에서만 분할)를
쓴다 — 한 제목부터 다음 제목 전까지는 그 안에 빈 줄이 몇 개 있든 통째로 한 블록(=한
카드)이 된다. `## ` 제목이 아예 없는(구조화 안 된) 원문은 기존처럼 빈 줄 기준 분할을
그대로 유지했다(이번 신고 범위 밖, 회귀 방지). 각 카드 내부의 불릿/문단 렌더링 로직,
Quyền lợi 혜택 chip 추출 로직은 그대로 재사용 — chip 추출은 이제 섹션 전체 텍스트를
보므로 예전에 섹션이 쪼개져 있을 때보다 오히려 더 정확해졌다(부수 효과, 별도 요청
아님). 원문 텍스트 자체는 한 글자도 수정/요약/생성하지 않았다 — trim만 적용.

## 검증

- `npx tsc --noEmit`, `npm run build`: 각 1회 통과.
- **본문 — `sb-2987`**(실제 "Ưu tiên:" 빈줄 케이스): 카드 3개(Mô tả/Yêu cầu/Quyền lợi)
  정확히 확인. "Yêu cầu công việc" 카드 안에 "Ưu tiên"·"Visual Merchandising" 텍스트가
  누락 없이 포함됨을 확인(콘텐츠 유실 없음). "Quyền lợi" chip 3개(BHXH/BHYT, Thưởng,
  Đào tạo) 원문과 일치.
- **본문+지도 — `sb-3665`**(location에 "Hà Nội" 포함, region-only): 카드 3개 동일 확인.
  지도 영역: 주소 "Hà Nội" 포함 텍스트 표시, 안내문 "Vị trí hiển thị là vị trí gần đúng
  theo khu vực tuyển dụng." 정상(위치 우선순위 로직 그대로 동작 확인).
- **모바일(375px)**: `sb-3665` 기준 가로 overflow 없음(scrollWidth 375 = innerWidth).
- 지도 타일의 실제 시각적 렌더링(초록/회색 지형 이미지가 보이는지)은 이 환경에서
  검증 불가 — 위 "지도 원인" 3~4번에서 설명한 로컬 DNS 차단 때문. `tileError` 상태
  자체는 (모든 타일이 로컬에서 도달 불가하므로) 여전히 `true`로 뜨는데, 이는 새 로직이
  "정말로 타일이 하나도 안 왔을 때만 fallback"이라는 조건을 정확히 만족한 것 — 새
  코드가 잘못됐다는 뜻이 아니라, 이 환경 자체가 "0개 성공" 케이스이기 때문.

## Production 확인

- viecganban.vn 배포 후 대표 화면 확인은 아래 최종 보고 참고. 이 세션의 검증 도구는
  로컬과 동일한 네트워크 제약이 있어 실제 사용자가 보는 타일 렌더링은 여전히 직접
  확인하지 못했다 — 코드 원인 조사(§문제 1)로 그 한계를 대체했다.

## 발견된 문제

- 없음(신규). 이 세션의 검증 환경이 `openstreetmap.org`를 DNS 레벨에서 차단하고
  있다는 사실 자체는 앞으로도 이 종류의 검증(지도 타일 시각 확인)마다 반복해서
  마주칠 제약이니 참고.

## 다음 결정사항

- `fix/scroll-restore-lazy-race`(커밋 `0c11f0a`)는 여전히 별도 브랜치, master 병합
  여부 미결정(이번 작업과 무관).
- 실사용자 리포트로 지도가 계속 안 보인다는 피드백이 (이번 fallback 로직 수정 이후에도)
  계속 들어오면, 그때는 실제로 provider를 재검토할 근거가 될 수 있음 — 다만 지금은
  그런 근거가 없다.
