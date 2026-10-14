import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUserAccess } from "@/lib/auth/user-status";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({
        isAllowed: false,
        reason: "unauthenticated",
        message: "No active session found.",
        email: null,
      });
    }

    let profileData: { status?: string | null; expiry_date?: string | null } | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("status, expiry_date")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) profileData = data;
    } catch {
      // fallback to metadata
    }

    const access = checkUserAccess(user, profileData);

    return NextResponse.json({
      ...access,
      email: user.email,
    });
  } catch (err) {
    console.error("[/api/account/status] error:", err);
    return NextResponse.json(
      { error: "Failed to resolve account status" },
      { status: 500 }
    );
  }
}
