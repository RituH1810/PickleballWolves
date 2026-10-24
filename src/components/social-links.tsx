export const INSTAGRAM_URL = "https://www.instagram.com/pickleballwolves/";
export const INSTAGRAM_HANDLE = "@pickleballwolves";

/** Instagram's camera glyph, drawn as a plain outline (the icon library has no brand logos). */
export function InstagramIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** "Follow us on Instagram" link: an icon button, or the icon with the handle. */
export function InstagramLink({ withHandle = false, className = "" }: { withHandle?: boolean; className?: string }) {
  return (
    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label={`Follow PickleballWolves on Instagram (${INSTAGRAM_HANDLE})`} title={`Follow us on Instagram ${INSTAGRAM_HANDLE}`} className={`inline-flex items-center gap-2 ${className}`}>
      <InstagramIcon size={withHandle ? 16 : 18} />{withHandle && <span>{INSTAGRAM_HANDLE}</span>}
    </a>
  );
}
