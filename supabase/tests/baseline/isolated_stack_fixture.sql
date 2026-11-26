-- 격리 실제 스택 E2E(scripts/ops/isolated-stack-e2e.mjs)용 고정 공고 1건. 격리 DB에서만 쓰며 psql -v employer_id=<고용주 uuid> 로 받는다.
-- 등록 관문(ingest_job·직업분류 판정)은 별도 시험이 검증하므로, 여기선 사용자 트리거를 잠시 끄고 공개 조회·지원 흐름에 필요한 한 줄만 둔다.
alter table public.local_jobs disable trigger user;
insert into public.local_jobs (title, company, category, location, employer_phone, active, origin, publish_gate_reason, source_text, description, lat, lng, occupation_code, occupation_evidence, employer_id)
values ('E2E Isolated Role', 'E2E Isolated Co', 'dich_vu', 'KCN Yên Phong, Bắc Ninh', '0912345678', true, 'employer', 'ok', 'E2E Isolated Co tuyen nhan vien', 'E2E', 21.2, 106.0, '5', 'NHÂN VIÊN CHẠY BÀN', :'employer_id') returning id;
alter table public.local_jobs enable trigger user;
