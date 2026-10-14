import type { User } from "@supabase/supabase-js";

export interface UserProfileStatus {
  status?: string | null;
  expiry_date?: string | null;
}

export type BlockReason = "unauthenticated" | "inactive" | "expired" | "no_expiry";

export interface UserAccessResult {
  isAllowed: boolean;
  reason: BlockReason | null;
  message: string;
  status: string;
  expiryDate: string | null;
}

export const ADMIN_CONTACT_PHONE = "8143538314";
export const ADMIN_CONTACT_PHONE_INTL = "+918143538314";
export const WHATSAPP_PREFILLED_MESSAGE = "request forenable CRM whats app automation";

/**
 * Checks whether an authenticated user meets the strict requirements
 * to enter the CRM:
 * 1. Status MUST be strictly 'active'
 * 2. Expiry date MUST be set and NOT exceeded (in the future)
 */
export function checkUserAccess(
  user: User | null | undefined,
  profile?: UserProfileStatus | null
): UserAccessResult {
  if (!user) {
    return {
      isAllowed: false,
      reason: "unauthenticated",
      message: "Please sign in to access your account.",
      status: "unauthenticated",
      expiryDate: null,
    };
  }

  // 1. Resolve status (check profile row first, fallback to user metadata, default to 'inactive')
  const rawStatus =
    (profile?.status as string | null | undefined) ??
    (user.user_metadata?.status as string | null | undefined) ??
    "inactive";
  const status = typeof rawStatus === "string" ? rawStatus.trim().toLowerCase() : "inactive";

  // 2. Resolve expiry date
  const expiryDate =
    (profile?.expiry_date as string | null | undefined) ??
    (user.user_metadata?.expiry_date as string | null | undefined) ??
    null;

  // 3. Strict Check: Status must be 'active'
  if (status !== "active") {
    return {
      isAllowed: false,
      reason: "inactive",
      message: "Your account is currently inactive. Please contact the administrator to activate your account.",
      status,
      expiryDate,
    };
  }

  // 4. Strict Check: Expiry date must exist
  if (!expiryDate) {
    return {
      isAllowed: false,
      reason: "no_expiry",
      message: "Your account subscription expiry date is not configured. Please contact the administrator.",
      status,
      expiryDate: null,
    };
  }

  // 5. Strict Check: Expiry date must not be exceeded
  const expiryTimestamp = new Date(expiryDate).getTime();
  if (isNaN(expiryTimestamp) || expiryTimestamp <= Date.now()) {
    return {
      isAllowed: false,
      reason: "expired",
      message: "Your account subscription has expired. Please contact the administrator to renew your access.",
      status,
      expiryDate,
    };
  }

  return {
    isAllowed: true,
    reason: null,
    message: "Access granted.",
    status,
    expiryDate,
  };
}

/**
 * Builds the WhatsApp direct chat link with prefilled message
 */
export function buildWhatsAppAdminUrl(userEmail?: string | null): string {
  const baseMessage = WHATSAPP_PREFILLED_MESSAGE;
  const messageWithEmail = userEmail
    ? `${baseMessage} for account: ${userEmail}`
    : baseMessage;
  const encodedText = encodeURIComponent(messageWithEmail);
  return `https://wa.me/91${ADMIN_CONTACT_PHONE}?text=${encodedText}`;
}

/**
 * Builds the direct tel: link for phone calls
 */
export function buildCallAdminUrl(): string {
  return `tel:${ADMIN_CONTACT_PHONE}`;
}
