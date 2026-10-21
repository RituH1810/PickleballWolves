import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bragSecret, encodeBragCode, type BragCard } from "@/lib/brag";
import { bragHeadline, loadBragView } from "@/lib/load-brag";

// Makes a shareable card link for the signed-in player's own badge or round robin result.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to share." }, { status: 401 });

  const body = await request.json().catch(() => null);
  let card: BragCard;
  if (body?.kind === "achievement" && typeof body.achievementId === "string") card = { kind: "achievement", userId: user.id, achievementId: body.achievementId };
  else if (body?.kind === "recap" && typeof body.roundRobinId === "string") card = { kind: "recap", userId: user.id, roundRobinId: body.roundRobinId };
  else return NextResponse.json({ error: "Nothing to share." }, { status: 400 });

  const view = await loadBragView(card);
  if (!view) return NextResponse.json({ error: card.kind === "achievement" ? "You haven't earned that badge yet." : "That round robin isn't over yet." }, { status: 404 });
  const path = `/brag/${encodeBragCode(card, bragSecret())}`;
  return NextResponse.json({ path, headline: bragHeadline(view) });
}
