import Link from "next/link";

export type MatchDetailItem = { id: string; playedAt: string; partners: string[]; opponents: string[]; scores: [number, number][]; where: { label: string; href: string | null } };

/** One match from the player's side: who with, who against, the score, the date and where. */
export function MatchDetailRow({ match, marker }: { match: MatchDetailItem; marker: React.ReactNode }) {
  const mine = match.scores.reduce((total, [points]) => total + points, 0);
  const theirs = match.scores.reduce((total, [, points]) => total + points, 0);
  return (
    <li className="flex gap-3 py-3">
      {marker}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate text-sm font-bold">{match.partners.length ? `With ${match.partners.join(" & ")} ` : ""}<span className="font-normal text-[var(--ink-soft)]">vs</span> {match.opponents.join(" & ")}</p>
          <p className={`shrink-0 text-sm font-black ${mine > theirs ? "text-[var(--lime)]" : mine < theirs ? "text-[var(--coral)]" : ""}`}>{match.scores.map(([own, other]) => `${own}-${other}`).join(", ")}</p>
        </div>
        <p className="mt-0.5 truncate text-xs text-[var(--ink-soft)]">
          {new Date(match.playedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {match.where.href ? <Link href={match.where.href} className="hover:text-[var(--lime-deep)] hover:underline">{match.where.label}</Link> : match.where.label}
        </p>
      </div>
    </li>
  );
}
