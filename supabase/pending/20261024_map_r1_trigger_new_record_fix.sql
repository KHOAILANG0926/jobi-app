-- PENDING ONLY. Do not apply to production until explicit DDL approval.
-- map_r1_on_job_saved() currently dereferences NEW.job_id for local_jobs INSERT.
-- In PL/pgSQL, separate IF branches avoid referencing fields absent from NEW.
CREATE OR REPLACE FUNCTION public.map_r1_on_job_saved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'job_work_locations' THEN
    PERFORM public.map_r1_request_location(NEW.job_id);
  ELSIF TG_TABLE_NAME = 'local_jobs' THEN
    PERFORM public.map_r1_request_location(NEW.id);
  ELSE
    RAISE EXCEPTION 'Unexpected map R1 trigger table: %', TG_TABLE_NAME;
  END IF;
  RETURN NULL;
END
$function$;
