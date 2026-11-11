/**
 * The public address of the app for links that leave it (emails, invite links, calendar feeds).
 *
 * Not the request's own origin: Vercel cron jobs call the app on its per-deployment address
 * (pickleballwolves-<hash>-<team>.vercel.app), which is behind Vercel's login, so links built from
 * it sent players to a Vercel sign-in page. In order: NEXT_PUBLIC_SITE_URL if set, then Vercel's
 * production domain (VERCEL_PROJECT_PRODUCTION_URL, set automatically on Vercel), then the
 * request's origin (local development).
 */
export function siteUrl(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return request ? new URL(request.url).origin : "http://localhost:3000";
}
