-- Schema-only metadata captured read-only from production 2026-10-26.
-- All columns/generated PostGIS fields and scoped real constraints; no row data.
-- Unrelated publication/signal/net hooks are excluded and listed in README.
create extension postgis;
create extension unaccent;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.admin_audit_logs (id bigint generated always as identity not null,admin_user_id uuid not null,action text not null,target_type text not null,target_id text not null,metadata jsonb default '{}'::jsonb not null,created_at timestamp with time zone default now() not null);
create table public.admin_confirmed_location_memory (source_candidate_id bigint not null,address_key text not null,company_key text not null,park_key text,lat double precision not null,lng double precision not null,place_precision text not null,approved_by uuid not null,approved_at timestamp with time zone not null,source_address text not null,active boolean default true not null);
create table public.job_location_candidates (id bigint generated always as identity not null,job_id bigint not null,work_location_id bigint,company_snapshot text not null,address_snapshot text not null,lat double precision not null,lng double precision not null,place_precision text not null,source text not null,evidence text not null,evidence_urls text[] default '{}'::text[] not null,status text default 'pending'::text not null,review_note text,reviewed_by uuid,reviewed_at timestamp with time zone,created_by uuid,created_at timestamp with time zone default now() not null);
create table public.job_work_locations (id bigint generated always as identity not null,job_id bigint not null,raw_address text not null,normalized_address text,country text default 'VN'::text not null,province text,district text,ward text,lat double precision,lng double precision,geog geography(Point,4326) generated always as (
CASE
    WHEN ((lat IS NOT NULL) AND (lng IS NOT NULL)) THEN (st_setsrid(st_makepoint(lng, lat), 4326))::geography
    ELSE NULL::geography
END) stored,geocode_status text default 'pending'::text not null,geocode_source text,location_verified boolean default false not null,sort_order integer default 0 not null,created_at timestamp with time zone default now() not null,updated_at timestamp with time zone default now() not null,address_accuracy text,coordinate_accuracy text,address_evidence text,matched_recruitment_regions text[],resolved_province text,resolved_wards text[],verification_method text,industrial_park text,shuttle_route text);
create table public.local_jobs (id bigint generated always as identity not null,title text not null,company text not null,category text default 'other'::text,salary text,location text,hours text,employer_phone text,application_deadline date,urgent boolean default false,description text,posted_at date default CURRENT_DATE,lat numeric,lng numeric,active boolean default true,created_at timestamp with time zone default now(),image_url text,source text,work_period text,work_days text,education text,preference text,num_hires text,company_verified boolean default false,company_founded_year integer,hire_count integer,images jsonb,employer_id uuid,origin text default 'legacy'::text not null,admin_hidden boolean default false not null,source_url text,crawler_version text,last_verified_at timestamp with time zone,publish_gate_reason text,recruitment_regions text[],subcategory text,job_duration text,gender_requirement text,age_requirement text,labor_contract_pledge boolean,social_insurance_pledge boolean,guest_manage_token text,salary_min integer,salary_max integer,salary_currency text,salary_period text,salary_negotiable boolean,shift_type text,work_start_time time without time zone,work_end_time time without time zone,shuttle_bus boolean,dormitory boolean,meal_provided boolean,immediate_start boolean,recruitment_type text,work_schedule text,weekend_work boolean,salary_basis text,salary_note text,employment_type text,rotating_shifts smallint,benefit_tags text[],required_documents text,contact_zalo text,language_requirement text,business_trip boolean,policy_decision text,source_text text,ocr_text text,ocr_check jsonb,contact_name text,age_min smallint,age_max smallint,occupation_code text,occupation_evidence text,updated_at timestamp with time zone);
create table public.map_r1_location_jobs (job_id bigint not null,snapshot jsonb not null,search_key text not null,state text not null,calls integer default 0 not null,failures integer default 0 not null,lease uuid,updated_at timestamp with time zone default now() not null,result jsonb);
create table public.map_r1_search_history (job_id bigint not null,search_key text not null,search_input jsonb not null,calls integer default 0 not null,failures integer default 0 not null,result jsonb,updated_at timestamp with time zone default now() not null);
alter table job_work_locations add constraint job_work_locations_pkey PRIMARY KEY (id);
alter table local_jobs add constraint local_jobs_pkey PRIMARY KEY (id);
alter table admin_confirmed_location_memory add constraint admin_confirmed_location_memory_pkey PRIMARY KEY (source_candidate_id);
alter table map_r1_search_history add constraint map_r1_search_history_pkey PRIMARY KEY (job_id, search_key);
alter table map_r1_location_jobs add constraint map_r1_location_jobs_pkey PRIMARY KEY (job_id);
alter table job_location_candidates add constraint job_location_candidates_pkey PRIMARY KEY (id);
alter table admin_audit_logs add constraint admin_audit_logs_pkey PRIMARY KEY (id);
alter table local_jobs add constraint local_jobs_salary_currency_check CHECK (((salary_currency IS NULL) OR (salary_currency = ANY (ARRAY['VND'::text, 'USD'::text]))));
alter table local_jobs add constraint local_jobs_salary_min_max_check CHECK (((salary_min IS NULL) OR (salary_max IS NULL) OR (salary_min <= salary_max)));
alter table local_jobs add constraint local_jobs_salary_period_check CHECK (((salary_period IS NULL) OR (salary_period = ANY (ARRAY['hour'::text, 'day'::text, 'month'::text, 'other'::text]))));
alter table local_jobs add constraint local_jobs_shift_type_check CHECK (((shift_type IS NULL) OR (shift_type = ANY (ARRAY['day'::text, 'night'::text, 'rotating'::text, 'other'::text]))));
alter table local_jobs add constraint local_jobs_work_schedule_check CHECK (((work_schedule IS NULL) OR (work_schedule = ANY (ARRAY['5_days'::text, '6_days'::text, 'other'::text]))));
alter table job_work_locations add constraint job_work_locations_address_accuracy_check CHECK ((address_accuracy = ANY (ARRAY['exact_text'::text, 'region_only'::text, 'undetermined'::text])));
alter table job_work_locations add constraint job_work_locations_coordinate_accuracy_check CHECK ((coordinate_accuracy = ANY (ARRAY['exact'::text, 'ward'::text, 'region'::text, 'unresolved'::text])));
alter table job_work_locations add constraint job_work_locations_geocode_status_check CHECK ((geocode_status = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'manual'::text])));
alter table job_work_locations add constraint job_work_locations_job_normaddr_key UNIQUE (job_id, normalized_address);
alter table job_work_locations add constraint job_work_locations_verification_method_check CHECK (((verification_method IS NULL) OR (verification_method = ANY (ARRAY['source_coordinate'::text, 'admin_approved'::text, 'poster_pin'::text]))));
alter table job_location_candidates add constraint job_location_candidates_address_snapshot_check CHECK ((length(TRIM(BOTH FROM address_snapshot)) > 0));
alter table job_location_candidates add constraint job_location_candidates_area_not_approvable CHECK (((status <> 'approved'::text) OR (place_precision = ANY (ARRAY['entrance'::text, 'building'::text, 'site'::text]))));
alter table job_location_candidates add constraint job_location_candidates_company_snapshot_check CHECK ((length(TRIM(BOTH FROM company_snapshot)) > 0));
alter table local_jobs add constraint local_jobs_age_range_check CHECK ((((age_min IS NULL) OR ((age_min >= 0) AND (age_min <= 100))) AND ((age_max IS NULL) OR ((age_max >= 0) AND (age_max <= 100)))));
alter table job_location_candidates add constraint job_location_candidates_evidence_check CHECK ((length(TRIM(BOTH FROM evidence)) > 0));
alter table local_jobs add constraint local_jobs_employment_type_check CHECK ((employment_type = ANY (ARRAY['full_time'::text, 'seasonal'::text, 'part_time'::text])));
alter table local_jobs add constraint local_jobs_origin_check CHECK ((origin = ANY (ARRAY['crawler'::text, 'employer'::text, 'admin'::text, 'legacy'::text])));
alter table local_jobs add constraint local_jobs_publish_gate_reason_check CHECK (((publish_gate_reason = ANY (ARRAY['ok'::text, 'no_address_text'::text, 'no_verified_coordinate'::text, 'no_application_path'::text])) OR (publish_gate_reason IS NULL)));
alter table local_jobs add constraint local_jobs_recruitment_type_check CHECK (((recruitment_type IS NULL) OR (recruitment_type = ANY (ARRAY['direct'::text, 'agency'::text, 'unknown'::text]))));
alter table local_jobs add constraint local_jobs_rotating_shifts_check CHECK ((rotating_shifts = ANY (ARRAY[2, 3])));
alter table local_jobs add constraint local_jobs_salary_basis_check CHECK ((salary_basis = ANY (ARRAY['base'::text, 'total_with_overtime'::text])));
alter table job_location_candidates add constraint job_location_candidates_lat_check CHECK (((lat >= (8)::double precision) AND (lat <= (24)::double precision)));
alter table job_location_candidates add constraint job_location_candidates_lng_check CHECK (((lng >= (102)::double precision) AND (lng <= (110)::double precision)));
alter table job_location_candidates add constraint job_location_candidates_place_precision_check CHECK ((place_precision = ANY (ARRAY['entrance'::text, 'building'::text, 'site'::text, 'area'::text])));
alter table job_location_candidates add constraint job_location_candidates_source_check CHECK ((source = ANY (ARRAY['company_official'::text, 'map_listing'::text, 'original_post'::text, 'site_visit'::text, 'other'::text])));
alter table job_location_candidates add constraint job_location_candidates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'revoked'::text])));
alter table map_r1_location_jobs add constraint map_r1_location_jobs_calls_check CHECK (((calls >= 0) AND (calls <= 2)));
alter table map_r1_location_jobs add constraint map_r1_location_jobs_state_check CHECK ((state = ANY (ARRAY['processing'::text, 'done'::text, 'failed'::text, 'deferred'::text])));
alter table map_r1_search_history add constraint map_r1_search_history_calls_check CHECK (((calls >= 0) AND (calls <= 2)));
alter table job_location_candidates add constraint job_location_candidates_work_location_id_fkey FOREIGN KEY (work_location_id) REFERENCES job_work_locations(id) ON DELETE SET NULL;
alter table job_location_candidates add constraint job_location_candidates_job_id_fkey FOREIGN KEY (job_id) REFERENCES local_jobs(id) ON DELETE CASCADE;
alter table map_r1_search_history add constraint map_r1_search_history_job_id_fkey FOREIGN KEY (job_id) REFERENCES local_jobs(id) ON DELETE CASCADE;
alter table map_r1_location_jobs add constraint map_r1_location_jobs_job_id_fkey FOREIGN KEY (job_id) REFERENCES local_jobs(id) ON DELETE CASCADE;
alter table job_location_candidates add constraint job_location_candidates_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
alter table job_work_locations add constraint job_work_locations_job_id_fkey FOREIGN KEY (job_id) REFERENCES local_jobs(id) ON DELETE CASCADE;
alter table job_location_candidates add constraint job_location_candidates_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
alter table admin_audit_logs add constraint admin_audit_logs_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES auth.users(id);
alter table local_jobs add constraint local_jobs_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES auth.users(id);

