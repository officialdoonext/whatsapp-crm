import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  verifyPasswordResetCode,
  consumePasswordResetCode,
} from "@/lib/auth/password-reset-store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, code, newPassword } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json(
        { error: "A valid 6-digit verification code is required." },
        { status: 400 }
      );
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const verification = verifyPasswordResetCode(normalizedEmail, code);

    if (!verification.valid || !verification.userId) {
      return NextResponse.json(
        { error: verification.error || "Invalid or expired verification code." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // Update password in Supabase Auth
    const { error: updateError } = await admin.auth.admin.updateUserById(
      verification.userId,
      { password: newPassword }
    );

    if (updateError) {
      console.error(
        "[forgot-password/verify-and-reset] updateUserById error:",
        updateError
      );
      return NextResponse.json(
        { error: updateError.message || "Failed to update password." },
        { status: 500 }
      );
    }

    // Invalidate the code
    consumePasswordResetCode(normalizedEmail);

    return NextResponse.json({
      success: true,
      message:
        "Your password has been successfully reset. You can now sign in with your new password.",
    });
  } catch (err) {
    console.error("[forgot-password/verify-and-reset] Error:", err);
    const message =
      err instanceof Error
        ? err.message
        : "Failed to reset password. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

