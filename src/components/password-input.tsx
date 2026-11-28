"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * A password field with a show/hide (eye) button, so players can check what they typed -- easy to
 * get wrong on a phone. Takes the usual input props; top margin classes go on the wrapper.
 */
export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  const classes = className.split(/\s+/).filter(Boolean);
  const margin = classes.filter((name) => /^m[ty]?-/.test(name)).join(" ");
  const input = classes.filter((name) => !/^m[ty]?-/.test(name)).join(" ");
  return (
    <span className={`relative block ${margin}`}>
      <input {...props} type={visible ? "text" : "password"} className={`${input} pr-11`} />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} title={visible ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-[var(--ink-soft)] hover:text-[var(--foreground)]">
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </span>
  );
}
