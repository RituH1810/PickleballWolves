import { appIcon } from "@/lib/app-icon";

const SIZES = new Set([72, 96, 192, 512]);

// App icons for the manifest and notifications (under /api so the login redirect never blocks them).
export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const size = Number((await context.params).size);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const icon = appIcon(size);
  icon.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return icon;
}
