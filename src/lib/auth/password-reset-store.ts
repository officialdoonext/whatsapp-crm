import crypto from "crypto";
import { sendPasswordResetOtpEmail } from "@/lib/email/mailer";

export interface PasswordResetRequest {
  code: string;
  email: string;
  userId: string;
  expiresAt: number;
  attempts: number;
}

// Global store to ensure state survives dev reloads in Next.js
const globalStore = globalThis as unknown as {
  __wacrm_pending_password_resets?: Map<string, PasswordResetRequest>;
};

if (!globalStore.__wacrm_pending_password_resets) {
  globalStore.__wacrm_pending_password_resets = new Map();
}

const pendingResets = globalStore.__wacrm_pending_password_resets;

/**
 * Creates and stores a 6-digit verification code for password reset.
 * Dispatches an email containing the OTP code and direct reset link via Hostinger SMTP.
 */
export async function createPasswordResetCode(
  userId: string,
  email: string,
  origin: string
): Promise<{ code: string }> {
  const normalizedEmail = email.toLowerCase().trim();

  // Generate a cryptographically secure 6-digit verification code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

  // Store in memory keyed by normalized email
  pendingResets.set(normalizedEmail, {
    code,
    email: normalizedEmail,
    userId,
    expiresAt,
    attempts: 0,
  });

  const resetUrl = `${origin}/reset-password?email=${encodeURIComponent(normalizedEmail)}&code=${code}`;

  // Dispatch the email containing the 6-digit OTP code directly via SMTP
  try {
    await sendPasswordResetOtpEmail(normalizedEmail, code, resetUrl);
    console.log(`[password-reset] OTP email successfully dispatched to ${normalizedEmail}`);
  } catch (err) {
    console.error("[password-reset] Error sending reset email via SMTP:", err);
    throw new Error("Failed to send password reset email. Please verify SMTP settings or try again.");
  }

  return { code };
}

/**
 * Verifies the 6-digit password reset code for an email.
 * Does not consume the code immediately so that it can be checked before submission if needed.
 */
export function verifyPasswordResetCode(
  email: string,
  inputCode: string
): { valid: boolean; userId?: string; error?: string } {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = inputCode.trim();

  const request = pendingResets.get(normalizedEmail);
  if (!request) {
    return {
      valid: false,
      error: "No reset request found for this email, or the code has expired. Please request a new code.",
    };
  }

  if (request.expiresAt < Date.now()) {
    pendingResets.delete(normalizedEmail);
    return {
      valid: false,
      error: "Verification code has expired (valid for 15 minutes). Please request a new code.",
    };
  }

  if (request.attempts >= 5) {
    pendingResets.delete(normalizedEmail);
    return {
      valid: false,
      error: "Too many failed attempts. Please request a fresh code.",
    };
  }

  if (request.code !== normalizedCode) {
    request.attempts += 1;
    return {
      valid: false,
      error: "Invalid 6-digit verification code. Please check your email and try again.",
    };
  }

  return { valid: true, userId: request.userId };
}

/**
 * Consumes and removes the password reset request once the password has been changed.
 */
export function consumePasswordResetCode(email: string): void {
  const normalizedEmail = email.toLowerCase().trim();
  pendingResets.delete(normalizedEmail);
}

