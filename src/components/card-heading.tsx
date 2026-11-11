import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** The standard card header used across the app: a lime icon and a bold title. */
export function CardHeading({ icon: Icon, title, className = "" }: { icon: LucideIcon; title: ReactNode; className?: string }) {
  return <div className={`flex items-center gap-2 ${className}`}><Icon size={17} className="shrink-0 text-[var(--lime-deep)]" /><h2 className="font-extrabold">{title}</h2></div>;
}
