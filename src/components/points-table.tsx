import Link from "next/link";

export type PointsRow = { rank: number; userId: string; name: string; matches: number; wins: number; losses: number; winPct: number; scored: number; conceded: number; differential: number };

const RANK_COLORS: Record<number, string> = { 1: "text-[#f5c542]", 2: "text-[#c9d1d9]", 3: "text-[#d08a4f]" };

/**
 * A round robin's points table, ranked by wins then point difference (the standings order).
 * `compact` fits the narrow standings column: rank, player, W-L, +/- and win %. The full table adds
 * games played and points for and against (hidden on phones). The viewer's row is highlighted.
 */
export function PointsTable({ rows, compact = false, highlightUserId = null }: { rows: PointsRow[]; compact?: boolean; highlightUserId?: string | null }) {
  if (!rows.length) return <p className="text-sm text-[var(--ink-soft)]">No results yet.</p>;
  const diff = (value: number) => (value > 0 ? `+${value}` : String(value));
  const head = "pb-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--ink-soft)]";
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-[var(--line)]">
          <th className={`${head} w-7`}>#</th>
          <th className={head}>Player</th>
          {!compact && <th className={`${head} text-center`}>P</th>}
          {compact ? <th className={`${head} text-center`}>W-L</th> : <><th className={`${head} text-center`}>W</th><th className={`${head} text-center`}>L</th></>}
          {!compact && <><th className={`${head} hidden text-center sm:table-cell`}>PF</th><th className={`${head} hidden text-center sm:table-cell`}>PA</th></>}
          <th className={`${head} text-center`}>+/-</th>
          <th className={`${head} text-right`}>Win%</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.userId} className={`border-b border-[var(--line)] last:border-0 ${row.userId === highlightUserId ? "bg-[var(--success-bg)]" : ""}`}>
            <td className={`py-2.5 text-xs font-black ${RANK_COLORS[row.rank] ?? "text-[var(--ink-soft)]"}`}>{row.rank}</td>
            <td className="max-w-0 py-2.5 pr-2"><Link href={`/players/${row.userId}`} className="block truncate text-sm font-bold hover:text-[var(--lime-deep)] hover:underline">{row.name}</Link></td>
            {!compact && <td className="py-2.5 text-center text-xs font-semibold text-[var(--ink-soft)]">{row.matches}</td>}
            {compact ? <td className="py-2.5 text-center text-xs font-semibold whitespace-nowrap">{row.wins}-{row.losses}</td> : <><td className="py-2.5 text-center text-xs font-semibold">{row.wins}</td><td className="py-2.5 text-center text-xs font-semibold">{row.losses}</td></>}
            {!compact && <><td className="hidden py-2.5 text-center text-xs font-semibold sm:table-cell">{row.scored}</td><td className="hidden py-2.5 text-center text-xs font-semibold sm:table-cell">{row.conceded}</td></>}
            <td className={`py-2.5 text-center text-xs font-bold ${row.differential > 0 ? "text-[var(--lime-deep)]" : row.differential < 0 ? "text-[var(--coral)]" : "text-[var(--ink-soft)]"}`}>{diff(row.differential)}</td>
            <td className="py-2.5 text-right text-xs font-black text-[var(--lime-deep)]">{row.winPct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
