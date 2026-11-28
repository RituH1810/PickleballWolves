// The password standard for every password a player chooses (sign up, reset, change on the profile).
// Signing in doesn't check it, so older, simpler passwords keep working until they're changed.

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES = [
  { id: "length", label: `At least ${PASSWORD_MIN_LENGTH} characters`, short: `${PASSWORD_MIN_LENGTH}+ characters`, test: (password: string) => password.length >= PASSWORD_MIN_LENGTH },
  { id: "upper", label: "A capital letter (A-Z)", short: "a capital letter", test: (password: string) => /[A-Z]/.test(password) },
  { id: "number", label: "A number (0-9)", short: "a number", test: (password: string) => /\d/.test(password) },
  { id: "special", label: "A special character (like ! @ # $ % -)", short: "a special character", test: (password: string) => /[^A-Za-z0-9\s]/.test(password) },
] as const;

/** Each rule and whether the password meets it, for the live checklist. */
export function checkPassword(password: string) {
  return PASSWORD_RULES.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(password) }));
}

/** A sentence naming what the password is missing, or null when it meets the standard. */
export function passwordError(password: string) {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((rule) => rule.short);
  if (!missing.length) return null;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}`;
  return `Your password needs ${list}.`;
}
