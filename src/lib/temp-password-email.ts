// The email a player gets when an admin sets them a temporary password.

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function renderTempPasswordEmail({ name, email, password, loginUrl }: { name: string; email: string; password: string; loginUrl: string }) {
  const subject = "Your PickleballWolves temporary password";
  const text = [
    `Hi ${name},`,
    "",
    "An organizer set up a temporary password so you can sign in to PickleballWolves.",
    "",
    `Email: ${email}`,
    `Temporary password: ${password}`,
    "",
    `Sign in at ${loginUrl} -- you'll choose your own password right after.`,
    "",
    "See you on the court!",
    "PickleballWolves",
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1b211e;max-width:520px">
  <p>Hi ${escapeHtml(name)},</p>
  <p>An organizer set up a temporary password so you can sign in to <strong>PickleballWolves</strong>.</p>
  <table style="margin:16px 0;border-collapse:collapse">
    <tr><td style="padding:4px 12px 4px 0;color:#5b6b5f">Email</td><td style="padding:4px 0"><strong>${escapeHtml(email)}</strong></td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#5b6b5f">Temporary password</td><td style="padding:4px 0"><code style="font-size:18px;font-weight:bold;background:#f1f5e4;padding:4px 8px;border-radius:6px">${escapeHtml(password)}</code></td></tr>
  </table>
  <p><a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:#d8f24e;color:#0f1712;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:999px">Sign in</a></p>
  <p style="color:#5b6b5f">You'll choose your own password right after signing in. If you didn't expect this, reply to your group's organizer.</p>
  <p>See you on the court!<br/>PickleballWolves</p>
</div>`;
  return { subject, text, html };
}
