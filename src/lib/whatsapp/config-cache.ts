// ============================================================
// Secure In-Memory WhatsApp Config & Credentials Cache
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/whatsapp/encryption';

export interface DecryptedWhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessAccountId?: string | null;
  verifyToken?: string | null;
  mirrorInboundMedia: boolean;
}

interface CacheEntry {
  config: DecryptedWhatsAppConfig;
  expiresAt: number;
}

const CONFIG_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const configCache = new Map<string, CacheEntry>();

/**
 * Get decrypted WhatsApp configuration for an account with in-memory caching.
 * Avoids repeated database lookups and decryption overhead during broadcast or automation loops.
 */
export async function getCachedWhatsAppConfig(
  db: SupabaseClient,
  accountId: string,
  forceRefresh = false
): Promise<DecryptedWhatsAppConfig | null> {
  const now = Date.now();
  if (!forceRefresh) {
    const cached = configCache.get(accountId);
    if (cached && cached.expiresAt > now) {
      return cached.config;
    }
  }

  const query = db
    .from('whatsapp_config')
    .select('phone_number_id, access_token, business_account_id, verify_token, mirror_inbound_media')
    .eq('account_id', accountId);

  const { data: config, error } = typeof (query as unknown as { single?: unknown }).single === 'function'
    ? await query.single()
    : await query.maybeSingle();

  if (error || !config || !config.access_token) {
    if (error) {
      console.error('[config-cache] Error fetching whatsapp_config for account:', accountId, error.message);
    }
    return null;
  }

  let decryptedToken = '';
  try {
    decryptedToken = decrypt(config.access_token);
  } catch (err) {
    console.error('[config-cache] Failed to decrypt access_token for account:', accountId, err);
    return null;
  }

  const result: DecryptedWhatsAppConfig = {
    phoneNumberId: config.phone_number_id,
    accessToken: decryptedToken,
    businessAccountId: config.business_account_id,
    verifyToken: config.verify_token ? decrypt(config.verify_token) : null,
    mirrorInboundMedia: config.mirror_inbound_media !== false,
  };

  configCache.set(accountId, {
    config: result,
    expiresAt: now + CONFIG_CACHE_TTL_MS,
  });

  return result;
}

/**
 * Invalidate cached credentials for an account (e.g. after updating settings).
 */
export function invalidateWhatsAppConfig(accountId: string): void {
  configCache.delete(accountId);
}

/**
 * Clear the entire config cache (useful for testing).
 */
export function clearWhatsAppConfigCache(): void {
  configCache.clear();
}
