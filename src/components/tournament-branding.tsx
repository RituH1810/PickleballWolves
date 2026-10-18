"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, ImagePlus, Palette, Plus, Trash2, X } from "lucide-react";
import { BRAND_PRESETS, DEFAULT_BRAND_COLOR, assetUrl, isHexColor, isValidSlug, publicTournamentPath, readableTextColor, slugify } from "@/lib/branding";
import { resizeImage } from "@/lib/resize-image";

type Sponsor = { name: string; url: string; logoAssetId: string | null };
type Branding = { isPublic: boolean; publicSlug: string; brandColor: string | null; presentedBy: string; logoAssetId: string | null; bannerAssetId: string | null; sponsors: Sponsor[] };

const MAX_SPONSORS = 8;
const LOGO = { width: 512, height: 512, type: "image/png" as const };
const BANNER = { width: 1600, height: 600, type: "image/jpeg" as const };

function ImagePicker({ label, hint, assetId, onPick, onClear, busy, wide }: { label: string; hint: string; assetId: string | null; onPick: (file: File) => void; onClear: () => void; busy: boolean; wide?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = assetUrl(assetId);
  return (
    <div>
      <p className="text-xs font-bold text-[#c3d0c5]">{label}</p>
      <div className={`mt-1.5 flex items-center gap-3 ${wide ? "flex-col items-stretch" : ""}`}>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={`relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-[var(--line)] bg-[#0f1712] text-[var(--ink-soft)] hover:border-[var(--lime-deep)] disabled:opacity-50 ${wide ? "h-28 w-full" : "h-20 w-20"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url ? <img src={url} alt="" className={`h-full w-full ${wide ? "object-cover" : "object-contain bg-white"}`} /> : <span className="flex flex-col items-center gap-1 text-[10px] font-bold"><ImagePlus size={18} />{busy ? "Uploading..." : "Upload"}</span>}
        </button>
        <div className="flex items-center gap-3">
          <p className="text-[11px] leading-4 text-[var(--ink-soft)]">{hint}</p>
          {url && <button type="button" onClick={onClear} className="shrink-0 text-[11px] font-bold text-[var(--coral)]">Remove</button>}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) onPick(file); }} />
    </div>
  );
}

/** Organizer-only: brand the tournament (logo, banner, color, sponsors) and publish its public page. */
export function TournamentBranding({ tournamentId }: { tournamentId: string }) {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [saved, setSaved] = useState<Branding | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/branding`).then((response) => response.ok ? response.json() : null).then((data) => {
      if (!data?.branding) return;
      const loaded = { ...data.branding, sponsors: data.branding.sponsors.map((sponsor: Sponsor) => ({ ...sponsor, url: sponsor.url ?? "" })) };
      setBranding(loaded);
      setSaved(loaded);
      setOrigin(window.location.origin);
    });
  }, [tournamentId]);

  if (!branding) return null;
  const update = (patch: Partial<Branding>) => setBranding({ ...branding, ...patch });
  const dirty = JSON.stringify(branding) !== JSON.stringify(saved);
  const brand = branding.brandColor ?? DEFAULT_BRAND_COLOR;
  const publicUrl = `${origin}${publicTournamentPath(branding.publicSlug)}`;

  async function upload(file: File, kind: "LOGO" | "BANNER" | "SPONSOR", key: string) {
    setUploading(key);
    setMessage(null);
    try {
      const spec = kind === "BANNER" ? BANNER : LOGO;
      const resized = await resizeImage(file, spec.width, spec.height, spec.type);
      const form = new FormData();
      form.append("file", resized);
      form.append("kind", kind);
      const response = await fetch(`/api/tournaments/${tournamentId}/assets`, { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Upload failed.");
      return data.id as string;
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Upload failed.", error: true });
      return null;
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    if (!branding) return;
    if (branding.isPublic && !isValidSlug(branding.publicSlug)) { setMessage({ text: "The page link can use lowercase letters, numbers, and dashes (3-60 characters).", error: true }); return; }
    setSaving(true);
    setMessage(null);
    const response = await fetch(`/api/tournaments/${tournamentId}/branding`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(branding) });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) { setMessage({ text: data?.error ?? "Couldn't save branding.", error: true }); return; }
    const next = { ...data.branding, sponsors: data.branding.sponsors.map((sponsor: Sponsor) => ({ ...sponsor, url: sponsor.url ?? "" })) };
    setBranding(next);
    setSaved(next);
    setMessage({ text: next.isPublic ? "Saved -- your public page is live." : "Saved.", error: false });
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setMessage({ text: "Link copied -- share it anywhere.", error: false }); } catch { setMessage({ text: "Couldn't copy the link.", error: true }); }
  }

  const field = "h-10 w-full rounded-xl border border-[var(--line)] bg-[#0f1712] px-3 text-sm outline-none focus:border-[var(--lime-deep)]";
  return (
    <section className="mt-6 rounded-[20px] border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Palette size={17} className="text-[var(--lime-deep)]" /><h2 className="font-extrabold">Branding & public page</h2></div>
        {saved?.isPublic && <div className="flex gap-2">
          <a href={publicTournamentPath(saved.publicSlug)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a]"><ExternalLink size={13} />Open page</a>
          <button onClick={copyLink} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold hover:bg-[#1c2a1a]"><Copy size={13} />Copy link</button>
        </div>}
      </div>
      <p className="mt-1 text-xs text-[var(--ink-soft)]">Your logo, colors, and sponsors on a public page anyone can follow -- schedule, live scores, bracket, and results. Shared links show a branded preview.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-3 rounded-xl bg-[#131f19] p-3">
            <span><span className="block text-sm font-extrabold">Public page</span><span className="text-[11px] text-[var(--ink-soft)]">Anyone with the link can view it (shows player names and scores).</span></span>
            <button type="button" role="switch" aria-checked={branding.isPublic} onClick={() => update({ isPublic: !branding.isPublic })} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${branding.isPublic ? "bg-[var(--lime)]" : "bg-[#2c4234]"}`}><span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${branding.isPublic ? "left-6 bg-[#0f1712]" : "left-1 bg-[var(--ink-soft)]"}`} /></button>
          </label>
          <label className="block text-xs font-bold text-[#c3d0c5]">Page link
            <div className="mt-1.5 flex items-center rounded-xl border border-[var(--line)] bg-[#0f1712] pl-3 focus-within:border-[var(--lime-deep)]">
              <span className="shrink-0 text-xs text-[var(--ink-soft)]">{origin.replace(/^https?:\/\//, "")}/t/</span>
              <input value={branding.publicSlug} onChange={(event) => update({ publicSlug: slugify(event.target.value.replace(/\s/g, "-")) || event.target.value.toLowerCase() })} className="h-10 min-w-0 flex-1 bg-transparent pr-3 text-sm outline-none" />
            </div>
          </label>
          <label className="block text-xs font-bold text-[#c3d0c5]">Presented by
            <input value={branding.presentedBy} onChange={(event) => update({ presentedBy: event.target.value })} maxLength={80} placeholder="Your club or organization" className={`mt-1.5 ${field}`} />
          </label>
          <div>
            <p className="text-xs font-bold text-[#c3d0c5]">Brand color</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {BRAND_PRESETS.map((color) => <button key={color} type="button" onClick={() => update({ brandColor: color })} aria-label={`Use ${color}`} aria-pressed={brand.toLowerCase() === color} className={`h-8 w-8 rounded-full border-2 ${brand.toLowerCase() === color ? "border-white" : "border-transparent"}`} style={{ background: color }} />)}
              <input type="color" value={isHexColor(brand) ? brand : DEFAULT_BRAND_COLOR} onChange={(event) => update({ brandColor: event.target.value })} aria-label="Custom color" className="h-8 w-10 cursor-pointer rounded-lg border border-[var(--line)] bg-transparent" />
            </div>
          </div>
          <ImagePicker label="Logo" hint="Square works best. PNG keeps a transparent background." assetId={branding.logoAssetId} busy={uploading === "logo"} onPick={async (file) => { const id = await upload(file, "LOGO", "logo"); if (id) update({ logoAssetId: id }); }} onClear={() => update({ logoAssetId: null })} />
          <ImagePicker wide label="Banner" hint="Wide photo of your courts or event, about 1600 x 600." assetId={branding.bannerAssetId} busy={uploading === "banner"} onPick={async (file) => { const id = await upload(file, "BANNER", "banner"); if (id) update({ bannerAssetId: id }); }} onClear={() => update({ bannerAssetId: null })} />
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold text-[#c3d0c5]">Preview</p>
            <div className="mt-1.5 overflow-hidden rounded-2xl border border-[var(--line)] bg-[#0f1712]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {branding.bannerAssetId ? <img src={assetUrl(branding.bannerAssetId)!} alt="" className="h-24 w-full object-cover" /> : <div className="h-20" style={{ background: `linear-gradient(135deg, ${brand}, #0f1712)` }} />}
              <div className="-mt-7 px-4 pb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {branding.logoAssetId ? <img src={assetUrl(branding.logoAssetId)!} alt="" className="h-14 w-14 rounded-xl border-2 border-[#0f1712] bg-white object-contain" /> : <div className="grid h-14 w-14 place-items-center rounded-xl border-2 border-[#0f1712] text-sm font-black" style={{ background: brand, color: readableTextColor(brand) }}>{(branding.presentedBy || "PW").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>}
                <p className="mt-2 text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: readableTextColor(brand) === "#0f1712" ? brand : DEFAULT_BRAND_COLOR }}>{branding.presentedBy || "Organizer"} presents</p>
                <span className="mt-2 inline-block rounded-full px-3 py-1 text-[10px] font-black" style={{ background: brand, color: readableTextColor(brand) }}>Register now</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between"><p className="text-xs font-bold text-[#c3d0c5]">Sponsors</p>{branding.sponsors.length < MAX_SPONSORS && <button type="button" onClick={() => update({ sponsors: [...branding.sponsors, { name: "", url: "", logoAssetId: null }] })} className="flex items-center gap-1 text-[11px] font-bold text-[var(--lime-deep)]"><Plus size={12} />Add sponsor</button>}</div>
            {branding.sponsors.length === 0 && <p className="mt-1.5 text-[11px] text-[var(--ink-soft)]">Thank local courts, shops, or restaurants with a logo and link on the page.</p>}
            <div className="mt-2 space-y-2">
              {branding.sponsors.map((sponsor, index) => {
                const setSponsor = (patch: Partial<Sponsor>) => update({ sponsors: branding.sponsors.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)) });
                return (
                  <div key={index} className="flex items-center gap-2 rounded-xl bg-[#131f19] p-2">
                    <label className="relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg bg-white text-[#0f1712]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {sponsor.logoAssetId ? <img src={assetUrl(sponsor.logoAssetId)!} alt="" className="h-full w-full object-contain" /> : <ImagePlus size={14} />}
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; const id = await upload(file, "SPONSOR", `sponsor-${index}`); if (id) setSponsor({ logoAssetId: id }); }} />
                    </label>
                    <input value={sponsor.name} onChange={(event) => setSponsor({ name: event.target.value })} placeholder="Sponsor name" aria-label="Sponsor name" maxLength={60} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[#0f1712] px-2 text-xs outline-none" />
                    <input value={sponsor.url} onChange={(event) => setSponsor({ url: event.target.value })} placeholder="website (optional)" aria-label="Sponsor website" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[#0f1712] px-2 text-xs outline-none" />
                    <button type="button" onClick={() => update({ sponsors: branding.sponsors.filter((_, position) => position !== index) })} aria-label="Remove sponsor" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--ink-soft)] hover:text-[var(--coral)]"><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
        <button onClick={save} disabled={saving || !dirty || uploading !== null} className="rounded-full bg-[var(--lime)] px-5 py-2.5 text-xs font-bold text-[#0f1712] hover:bg-[#c3e043] disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving..." : "Save branding"}</button>
        {dirty && <button onClick={() => setBranding(saved)} className="flex items-center gap-1 text-xs font-bold text-[var(--ink-soft)]"><X size={13} />Discard changes</button>}
        {message && <p role={message.error ? "alert" : "status"} className={`text-xs font-bold ${message.error ? "text-[var(--coral)]" : "text-[var(--lime-deep)]"}`}>{message.text}</p>}
      </div>
    </section>
  );
}
