// Recalculates every player's skill rating by replaying all rated matches, oldest first, with the
// current rules (src/lib/rating.ts). The app already does this on every score save or match
// deletion; this is for after changing the rules, or to preview the effect.
//
//   npx tsx --env-file=.env.local prisma/recalculate-ratings.ts           dry run: prints old -> new
//   npx tsx --env-file=.env.local prisma/recalculate-ratings.ts --apply   saves ratings and history
import { prisma } from "@/lib/prisma";
import { computeAllRatings } from "@/lib/load-rating-replay";
import { recomputeAllRatings } from "@/lib/recompute-ratings";

async function main() {
  const { ratings, changes, matchCount } = await computeAllRatings();
  const users = await prisma.user.findMany({ where: { id: { in: [...ratings.keys()] } }, select: { id: true, name: true, skillRating: true } });
  console.log(`${matchCount} matches, ${changes.length} rating changes`);
  for (const user of users.sort((a, b) => ratings.get(b.id)! - ratings.get(a.id)!)) {
    console.log(`${user.name.padEnd(24)} ${Number(user.skillRating).toFixed(3)} -> ${ratings.get(user.id)!.toFixed(3)}`);
  }
  if (!process.argv.includes("--apply")) { console.log("\nDry run -- nothing saved. Add --apply to save."); return; }
  await recomputeAllRatings();
  console.log("\nSaved.");
}

main().finally(() => prisma.$disconnect());
