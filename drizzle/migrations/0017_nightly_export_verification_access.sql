GRANT EXECUTE ON FUNCTION public.daily_export_candidates(uuid,date) TO sandbox_exec;
GRANT EXECUTE ON FUNCTION public.save_missing_nightly_exports(timestamptz) TO sandbox_exec;