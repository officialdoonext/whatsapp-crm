import crypto from "crypto";
import { sendDeletionOtpEmail } from "@/lib/email/mailer";

interface DeletionRequest {
  code: string;
  email: string;
  accountId: string;
  userId: string;
  expiresAt: number;
}

// In-memory store for pending deletion codes (10 minutes validity)
const pendingDeletions = new Map<string, DeletionRequest>();

/**
 * Creates and stores a 6-digit verification code for account deletion.
 * Dispatches an email with the OTP via Hostinger SMTP.
 */
export async function createDeletionCode(
  accountId: string,
  userId: string,
  email: string
): Promise<{ code: string }> {
  // Generate a cryptographically secure 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  // Store in memory keyed by accountId
  pendingDeletions.set(accountId, {
    code,
    email: email.toLowerCase(),
    accountId,
    userId,
    expiresAt,
  });

  // Dispatch the email containing the 6-digit OTP code directly via SMTP
  try {
    await sendDeletionOtpEmail(email, code);
    console.log(`[account-delete] OTP email successfully sent to ${email}`);
  } catch (err) {
    console.error("[account-delete] Error sending OTP email via SMTP:", err);
    throw new Error("Failed to send OTP email. Please check SMTP settings or try again.");
  }

  return { code };
}

/**
 * Verifies the 6-digit code for a given account.
 */
export async function verifyDeletionCode(
  accountId: string,
  email: string,
  inputCode: string
): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = inputCode.trim();

  const request = pendingDeletions.get(accountId);
  if (
    request &&
    request.email === normalizedEmail &&
    request.expiresAt > Date.now() &&
    request.code === normalizedCode
  ) {
    pendingDeletions.delete(accountId);
    return true;
  }

  return false;
}
