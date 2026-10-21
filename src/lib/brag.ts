import { createHmac, timingSafeEqual } from "node:crypto";

/** A brag card: one player's unlocked badge, or how they did in one ended round robin. */
export type BragCard = { kind: "achievement"; userId: string; achievementId: string } | { kind: "recap"; userId: string; roundRobinId: string };

const KIND_CODES = { achievement: "a", recap: "r" } as const;

function signature(body: string, secret: string) {
  return createHmac("sha256", secret).update(`brag:${body}`).digest("base64url").slice(0, 22);
}

/**
 * The card's link code: the card itself plus a signature, so a link only works for cards a player
 * chose to share -- nobody can mint one for someone else by guessing ids.
 */
export function encodeBragCode(card: BragCard, secret: string) {
  const ref = card.kind === "achievement" ? card.achievementId : card.roundRobinId;
  const body = Buffer.from(`${KIND_CODES[card.kind]}|${card.userId}|${ref}`).toString("base64url");
  return `${body}.${signature(body, secret)}`;
}

/** The card a code stands for, or null when it's malformed or the signature doesn't match. */
export function decodeBragCode(code: string, secret: string): BragCard | null {
  const [body, sig, ...rest] = code.split(".");
  if (!body || !sig || rest.length) return null;
  const expected = Buffer.from(signature(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [kind, userId, ref, ...extra] = Buffer.from(body, "base64url").toString().split("|");
  if (!userId || !ref || extra.length) return null;
  if (kind === KIND_CODES.achievement) return { kind: "achievement", userId, achievementId: ref };
  if (kind === KIND_CODES.recap) return { kind: "recap", userId, roundRobinId: ref };
  return null;
}

/** The signing secret. Throws if unset, rather than signing with something guessable. */
export function bragSecret() {
  const secret = process.env.BRAG_SECRET;
  if (!secret) throw new Error("BRAG_SECRET is not set.");
  return secret;
}
