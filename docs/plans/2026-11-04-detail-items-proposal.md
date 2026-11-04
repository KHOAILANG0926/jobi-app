# 공고 상세 항목 정리안 — 2026-11-04 (Lee 결정 대기)

Lee가 받은 엑셀: 상세페이지_항목목록_20261104.xlsx(현재), 상세페이지_항목목록_최종안_20261104.xlsx(제안). 같은 내용을 여기 글로 남김.
Lee 지적: "각 항목마다 번호가 있고 앞에꺼 없으면 순서가 앞당겨지는 형식", "중복이나 뺄 거 아니면 추가할 거".
10-30 확정 목록(CLAUDE.md "공고 상세페이지 구성")을 바꾸는 일이라 Lee "예" 후에만 구현.

## 지금(운영 코드 e196ce2)
- ① 근무조건: 왼쪽 칸 고정(Mức lương·Phụ cấp·Thời hạn·Ngày làm việc·Thời gian) / 오른쪽 칸 고정(Ngành nghề PC만·Hình thức·Ca làm việc·Cuối tuần·Phúc lợi PC만). 한쪽이 비면 빈자리 → PR #462가 "한쪽이 비면 반씩 나눔"으로 임시 처리(Lee 승인 없이 반영, Lee 지적. 아래 ①로 교체 예정).
- ② 모집조건: Vị trí·Hạn nộp·Số lượng·Độ tuổi·Đối tượng tuyển·Giới tính·Học vấn·Kinh nghiệm·Yêu cầu khác(예전 3건만)·Hồ sơ·Ngoại ngữ·Đi công tác·Ngành nghề(휴대폰만). 순서대로, 없으면 당김.
- ③ 근무지역: 주소(1곳만)·지도·길찾기. ④ 상세요강 01~08, 없으면 당김.
- PC만/휴대폰만 차이는 PR #138(10-18 "PC만" 지시) 때 생겨 휴대폰을 안 맞춘 채 남은 것.

## 제안(최종)
① 근무조건 — PC 두 줄씩(왼→오), 휴대폰 한 줄씩, 앞이 없으면 당김, PC·휴대폰 같은 항목
1 Lương(수당·지급방식은 아래 작은 글씨) 2 Phụ cấp·Thưởng 3 Thời gian làm việc(Ca làm việc 합침) 4 Ngày làm việc(Cuối tuần 합침) 5 Thời hạn 6 Hình thức 7 Ngành nghề 8 Phúc lợi
② 모집조건 — 1 Vị trí tuyển dụng 2 Hạn nộp hồ sơ 3 Số lượng tuyển 4 Độ tuổi 5 Giới tính 6 Học vấn 7 Kinh nghiệm·Ưu tiên
③ 근무지역 — 1 Địa chỉ(여러 곳이면 모두, 예: Dookki 3곳) 2 지도·핀 3 길찾기
④ 상세요강 — 그대로 8칸(지원 자격에 외국어·출장, 채용 절차에 제출 서류 포함)

빼기·옮기기·합치기: ② Ngành nghề(①과 중복)·Đối tượng tuyển(나이·성별 중복)·Yêu cầu khác(상세요강 지원 자격 중복) 빼기 / Hồ sơ→④ 채용 절차, Ngoại ngữ·Đi công tác→④ 지원 자격 / ① Ca làm việc→Thời gian, Cuối tuần→Ngày làm việc.
KDA(sb-4824)·예전 3건(4878·4879·4982)은 그대로.
