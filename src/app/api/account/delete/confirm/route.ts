import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import { verifyDeletionCode } from "@/lib/auth/deletion-store";

export async function POST(req: Request) {
  try {
    const { supabase, userId, accountId } = await requireRole("owner");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "No email associated with this user." }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { email, code } = body;

    if (!email || !code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Email and 6-digit verification code are required." },
        { status: 400 }
      );
    }

    if (email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "The provided email does not match your account." },
        { status: 400 }
      );
    }

    // Verify 6-digit code
    const isCodeValid = await verifyDeletionCode(accountId, user.email, code);
    if (!isCodeValid) {
      return NextResponse.json(
        { error: "Invalid or expired confirmation code. Please check your email or request a new code." },
        { status: 400 }
      );
    }

    const admin = supabaseAdmin();

    // 1. Delete all account data by deleting the accounts row.
    // Every entity cascades on account_id delete (017_account_sharing.sql):
    // contacts, conversations, messages, broadcasts, automations, flows, whatsapp_config,
    // templates, pipelines, deals, tags, custom fields, webhooks, ai configs, etc.
    const { error: deleteAccountError } = await admin
      .from("accounts")
      .delete()
      .eq("id", accountId);

    if (deleteAccountError) {
      console.error("[account/delete/confirm] Account cascade delete error:", deleteAccountError);
      return NextResponse.json(
        { error: "Failed to delete account data. Please contact support." },
        { status: 500 }
      );
    }

    // 2. Delete the user from auth.users (also removes profile)
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (userDeleteError) {
      console.warn("[account/delete/confirm] auth.admin.deleteUser warning:", userDeleteError);
    }

    return NextResponse.json({
      success: true,
      message: "Account and all associated data have been permanently deleted.",
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
