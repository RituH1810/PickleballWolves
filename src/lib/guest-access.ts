// Pages anyone can open: sign-in itself, shareable links, and the read-only parts of the site --
// the dashboard (a guest version), group, player, and competition pages. Personal pages (dashboard, profile, notifications, my
// matches) and create/edit screens still need an account. Each API decides what a guest may see.
const AUTH_PREFIXES = ["/login", "/signup", "/auth", "/invite"];
// /install is the "add to home screen" guide; /t/<slug> is an organizer's public tournament page;
// /brag/<code> is a card a player chose to share (codes are signed, so only those open).
const SHARED_PREFIXES = ["/install", "/t", "/brag"];
const BROWSE_PREFIXES = ["/groups", "/players", "/leaderboards", "/tournaments", "/leagues", "/ladder", "/rivalry"];
// Inside a browse section, these still need sign-in.
const SIGNED_IN_ONLY = [/^\/tournaments\/new$/, /^\/round-robin\/[^/]+\/edit$/];

function under(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Whether a signed-out visitor may open this page. */
export function isGuestPath(pathname: string) {
  if (SIGNED_IN_ONLY.some((pattern) => pattern.test(pathname))) return false;
  if ([...AUTH_PREFIXES, ...SHARED_PREFIXES, ...BROWSE_PREFIXES].some((prefix) => under(pathname, prefix))) return true;
  if (pathname === "/dashboard") return true;
  // A single round robin (shared by link); /round-robin itself is the "start one" screen.
  return /^\/round-robin\/[^/]+$/.test(pathname);
}

/** Pages that are about signing in or are shared standalone -- no guest bar or sign-in prompt on these. */
export function isStandalonePath(pathname: string) {
  return [...AUTH_PREFIXES, ...SHARED_PREFIXES].some((prefix) => under(pathname, prefix));
}
