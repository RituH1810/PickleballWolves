-- Playing style tags (run in the Supabase SQL editor). Added Nov 1 2026.
CREATE TABLE IF NOT EXISTS public."PlayStyle" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "side" TEXT,
  "shots" TEXT,
  "pace" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public."PlayStyle" ENABLE ROW LEVEL SECURITY;
