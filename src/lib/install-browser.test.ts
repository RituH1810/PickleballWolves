import { describe, expect, it } from "vitest";
import { androidNonChromeBrowser, openInChromeUrl } from "./install-browser";

const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";

describe("androidNonChromeBrowser", () => {
  it("lets Chrome on Android install", () => {
    expect(androidNonChromeBrowser(CHROME)).toBeNull();
  });

  it("names other Android browsers, including in-app ones", () => {
    expect(androidNonChromeBrowser(`${CHROME} EdgA/141.0.0.0`)).toBe("Microsoft Edge");
    expect(androidNonChromeBrowser(CHROME.replace("Chrome/141.0.0.0 Mobile", "SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile"))).toBe("Samsung Internet");
    expect(androidNonChromeBrowser(`${CHROME.replace("Pixel 8)", "Pixel 8; wv)")} Instagram 350.0.0.0 Android`)).toBe("Instagram's browser");
    expect(androidNonChromeBrowser("Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0")).toBe("Firefox");
    expect(androidNonChromeBrowser(CHROME, true)).toBe("Brave");
  });

  it("ignores iPhones and computers", () => {
    expect(androidNonChromeBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1")).toBeNull();
    expect(androidNonChromeBrowser("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0")).toBeNull();
  });
});

describe("openInChromeUrl", () => {
  it("builds an Android intent for Chrome with a fallback", () => {
    expect(openInChromeUrl("https://pickleballwolves.com/install")).toBe("intent://pickleballwolves.com/install#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fpickleballwolves.com%2Finstall;end");
  });
});
