import type { HallOfFameRecord } from "./hall-of-fame";

/** Hall of Fame records worth a group-wide alert when beaten (the rest drift with every game). */
export const ALERT_RECORD_KEYS: HallOfFameRecord["key"][] = ["streak", "biggestWin", "bestNight", "undefeated"];

// Records whose detail adds something (the score, the night's record) beyond the value.
const DETAILED = new Set<HallOfFameRecord["key"]>(["biggestWin", "bestNight"]);

export type BrokenRecord = { record: HallOfFameRecord; previous: HallOfFameRecord };

const amount = (record: HallOfFameRecord) => Number(record.value.replace(/[^\d]/g, "")) || 0;
const names = (record: HallOfFameRecord) => record.holders.map((holder) => holder.name.split(" ")[0]).join(" & ");

/** Records whose value went up from `before` to `after` (a tie isn't a new record; a first record isn't "broken"). */
export function brokenRecords(before: HallOfFameRecord[], after: HallOfFameRecord[]): BrokenRecord[] {
  return ALERT_RECORD_KEYS.flatMap((key) => {
    const previous = before.find((record) => record.key === key);
    const record = after.find((entry) => entry.key === key);
    return previous && record && amount(record) > amount(previous) ? [{ record, previous }] : [];
  });
}

/** "🏆 New group record!" -- who set it, the new mark, and whose record fell. */
export function recordMessage({ record, previous }: BrokenRecord, groupName: string) {
  const same = names(record) === names(previous);
  return {
    title: `🏆 New ${groupName} record!`,
    body: `${names(record)} set a new ${record.label.toLowerCase()} record: ${record.value}${DETAILED.has(record.key) ? ` (${record.detail})` : ""}, ${same ? "beating their own" : `breaking ${names(previous)}'s`} ${previous.value}.`,
  };
}
