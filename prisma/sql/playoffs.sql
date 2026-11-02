-- Night-end playoff rounds (run in the Supabase SQL editor). Added Nov 2 2026.
ALTER TABLE public."Round" ADD COLUMN IF NOT EXISTS "stage" TEXT;
