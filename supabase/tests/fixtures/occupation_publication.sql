-- Isolated PostgreSQL test database ONLY. Never run against Production.
create role anon;
create role authenticated;
create table public.occupation_master(code text primary key, level smallint);
insert into public.occupation_master values ('82022',5),('7212',4),('82',2);
create table public.local_jobs (
 id integer primary key, title text, description text, source_text text,
 occupation_code text references public.occupation_master(code), occupation_evidence text,
 active boolean default false, admin_hidden boolean default false
);
insert into public.local_jobs(id,source_text,active) values(100,'Làm trên ĐT + Máy tính',true);
insert into public.local_jobs(id,source_text,occupation_code,occupation_evidence,active)
 values(101,'Làm ngồi linh kiện tai nghe','82022','làm linh kiện tai nghe',true);

create table public.job_posting_rules(rule_key text unique,content text,decided_on date,incidents text,machine_checkable text,block_mode text,implementation text);
