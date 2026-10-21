"use client";

import { useState } from "react";
import { Copy, Download, ExternalLink, MessageCircle, Share2 } from "lucide-react";

type Card = { kind: "achievement"; achievementId: string } | { kind: "recap"; roundRobinId: string };
type Prepared = { url: string; text: string; file: File | null };

/**
 * Shares the signed-in player's badge or round robin result as a picture card. Phones get the
 * share sheet with the image attached (WhatsApp, Instagram, Messages...); elsewhere, a small menu.
 */
export function BragButton({ card, label, compact = false }: { card: Card; label: string; compact?: boolean }) {
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
    const ready = { url, text: `${data.headline} on PickleballWolves`, file: image ? new File([image], "pickleballwolves.png", { type: "image/png" }) : null };
    setShare(ready);
    return ready;
  }

  async function nativeShare(share: Prepared) {
    const withImage = share.file && navigator.canShare?.({ files: [share.file] }) ? { files: [share.file] } : {};
    await navigator.share({ text: `${share.text}\n${share.url}`, ...withImage });
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${share!.text}\n${share!.url}`);
      setNotice("Copied -- paste it into your group chat.");
    } catch {
      setNotice("Couldn't copy.");
    }
  }

  const item = "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold hover:bg-[#1c2a1a]";
  return (
    <div className="relative">
      <button type="button" onClick={onClick} disabled={busy} aria-label={label} aria-expanded={open} title={label} className={compact ? "grid h-7 w-7 place-items-center rounded-full text-[var(--ink-soft)] hover:bg-[#1c2a1a] hover:text-[var(--lime-deep)] disabled:opacity-50" : "flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a] disabled:opacity-50"}>
        <Share2 size={compact ? 14 : 13} className={busy ? "animate-pulse" : ""} />{!compact && (busy ? "Making card..." : "Share")}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-2 text-[var(--foreground)] shadow-xl">
          {share ? (
            <>
              {typeof navigator.share === "function" && <button type="button" onClick={() => nativeShare(share).catch(() => {})} className={`${item} w-full`}><Share2 size={14} />Share...</button>}
              <a href={`https://wa.me/?text=${encodeURIComponent(`${share.text}\n${share.url}`)}`} target="_blank" rel="noopener noreferrer" className={item}><MessageCircle size={14} />WhatsApp</a>
              <button type="button" onClick={copy} className={`${item} w-full`}><Copy size={14} />Copy link</button>
              <a href={`${share.url}/image?download`} className={item}><Download size={14} />Download image</a>
              <a href={share.url} target="_blank" rel="noopener noreferrer" className={item}><ExternalLink size={14} />Open card</a>
            </>
          ) : null}
          {notice && <p role="status" className="px-3 py-2 text-[11px] font-bold text-[var(--lime-deep)]">{notice}</p>}
        </div>
      )}
    </div>
  );
}
