// On Android, only Google Chrome's installs are signed by Google. Other browsers (Edge, Brave, Opera,
// Samsung Internet...) package the web app themselves, and newer Android versions' Play Protect
// blocks those as "built for an older version of Android". In-app browsers (Instagram, Facebook,
// WhatsApp) can't install at all. So on Android, anything but Chrome gets sent to Chrome.

const OTHER_BROWSERS: [RegExp, string][] = [
  [/Instagram/, "Instagram's browser"],
  [/FBAN|FBAV|FB_IAB/, "Facebook's browser"],
  [/WhatsApp/, "WhatsApp's browser"],
  [/EdgA\//, "Microsoft Edge"],
  [/OPR\/|OPT\//, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\//, "Firefox"],
  [/Vivaldi\//, "Vivaldi"],
  [/YaBrowser\//, "Yandex Browser"],
  [/DuckDuckGo\//, "DuckDuckGo"],
  [/; wv\)/, "an in-app browser"],
];

/**
 * The name of the browser an Android visitor is using if it isn't Google Chrome, or null if it is
 * Chrome (or this isn't Android). Brave looks exactly like Chrome, so it's passed in separately.
 */
export function androidNonChromeBrowser(userAgent: string, isBrave = false): string | null {
  if (!/Android/i.test(userAgent)) return null;
  if (isBrave) return "Brave";
  for (const [pattern, name] of OTHER_BROWSERS) if (pattern.test(userAgent)) return name;
  return /Chrome\/\d/.test(userAgent) ? null : "this browser";
}

/** A link that opens `url` in Chrome on Android (falls back to the normal page elsewhere). */
export function openInChromeUrl(url: string) {
  const { host, pathname, search } = new URL(url);
  return `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
