// One-time repair: recalculates every player's skill rating by replaying all rated matches, oldest
// first, with the current rating rules (lib/rating.ts) and current scores. Fixes ratings left wrong
// by corrected scores, deleted matches and one-decimal rounding.
//
//   npx tsx prisma/recalculate-ratings.ts                   dry run: prints old -> new, writes nothing
//   npx tsx prisma/recalculate-ratings.ts --apply           writes the new ratings and rating history
//   add --ignore-manual to drop ratings players typed in on their profile between matches
//
// Needs DATABASE_URL, and the three-decimal rating columns applied (npx prisma db push) first.
import { PrismaClient } from "@prisma/client";
import { replayRatings, type ReplayMatch } from "../src/lib/rating";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const ignoreManual = process.argv.includes("--ignore-manual");
// Stored ratings used to round to one decimal, so a gap this small between one match's "after" and
// the next match's "before" is rounding, not a manual change.
const ROUNDING_GAP = 0.06;

async function main() {
  const rows = await prisma.ratingHistory.findMany({ where: { ladderId: null, matchId: { not: null } }, orderBy: { createdAt: "asc" } });
  const matchIds = [...new Set(rows.map((row) => row.matchId!))];
  const loaded = await prisma.match.findMany({ where: { id: { in: matchIds } }, select: { id: true, deletedAt: true, players: { select: { userId: true, side: true } }, scores: { select: { sideAScore: true, sideBScore: true } } } });
  const byId = new Map(loaded.map((match) => [match.id, match]));
  // In the order they were first rated; deleted matches no longer count.
  const matches: ReplayMatch[] = matchIds.map((id) => byId.get(id)).filter((match) => match && !match.deletedAt).map((match) => ({ id: match!.id, players: match!.players, scores: match!.scores }));

  // Each player starts from the rating they had before their first rated match. A jump between one
  // match's "after" and the next match's "before" is a rating they set themselves in between.
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, name: true, skillRating: true } });
  const nameOf = new Map(users.map((user) => [user.id, user.name]));
  const starting = new Map<string, number>();
  const lastAfter = new Map<string, number>();
  const adjustments = new Map<string, Map<string, number>>();
  const manual: string[] = [];
  for (const row of rows) {
    const before = Number(row.ratingBefore);
    if (!starting.has(row.userId)) starting.set(row.userId, before);
    else if (Math.abs(before - lastAfter.get(row.userId)!) > ROUNDING_GAP) {
      const offset = before - lastAfter.get(row.userId)!;
      manual.push(`${nameOf.get(row.userId) ?? row.userId}: ${offset > 0 ? "+" : ""}${offset.toFixed(2)} before match ${row.matchId}`);
      if (!ignoreManual) adjustments.set(row.matchId!, new Map([...(adjustments.get(row.matchId!) ?? []), [row.userId, offset]]));
    }
    lastAfter.set(row.userId, Number(row.ratingAfter));
  }

  const { ratings, changes } = replayRatings(starting, matches, adjustments);
  // A rating typed in after a player's last match is kept as an offset too, unless --ignore-manual.
  for (const user of users) {
    const trailing = Number(user.skillRating) - (lastAfter.get(user.id) ?? Number(user.skillRating));
    if (Math.abs(trailing) > ROUNDING_GAP) {
      manual.push(`${user.name}: ${trailing > 0 ? "+" : ""}${trailing.toFixed(2)} after their last match`);
      if (!ignoreManual) ratings.set(user.id, Math.min(6, Math.max(2, Math.round((ratings.get(user.id)! + trailing) * 1000) / 1000)));
    }
  }

  console.log(`${matches.length} rated matches (${matchIds.length - matches.length} deleted, dropped), ${users.length} players.\n`);
  if (manual.length) console.log(`Manual rating changes found (${ignoreManual ? "dropped" : "kept"}):\n  ${manual.join("\n  ")}\n`);
  for (const user of [...users].sort((a, b) => a.name.localeCompare(b.name))) {
    const now = Number(user.skillRating);
    const next = ratings.get(user.id)!;
    console.log(`${user.name.padEnd(28)} ${now.toFixed(3)} -> ${next.toFixed(3)}  (${next - now >= 0 ? "+" : ""}${(next - now).toFixed(3)})`);
  }
  if (!apply) { console.log("\nDry run -- nothing written. Re-run with --apply to save."); return; }

  // Rewrite each match's rating rows, keeping when they were first rated so history stays in order.
  const firstRatedAt = new Map<string, Date>();
  for (const row of rows) if (!firstRatedAt.has(row.matchId!)) firstRatedAt.set(row.matchId!, row.createdAt);
  await prisma.$transaction([
    prisma.ratingHistory.deleteMany({ where: { ladderId: null, matchId: { in: matchIds } } }),
    prisma.ratingHistory.createMany({ data: [...changes].flatMap(([matchId, matchChanges]) => matchChanges.map((change) => ({ userId: change.userId, matchId, ratingBefore: change.before, ratingAfter: change.after, ratingDelta: change.delta, createdAt: firstRatedAt.get(matchId)! }))) }),
    ...users.map((user) => prisma.user.update({ where: { id: user.id }, data: { skillRating: ratings.get(user.id)! } })),
  ]);
  console.log(`\nSaved ${users.length} ratings and ${[...changes.values()].flat().length} rating history rows.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
