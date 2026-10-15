import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { confirmEmailLink } from "./actions";

const COPY: Record<string, { eyebrow: string; title: string; button: string }> = {
  recovery: { eyebrow: "Reset password", title: "Continue to reset your password.", button: "Continue" },
  invite: { eyebrow: "You're invited", title: "Accept your invitation.", button: "Accept invite" },
  magiclink: { eyebrow: "Sign in", title: "Finish signing in.", button: "Sign in" },
  email_change: { eyebrow: "Email change", title: "Confirm your new email.", button: "Confirm email" },
};
const DEFAULT_COPY = { eyebrow: "Almost there", title: "Confirm your email.", button: "Confirm email" };

// Emailed links land here and wait for a click. Email security scanners (Outlook / Hotmail Safe
// Links especially) open every link in a message to check it; when opening the link verified it
// on the spot, the scanner used up the one-time token and the player got "expired". Scanners
// don't submit forms, so the token is only spent when a person presses the button.
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? params[key] : "");
  const tokenHash = value("token_hash");
  const type = value("type");
  const copy = COPY[type] ?? DEFAULT_COPY;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--background)] px-5 py-10 noise">
      <section className="w-full max-w-md rounded-[24px] border border-[var(--line)] bg-[var(--panel)] p-7 shadow-[0_18px_50px_rgba(0,0,0,.35)] sm:p-9">
        {tokenHash && type ? (
          <form action={confirmEmailLink}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={value("next")} />
            <p className="mb-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--lime-deep)]">{copy.eyebrow}</p>
            <h1 className="text-3xl font-black tracking-[-.04em] text-[var(--foreground)]">{copy.title}</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Tap the button to finish. This link works once and stays valid for 5 hours.</p>
            <button type="submit" className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--lime)] text-sm font-bold text-[#0f1712] hover:bg-[#c3e043]">{copy.button} <ArrowRight size={16} /></button>
          </form>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-[-.04em] text-[var(--foreground)]">This link is incomplete.</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">Open the newest email from PickleballWolves, or request a new link from the sign-in page.</p>
            <Link href="/login" className="mt-6 inline-block text-sm font-bold text-[var(--lime-deep)]">Go to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}
