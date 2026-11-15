/** A little pickle, drawn to sit alongside lucide icons (same size and stroke props). */
export function PickleIcon({ size = 24, className, strokeWidth = 2 }: { size?: number | string; className?: string; strokeWidth?: number | string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.5 17.5c-2.6-2.6-2.2-7.3 1-10.5s7.9-3.6 10.5-1 2.2 7.3-1 10.5-7.9 3.6-10.5 1Z" />
      <path d="M9 10.5h.01M12.5 8h.01M11 13.5h.01M14.5 11h.01M13 16h.01M16.5 13.5h.01" />
    </svg>
  );
}
