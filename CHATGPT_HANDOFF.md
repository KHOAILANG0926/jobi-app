# CHATGPT_HANDOFF — 2026-10-30 21:35 (Claude 사용량 부족으로 GPT 인계)

## 1. 현재 상태 (코드·배포·DB)
- 오늘 운영 반영(모두 deploy-verify 통과): 관리자 위치 목록(#332 #333 #335 #336 #341), 메인 여러 직무 급여(#340), 길찾기 기준 버튼·지도 아래(#344 #346), 등록 화면 체크리스트·알바몬 디자인·시간 고르기·사진 자동 축소(#348 #354 #356), 새 공고 기본 틀=#4828 4칸(#358, 기존 4878·4879·4982·KDA는 그대로), 관리자 비공개 공고 보기(#360 Jobs 탭 "Xem nội dung", #361 관리자 로그인 시 /viec-lam/sb-번호 미리 보기), 움직이는 복리후생 아이콘 7종(#362), R7 기록 표시 시도(#364).
- **미병합 PR(검사 통과, 봇 병합 대기)**: #352 이 문서 이전판, **#365 Facebook 수집기 제목·회사·급여·주소 추출 수정(#5157 Highlands 원글 시험 포함)**.
- 공고 #5157(Highlands Coffee Mường Thanh Bắc Ninh, Facebook 그룹 timvieclamthembacninh 글 id:1468174108781393): 저장됨·**비공개**. 공고 검사표(이슈 #237): ❌ 포스터 대조(R7) mismatch, ❌ 빈 이름표("Cách nộp hồ sơ:" 등). 직업코드 5132·지도 정확은 통과. 잘못 저장된 값: 제목 "Vị trí tuyển dụng:", 회사에 주소 붙음, 급여 "cạnh tranh", 위치 "Khu vực làm việc, …"(원인: crawl_facebook.py 추출 규칙 — #365로 수정).
- **R7 불일치 항목은 아직 미확인**: local_jobs.ocr_check는 관리자 계정도 읽기 권한 없음(permission denied). 검사 로그 다운로드는 Claude 환경에서 차단. 다음 OCR 실행부터 불일치 항목이 GitHub 경고(::warning R7 보류)로 남음(#364).
- Facebook 쿠키는 Lee가 10-30 교체(작동 확인). 원글에는 포스터 있음(급여 26K/giờ, 7–9 triệu/tháng, 파트타임 7h–11h·18h–22h) — 저장된 공고 급여에는 반영 안 됨.

## 2. 다음 할 일 3개
1. #365 병합 확인 → crawl-facebook-one.yml dryrun(group=timvieclamthembacninh) → 같은 글(id:1468174108781393) save → #5157 값이 바뀌었는지 공고 검사표(이슈 #237 최신 댓글)로 확인. Lee 지시: **Highlands 1건만** 제대로(다른 후보 금지).
2. R7 원인 확정: 관리자용 ocr_check 읽기(DB migration, Lee 승인 필요) 또는 #5157 재검사. 추측으로 보고 금지 — 기록 근거로만.
3. 포스터 급여를 공고 칸에 채우는 방법 제안(Lee 확인 후), 빈 이름표 줄 제거 규칙. Muaban 수집기는 그다음.

## 3. 필수 규칙
- 운영 DB 직접 조회·SQL 금지(migration+production_check만). 공고 등록은 ingest_job만. 공고는 규칙·시험으로 고침, 번호 고정 금지.
- 원인은 추측하지 말고 코드 실행·기록으로 확인 후 보고([직접 확인]/[추정] 구분). Lee에게는 Vercel 링크 대신 캡처·운영 링크. 화면 변경은 글 모형 → Lee 확인 후.
- 데모 아이콘 원본: Claude 작업공간에만 있었음(사이트에는 src/lib/benefitIconArt.ts로 반영 완료).
