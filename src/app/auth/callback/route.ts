import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // An expired or already-used link (e.g. a password reset email clicked twice) would otherwise
    // bounce silently to a page that needs a session.
    if (error) return NextResponse.redirect(new URL("/login?error=confirm-link-invalid", request.url));
  }

  const next = url.searchParams.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return NextResponse.redirect(new URL(safeNext, request.url));
}
