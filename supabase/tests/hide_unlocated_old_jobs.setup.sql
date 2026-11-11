-- 시험 DB 준비: 고정 시험 자료의 local_jobs에 숨김 칸과 대상 3건을 넣는다.
alter table public.local_jobs add column if not exists admin_hidden boolean not null default false;
alter table public.local_jobs add column if not exists active boolean not null default true;
insert into public.local_jobs(id, company, location) values (4828,null,'Bắc Ninh'),(5421,'Thanh Phệ','KCN Thuận Thành 3'),(5437,'DOOKKI','Bắc Ninh')
 on conflict (id) do nothing;
