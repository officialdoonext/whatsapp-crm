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

  // Query account config using select('*') to be resilient to column name variations across migrations
  const builder = db
    .from('whatsapp_config')
    .select('*')
    .eq('account_id', accountId) as unknown as {
      maybeSingle?: () => Promise<{ data: any; error: any }>;
      single?: () => Promise<{ data: any; error: any }>;
    };

  let config: any = null;
  let error: any = null;

  if (typeof builder?.maybeSingle === 'function') {
    const res = await builder.maybeSingle();
    config = res?.data;
    error = res?.error;
  }

  if (!config && typeof builder?.single === 'function') {
    try {
      const singleRes = await builder.single();
      if (singleRes?.data) {
        config = singleRes.data;
        error = singleRes.error;
      }
    } catch {
      // Ignore
    }
  }

  // Fallback to the latest whatsapp_config record if no matching account_id found
  // (handles single-tenant workspaces, legacy rows, or workspace id transitions)
  if (!config) {
    const query = db.from('whatsapp_config').select('*') as unknown as {
      order?: (col: string, opts?: { ascending?: boolean }) => {
        limit: (n: number) => { maybeSingle: () => Promise<{ data: typeof config }> }
      };
    };

    if (typeof query.order === 'function') {
      const fallbackRes = await query
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackRes.data) {
        console.warn('[config-cache] Falling back to default whatsapp_config row for account:', accountId);
        config = fallbackRes.data;
      }
    }
  }

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
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[config-cache] Failed to decrypt access_token for account:', accountId, msg);
    throw new Error(
      `Failed to decrypt WhatsApp access token (${msg}). Please verify ENCRYPTION_KEY in your environment or re-save WhatsApp settings in Settings → WhatsApp.`
    );
  }

  let decryptedVerifyToken: string | null = null;
  if (config.verify_token) {
    try {
      decryptedVerifyToken = decrypt(config.verify_token);
    } catch {
      decryptedVerifyToken = config.verify_token;
    }
  }

  const result: DecryptedWhatsAppConfig = {
    phoneNumberId: config.phone_number_id,
    accessToken: decryptedToken,
    businessAccountId: config.waba_id ?? config.business_account_id ?? null,
    verifyToken: decryptedVerifyToken,
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
