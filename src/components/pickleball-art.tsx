// Lightweight SVG motifs and a live-pulse indicator, drawn in code so the app never depends on
// external photo/image assets. Colors default to the Moonlit Pack theme but can be overridden.

export function PaddleIcon({ className, color = "var(--lime)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
      <rect x="27" y="30" width="8" height="30" rx="3.5" fill={color} opacity=".85" />
      <ellipse cx="31" cy="22" rx="19" ry="21" fill={color} />
      <ellipse cx="31" cy="22" rx="19" ry="21" stroke="#0f1712" strokeOpacity=".15" strokeWidth="1.5" />
      {[-9, 0, 9].map((dx) =>
        [-10, -1, 8, 17].map((dy) => (
          <circle key={`${dx}-${dy}`} cx={31 + dx} cy={22 + dy} r="1.6" fill="#0f1712" opacity=".18" />
        )),
      )}
    </svg>
  );
}

export function PickleballIcon({ className, color = "var(--coral)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill={color} />
      <circle cx="20" cy="20" r="18" stroke="#0f1712" strokeOpacity=".12" strokeWidth="1.5" />
      {[[13, 12], [27, 12], [9, 20], [20, 20], [31, 20], [13, 28], [27, 28]].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.8" fill="#0f1712" opacity=".2" />
      ))}
    </svg>
  );
}

export function CourtNetIcon({ className, color = "var(--foreground)" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 28" fill="none" className={className} aria-hidden="true">
      <rect x="2" y="2" width="60" height="18" rx="1.5" stroke={color} strokeOpacity=".5" strokeWidth="1.5" />
      <path d="M2 2 62 20M62 2 2 20M14 2v18M26 2v18M38 2v18M50 2v18" stroke={color} strokeOpacity=".3" strokeWidth="1" />
      <line x1="0" y1="24" x2="64" y2="24" stroke={color} strokeOpacity=".6" strokeWidth="2" />
    </svg>
  );
}

export function LivePulse({ color = "var(--lime)", size = 8 }: { color?: string; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70" style={{ backgroundColor: color }} />
      <span className="relative inline-flex h-full w-full rounded-full" style={{ backgroundColor: color }} />
    </span>
  );
}
