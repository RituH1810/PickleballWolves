"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, ImageIcon, MessageCircle, Share2 } from "lucide-react";

type Card =
  | { kind: "achievement"; achievementId: string }
  | { kind: "recap"; roundRobinId: string }
  | { kind: "roundRobin"; roundRobinId: string }
  | { kind: "leaderboard"; groupId: string; month: string };
type Prepared = { url: string; imageUrl: string; text: string; file: File | null };

// Where a link can be posted from a computer; each shows the card as the link's preview.
function socialLinks({ url, text }: Prepared) {
  const enc = encodeURIComponent;
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${text}\n${url}`)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ];
}

/**
 * Turns a badge, a result, a round robin recap, or a monthly leaderboard into a picture card and
 * shares it. Phones open the share sheet with the image attached (Instagram, WhatsApp, Facebook,
 * Messages...). Computers get a menu: a preview of the card, social networks, copy or download.
 */
export function BragButton({ card, label, compact = false, text = "Share", align = "right" }: { card: Card; label: string; compact?: boolean; text?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [share, setShare] = useState<Prepared | null>(null);

  async function prepare(): Promise<Prepared | null> {
    if (share) return share;
    const response = await fetch("/api/brag", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(card) });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.path) { setNotice(data?.error ?? "Couldn't make the card."); return null; }
    const url = new URL(data.path, window.location.origin).toString();
    const image = await fetch(`${data.path}/image`).then((result) => result.ok ? result.blob() : null).catch(() => null);
    const ready = { url, imageUrl: `${url}/image`, text: `${data.headline} on PickleballWolves`, file: image ? new File([image], "pickleballwolves.png", { type: "image/png" }) : null };
    setShare(ready);
    return ready;
  }

  async function nativeShare(prepared: Prepared) {
    const withImage = prepared.file && navigator.canShare?.({ files: [prepared.file] }) ? { files: [prepared.file] } : {};
    await navigator.share({ text: `${prepared.text}\n${prepared.url}`, ...withImage });
  }

  async function onClick() {
    if (open) { setOpen(false); return; }
    setBusy(true);
    setNotice("");
    const ready = await prepare();
    setBusy(false);
    if (!ready) { setOpen(true); return; }
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try { await nativeShare(ready); return; } catch (error) {
        // Cancelled -- nothing to do. Anything else (often the tap "expiring" while the card
        // loaded) falls through to the menu, whose Share button works on a fresh tap.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setOpen(true);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${share!.text}\n${share!.url}`);
      setNotice("Link copied -- paste it into your group chat.");
    } catch {
      setNotice("Couldn't copy.");
    }
  }

  // The picture itself, for pasting straight into WhatsApp Web, LinkedIn, Slack...
  async function copyImage() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": share!.file! })]);
      setNotice("Image copied -- paste it into a post or chat.");
    } catch {
      setNotice("Couldn't copy the image -- try Download.");
    }
  }

  const canCopyImage = Boolean(share?.file) && typeof window !== "undefined" && "ClipboardItem" in window;
  const item = "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-[#1c2a1a]";
  return (
    <div className="relative">
      <button type="button" onClick={onClick} disabled={busy} aria-label={label} aria-expanded={open} title={label} className={compact ? "grid h-7 w-7 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a] hover:text-[var(--lime-deep)] disabled:opacity-50" : "flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a] disabled:opacity-50"}>
        <Share2 size={compact ? 14 : 13} className={busy ? "animate-pulse" : ""} />{!compact && (busy ? "Making card..." : text)}
      </button>
      {open && (
        <div className={`absolute ${align === "left" ? "left-0" : "right-0"} top-full z-30 mt-2 w-72 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[var(--foreground)] shadow-xl`}>
          {share ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- generated card PNG */}
              <img src={share.imageUrl} alt="Your share card" width={1200} height={630} className="mb-2 h-auto w-full rounded-xl border border-[var(--line)]" />
              {typeof navigator.share === "function" && <button type="button" onClick={() => nativeShare(share).catch(() => {})} className={`${item} w-full`}><Share2 size={14} />Share with image...</button>}
              <div className="grid grid-cols-2">
                {socialLinks(share).map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className={item}><MessageCircle size={14} />{link.label}</a>)}
              </div>
              <div className="my-1 border-t border-[var(--line)]" />
              {canCopyImage && <button type="button" onClick={copyImage} className={`${item} w-full`}><ImageIcon size={14} />Copy image</button>}
              <a href={`${share.imageUrl}?download`} className={item}><Download size={14} />Download image <span className="font-semibold text-[var(--ink-soft)]">· for Instagram</span></a>
              <button type="button" onClick={copyLink} className={`${item} w-full`}><Copy size={14} />Copy link</button>
              <a href={share.url} target="_blank" rel="noopener noreferrer" className={item}><ExternalLink size={14} />Open card</a>
            </>
          ) : null}
          {notice && <p role="status" className="px-3 py-2 text-[11px] font-bold text-[var(--lime-deep)]">{notice}</p>}
        </div>
      )}
    </div>
  );
}
