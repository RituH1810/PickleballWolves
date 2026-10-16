import { prisma } from "@/lib/prisma";
import { buildCalendarFeed } from "@/lib/calendar-feed";

// The player's subscribed calendar. Calendar apps can't sign in, so the unguessable token in the
// URL is the credential -- treat the link like a password (it can be reset from settings).
export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const user = await prisma.user.findUnique({ where: { calendarToken: token.replace(/\.ics$/i, "") }, select: { id: true } });
  if (!user) return new Response("Calendar not found. Get a new link from your PickleballWolves notification settings.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

  const ics = await buildCalendarFeed(user.id, new URL(request.url).origin);
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="pickleballwolves.ics"', "Cache-Control": "private, max-age=300" } });
}
