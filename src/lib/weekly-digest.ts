export type DigestGame = { name: string; when: string; path: string; status: "in" | "invited" };
export type DigestData = {
  name: string;
  upcoming: DigestGame[];
  lastWeek: { wins: number; losses: number; ratingChange: number | null; rating: number };
  badges: { name: string; description: string }[];
};

// Games are shown in the groups' local time.
export const DIGEST_TIME_ZONE = "America/New_York";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : "±"}${Math.abs(value).toFixed(2)}`;
}

/** Nothing worth emailing: no games coming up, none played, no new badges. */
export function isEmptyDigest(data: DigestData) {
  return !data.upcoming.length && !(data.lastWeek.wins + data.lastWeek.losses) && !data.badges.length;
}

/** The Monday email: this week's games first, then how last week went. */
export function renderDigestEmail(data: DigestData, siteUrl: string) {
  const firstName = data.name.split(" ")[0];
  const played = data.lastWeek.wins + data.lastWeek.losses;
  const joined = data.upcoming.filter((game) => game.status === "in").length;
  const subject = joined
    ? `Your week: ${joined} game${joined === 1 ? "" : "s"} lined up${played ? `, ${data.lastWeek.wins}-${data.lastWeek.losses} last week` : ""}`
    : played ? `Your week on PickleballWolves: ${data.lastWeek.wins}-${data.lastWeek.losses} last week` : "Your week on PickleballWolves";

  const gameRows = data.upcoming.map((game) => `<tr><td style="padding:8px 0;border-bottom:1px solid #263a2c"><a href="${siteUrl}${game.path}" style="color:#eef3ea;font-weight:700;text-decoration:none">${escapeHtml(game.name)}</a><br><span style="color:#93a397;font-size:13px">${escapeHtml(game.when)}</span></td><td style="padding:8px 0;border-bottom:1px solid #263a2c;text-align:right;font-size:12px;font-weight:700;color:${game.status === "in" ? "#d8f24e" : "#93a397"}">${game.status === "in" ? "You're in" : "Invited -- join?"}</td></tr>`).join("");
  const resultLine = played
    ? `<strong style="color:#eef3ea">${data.lastWeek.wins}-${data.lastWeek.losses}</strong> in ${played} game${played === 1 ? "" : "s"}${data.lastWeek.ratingChange !== null ? ` · rating <strong style="color:${data.lastWeek.ratingChange >= 0 ? "#d8f24e" : "#f17e62"}">${signed(data.lastWeek.ratingChange)}</strong>` : ""} · now ${data.lastWeek.rating.toFixed(2)}`
    : "No games last week -- the courts miss you.";
  const badgeRows = data.badges.map((badge) => `<li style="margin:4px 0"><strong style="color:#eef3ea">${escapeHtml(badge.name)}</strong> <span style="color:#93a397">-- ${escapeHtml(badge.description)}</span></li>`).join("");

  const html = `<div style="background:#0f1712;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#93a397">
<div style="max-width:560px;margin:0 auto;background:#17251d;border:1px solid #263a2c;border-radius:20px;padding:28px">
<p style="margin:0;color:#a9cf3a;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Your week</p>
<h1 style="margin:8px 0 0;color:#eef3ea;font-size:24px">Hi ${escapeHtml(firstName)}, here's your week.</h1>
<h2 style="margin:24px 0 4px;color:#eef3ea;font-size:16px">Coming up</h2>
${data.upcoming.length ? `<table style="width:100%;border-collapse:collapse">${gameRows}</table>` : `<p style="margin:4px 0">Nothing scheduled yet this week.</p>`}
<h2 style="margin:24px 0 4px;color:#eef3ea;font-size:16px">Last week</h2>
<p style="margin:4px 0">${resultLine}</p>
${data.badges.length ? `<h2 style="margin:24px 0 4px;color:#eef3ea;font-size:16px">New badges</h2><ul style="margin:4px 0;padding-left:18px">${badgeRows}</ul>` : ""}
<p style="margin:28px 0 0"><a href="${siteUrl}/" style="display:inline-block;background:#d8f24e;color:#0f1712;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px">Open PickleballWolves</a></p>
<p style="margin:24px 0 0;font-size:12px">Don't want these? Turn off the weekly digest in <a href="${siteUrl}/notifications/settings" style="color:#a9cf3a">notification settings</a>.</p>
</div></div>`;

  const text = [
    `Hi ${firstName}, here's your week.`,
    "",
    "COMING UP",
    ...(data.upcoming.length ? data.upcoming.map((game) => `- ${game.name} -- ${game.when} (${game.status === "in" ? "you're in" : "invited"}) ${siteUrl}${game.path}`) : ["Nothing scheduled yet this week."]),
    "",
    "LAST WEEK",
    played ? `${data.lastWeek.wins}-${data.lastWeek.losses} in ${played} games${data.lastWeek.ratingChange !== null ? `, rating ${signed(data.lastWeek.ratingChange)}` : ""}, now ${data.lastWeek.rating.toFixed(2)}` : "No games last week.",
    ...(data.badges.length ? ["", "NEW BADGES", ...data.badges.map((badge) => `- ${badge.name}: ${badge.description}`)] : []),
    "",
    `Turn off the weekly digest: ${siteUrl}/notifications/settings`,
  ].join("\n");

  return { subject, html, text };
}
