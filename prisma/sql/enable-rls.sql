-- Row-Level Security for every table in the public schema (run in the Supabase SQL editor).
--
-- The app reads and writes through Prisma as the `postgres` role, which bypasses RLS, so this
-- changes nothing for the app. What it closes is Supabase's auto-generated REST API: with RLS off,
-- anyone holding the public anon key (it ships in every page) could read, edit, or delete a table.
-- With RLS on and no policies, that API returns nothing.
--
-- `prisma db push` creates new tables with RLS OFF -- add a line here for each new table and run it.
-- (Plain statements on purpose: the Supabase SQL editor mis-parsed $$-quoted blocks.)
-- Applied Oct 2026; the other 32 tables already had RLS on.

ALTER TABLE public."AchievementUnlock" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AvailabilityOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AvailabilityPoll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AvailabilityVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LeagueTeam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LeagueTeamMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MonthlyAward" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PlayerOfTheWeek" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecurringSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RecurringScheduleMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoundRobinMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TournamentAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TournamentSponsor" ENABLE ROW LEVEL SECURITY;
