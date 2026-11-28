import { Check, Circle } from "lucide-react";
import { checkPassword } from "@/lib/password-rules";

/** The password standard as a live checklist: each rule turns lime once the password meets it. */
export function PasswordChecklist({ password, className = "" }: { password: string; className?: string }) {
  return (
    <ul aria-label="Password requirements" className={`grid gap-1 text-xs sm:grid-cols-2 ${className}`}>
      {checkPassword(password).map((rule) => (
        <li key={rule.id} className={`flex items-center gap-1.5 ${rule.met ? "font-semibold text-[var(--lime-deep)]" : "text-[var(--ink-soft)]"}`}>
          {rule.met ? <Check size={13} aria-hidden /> : <Circle size={11} aria-hidden />}
          <span>{rule.label}<span className="sr-only">{rule.met ? " (done)" : " (still needed)"}</span></span>
        </li>
      ))}
    </ul>
  );
}
