# Android 앱 포장(TWA) 준비 — 2026-10-28

목표: 2026-10-30(금) Google Play 비공개 테스트 시작. 앱은 운영 사이트(https://www.viecganban.vn)를 그대로 여는 TWA(Trusted Web Activity)다. 화면 모양은 바꾸지 않는다.

## 1. 현재 PWA 준비 상태 (저장소 기준 [직접 확인], 운영 사이트는 이 세션에서 열리지 않음)
| 항목 | 상태 | 빠진 것 |
|---|---|---|
| manifest (`public/manifest.json`) | 이름 `Việc gần Bạn`, start_url `/`, display standalone, theme `#e53935`, 배경 흰색, 세로 고정 | **아이콘이 실제로는 2070×2048 한 장(`/logo.png`)인데 192·512로 적혀 있음** → 정사각 192·512 PNG와 maskable 512 필요. `id`·`scope` 없음 |
| 서비스워커 (`public/sw.js`) | 등록됨, 항상 네트워크(캐시 없음) | 오프라인 안내 화면 없음(필수 아님, 권장) |
| HTTPS | 운영 도메인 HTTPS([기존 기록] Vercel) | 없음 |
| 모바일 화면 | PR·운영 화면 검사(app-screen, deploy-verify)가 모바일 390px 통과 | 없음 |
| 사이트-앱 연결 | 없음 | **`/.well-known/assetlinks.json` 필요**(앱 서명 지문 들어감) |

## 2. TWA 포장 계획 (기술 단계 — Lee 승인 없이 진행)
- 앱 패키지 이름: `vn.viecganban.app` (한 번 정하면 바꿀 수 없음)
- 도구: Bubblewrap(구글 공식 TWA 도구). 빌드는 GitHub Actions 수동 실행 워크플로에서만. 산출물은 Play 업로드용 `.aab`.
- 서명: Play App Signing 사용(앱 서명 키는 구글이 보관). 우리가 가진 것은 **업로드 키**뿐이며 GitHub Secrets에만 둔다. PC에 저장하지 않는다. 업로드 키를 잃어도 Play Console에서 재설정 가능.
- 사이트-앱 연결: Play Console의 "앱 서명 키 SHA-256 지문"을 `public/.well-known/assetlinks.json`에 넣어 배포 → 주소창 없이 앱처럼 열림. 지문은 비밀이 아니다.
- 순서: ① manifest 아이콘 정리(192·512·maskable) ② TWA 설정 파일 + 빌드 워크플로 ③ 업로드 키 생성·Secrets 보관 ④ 첫 `.aab` 빌드 ⑤ Lee가 Play Console에 업로드·테스터 등록 ⑥ 앱 서명 지문으로 assetlinks.json 배포 ⑦ 테스트 기기에서 주소창 없이 열리는지 확인.

## 3. Lee가 직접 해야 하는 일 (쉬운 말)
1. **Play 개발자 계정 만들기** — play.google.com/console, 한 번만 25달러(신용·체크카드, 선불카드 안 됨). 본인 이름의 신분증과 카드로 본인 인증. 인증에 며칠 걸릴 수 있어 **오늘 바로 시작해야 10-30에 맞출 수 있음**.
2. **테스터 12명 모으기** — 안드로이드 폰을 쓰는 사람 12명 이상의 Gmail 주소 목록. Play Console 비공개 테스트에 이 목록을 넣고, 테스트 참여 링크를 보내 각자 "참여" 누르고 앱 설치.
3. **14일 규칙** — 2023-11-13 이후 만든 개인 계정은, 12명 이상이 14일 동안 끊김 없이 테스트에 참여해야 정식 출시 신청이 열림. 10-30 시작이면 정식 출시 신청은 빨라야 11-13 이후. 중간에 12명 아래로 떨어지면 다시 셀 수 있다는 안내도 있음(구글 공식 아님) → 여유 있게 15명 이상 권장.
4. 앱 업로드 키를 GitHub Secrets에 넣는 단계는 제가 준비해 드리는 한 번의 버튼 실행으로 끝나게 만들 예정(PC 저장 없음).

## 출처 (이번에 조회한 링크만)
- 12명·14일 규칙: https://support.google.com/googleplay/android-developer/answer/14151465
- 등록비·본인 인증: https://support.google.com/googleplay/android-developer/answer/6112435
