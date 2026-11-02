import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import { createPasswordResetCode } from "@/lib/auth/password-reset-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const admin = supabaseAdmin();

    // 1. Look up profile by email
    let userId: string | null = null;
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("user_id, email")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profile?.user_id) {
      userId = profile.user_id;
    } else {
      // 2. Fallback lookup in auth.users
      try {
        const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
        const matchedUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase().trim() === normalizedEmail
        );
        if (matchedUser) {
          userId = matchedUser.id;
        }
      } catch (authErr) {
        console.warn("[forgot-password] auth.admin.listUsers fallback error:", authErr);
      }
    }

    // Determine deployment origin for reset link
    let origin =
      req.headers.get("origin") ||
      (req.headers.get("referer") ? new URL(req.headers.get("referer")!).origin : null) ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    origin = origin.replace(/\/+$/, "");

    if (userId) {
      await createPasswordResetCode(userId, normalizedEmail, origin);
    } else {
      console.warn(
        `[forgot-password] Password reset requested for non-existent email: ${normalizedEmail}`
      );
    }

    return NextResponse.json({
      success: true,
      message: "If an account matches that email address, a 6-digit verification code has been sent.",
    });
  } catch (err) {
    console.error("[forgot-password/send-code] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to process password reset request.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

