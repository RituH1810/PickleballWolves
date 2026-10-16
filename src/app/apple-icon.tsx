import { appIcon } from "@/lib/app-icon";

// The icon iPhones use when PickleballWolves is added to the home screen.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return appIcon(180);
}
