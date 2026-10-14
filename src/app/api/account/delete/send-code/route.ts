import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { createDeletionCode } from "@/lib/auth/deletion-store";

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
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "The provided email does not match your account email address." },
        { status: 400 }
      );
    }

    // Generate code and dispatch email
    await createDeletionCode(accountId, userId, user.email);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${user.email}`,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
