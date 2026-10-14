import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ensureProfile } from "@/lib/server-profile";
import { notify } from "@/lib/notifications";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to send a challenge." }, { status: 401 });
  const profile = await ensureProfile(user);
  const body = await request.json();
  if (body.challengedId === profile.id) return NextResponse.json({ error: "You can't challenge yourself." }, { status: 400 });
  const ladder = await prisma.ladder.findUnique({ where: { id: body.ladderId } });
  if (!ladder) return NextResponse.json({ error: "Ladder not found." }, { status: 404 });
  const [challengerPosition, challengedPosition] = await Promise.all([
    prisma.ladderPosition.findUnique({ where: { ladderId_userId: { ladderId: ladder.id, userId: profile.id } } }),
    prisma.ladderPosition.findUnique({ where: { ladderId_userId: { ladderId: ladder.id, userId: body.challengedId } } }),
  ]);
  if (!challengerPosition) return NextResponse.json({ error: "Join the ladder before challenging anyone." }, { status: 400 });
  if (!challengedPosition) return NextResponse.json({ error: "That player isn't on this ladder." }, { status: 400 });
  const gap = challengerPosition.position - challengedPosition.position;
  if (gap <= 0 || gap > ladder.challengeRange) return NextResponse.json({ error: `You can only challenge up to ${ladder.challengeRange} spot${ladder.challengeRange === 1 ? "" : "s"} above you.` }, { status: 400 });
  const existingPending = await prisma.challenge.findFirst({ where: { ladderId: ladder.id, status: "PENDING", deadlineAt: { gt: new Date() }, OR: [{ challengerId: profile.id, challengedId: body.challengedId }, { challengerId: body.challengedId, challengedId: profile.id }] } });
  if (existingPending) return NextResponse.json({ error: "There's already a pending challenge between you two." }, { status: 400 });
  const deadlineAt = new Date(Date.now() + ladder.responseDeadlineHours * 60 * 60 * 1000);
  const challenge = await prisma.challenge.create({ data: { ladderId: ladder.id, challengerId: profile.id, challengedId: body.challengedId, deadlineAt, status: "PENDING" } });
  await notify(body.challengedId, "challenge", "CHALLENGE_RECEIVED", `${profile.name} challenged you`, `Respond by ${deadlineAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} on the ${ladder.name} ladder.`);
  return NextResponse.json({ challenge }, { status: 201 });
}
