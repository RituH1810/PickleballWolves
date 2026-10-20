import { Navigation } from "lucide-react";
import { directionsUrl } from "@/lib/places";

/** "Directions" -- opens Google Maps with the address as the destination (free, no API key). */
export function DirectionsLink({ address, className = "" }: { address: string | null | undefined; className?: string }) {
  if (!address?.trim()) return null;
  return (
    <a href={directionsUrl(address)} target="_blank" rel="noopener noreferrer" aria-label={`Directions to ${address}`} className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--lime-deep)] transition-colors hover:bg-[#1c2a1a] ${className}`}>
      <Navigation size={11} />Directions
    </a>
  );
}
