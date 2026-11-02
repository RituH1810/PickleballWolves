-- Anonymous Good Wolf (sportsmanship) votes (run in the Supabase SQL editor). Added Nov 2 2026.
CREATE TABLE IF NOT EXISTS public."GoodWolfVote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "roundRobinId" TEXT NOT NULL,
  "voterId" TEXT NOT NULL,
  "nomineeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "GoodWolfVote_roundRobinId_voterId_key" ON public."GoodWolfVote"("roundRobinId", "voterId");
CREATE INDEX IF NOT EXISTS "GoodWolfVote_nomineeId_idx" ON public."GoodWolfVote"("nomineeId");
ALTER TABLE public."GoodWolfVote" ENABLE ROW LEVEL SECURITY;
