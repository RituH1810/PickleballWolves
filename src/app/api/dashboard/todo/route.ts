import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadTodo } from "@/lib/load-dashboard-cards";

// Dashboard card for the signed-in player -- To do: scores to enter and Good Wolf votes to cast.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: await loadTodo(user.id) });
}
