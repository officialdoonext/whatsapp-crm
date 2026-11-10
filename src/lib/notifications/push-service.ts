// ============================================================
// Firebase Cloud Messaging (FCM) Push Notification Service
//
// Sends push notifications to mobile devices (menext app) via
// Firebase Cloud Messaging HTTP v1 API.
//
// Works in both Next.js server runtime and standalone Railway worker.
// ============================================================

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface FirebaseServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

export const DEFAULT_NOTIFICATION_IMAGE_URL = 'https://ik.imagekit.io/doonext/menext/app-icon.png';

export interface SendPushNotificationOptions {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  channelId?: string;
  imageUrl?: string;
}

export interface InboundMessageNotificationParams {
  accountId: string;
  conversationId: string;
  contactId?: string;
  contactName: string;
  messageText: string;
  contentType?: string;
  messageId?: string;
  assignedUserId?: string | null;
  imageUrl?: string;
}

// In-memory token cache to avoid requesting an OAuth2 token on every push
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

/**
 * Resolve Firebase service account credentials from environment variables or file
 */
export function getFirebaseCredentials(): FirebaseServiceAccountCredentials | null {
  const envRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

  if (envRaw) {
    try {
      // Check if it's a JSON string
      const parsed = JSON.parse(envRaw);
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: parsed.private_key,
        };
      }
    } catch {
      // Not raw JSON, might be a path or formatted string
    }
  }

  // Also support individual environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID || 'menext-app-4c541';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (clientEmail && privateKey) {
    // Handle escaped newlines in environment variable
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  return null;
}

/**
 * Generate Google OAuth2 Bearer Token for FCM HTTP v1 using RS256 JWT
 */
export async function getGoogleAccessToken(
  creds: FirebaseServiceAccountCredentials
): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 5 more minutes
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token;
  }

  try {
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' })
    ).toString('base64url');

    const claimSet = Buffer.from(
      JSON.stringify({
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');

    const unsignedJwt = `${header}.${claimSet}`;

    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    const signature = signer.sign(creds.private_key, 'base64url');

    const signedJwt = `${unsignedJwt}.${signature}`;

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[PushService] OAuth2 token exchange failed:', res.status, errText);
      return null;
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: now + (data.expires_in || 3600),
    };

    return cachedAccessToken.token;
  } catch (err) {
    console.error('[PushService] Failed to obtain Google OAuth token:', err);
    return null;
  }
}

/**
 * Send a single FCM push notification to a device token via FCM HTTP v1
 */
export async function sendPushNotification(
  options: SendPushNotificationOptions
): Promise<{ success: boolean; unregistered?: boolean; error?: string }> {
  const creds = getFirebaseCredentials();
  if (!creds) {
    console.warn(
      '[PushService] Push notification skipped: FIREBASE_SERVICE_ACCOUNT credentials not set in environment (Project: menext-app-4c541)'
    );
    return { success: false, error: 'Firebase credentials missing' };
  }

  const accessToken = await getGoogleAccessToken(creds);
  if (!accessToken) {
    return { success: false, error: 'Failed to authenticate with Google FCM' };
  }

  const channelId = options.channelId || 'inbox_messages_v2';
  const imageUrl = options.imageUrl || DEFAULT_NOTIFICATION_IMAGE_URL;

  const fcmPayload = {
    message: {
      token: options.token,
      notification: {
        title: options.title,
        body: options.body,
        image: imageUrl,
      },
      data: {
        ...(options.data || {}),
        imageUrl,
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: channelId,
          sound: 'default',
          color: '#00A859',
          icon: 'ic_notification',
          image: imageUrl,
          default_vibrate_timings: true,
          default_sound: true,
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(fcmPayload),
      }
    );

    if (res.ok) {
      return { success: true };
    }

    const errorJson = (await res.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string; status?: string };
    };

    const isUnregistered =
      errorJson.error?.status === 'NOT_FOUND' ||
      errorJson.error?.message?.includes('UNREGISTERED') ||
      errorJson.error?.message?.includes('registration token is not valid');

    console.warn('[PushService] FCM send error response:', res.status, errorJson);

    return {
      success: false,
      unregistered: isUnregistered,
      error: errorJson.error?.message || `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[PushService] FCM request exception:', errMsg);
    return { success: false, error: errMsg };
  }
}

/**
 * Dispatch push notifications to all assigned agents and account owners for an inbound WhatsApp message
 */
export async function dispatchInboundPushNotification(
  db: SupabaseClient,
  params: InboundMessageNotificationParams
): Promise<{ dispatched: number; failed: number }> {
  const {
    accountId,
    conversationId,
    contactId,
    contactName,
    messageText,
    assignedUserId,
  } = params;

  try {
    // Query recipient profiles in this account with active status and an FCM token
    let query = db
      .from('profiles')
      .select('id, user_id, fcm_token, full_name, email, account_role, status')
      .eq('account_id', accountId)
      .not('fcm_token', 'is', null);

    // If an agent is assigned, send to that agent + owners/admins; otherwise send to all active members
    const { data: profiles, error } = await query;

    if (error || !profiles || profiles.length === 0) {
      return { dispatched: 0, failed: 0 };
    }

    let targets = profiles.filter((p) => p.fcm_token && p.status !== 'inactive');

    // If a specific user is assigned, ensure they are included or prioritized
    if (assignedUserId) {
      const assignedProfile = targets.find((p) => p.user_id === assignedUserId);
      if (assignedProfile) {
        // Send to assigned agent + admins/owners
        targets = targets.filter(
          (p) =>
            p.user_id === assignedUserId ||
            p.account_role === 'owner' ||
            p.account_role === 'admin'
        );
      }
    }

    let dispatched = 0;
    let failed = 0;

    const notifTitle = `💬 ${contactName || 'New Message'}`;
    const notifBody = messageText || 'Sent a WhatsApp message';
    const notifImage = params.imageUrl || DEFAULT_NOTIFICATION_IMAGE_URL;

    const notifData: Record<string, string> = {
      type: 'chat',
      screen: 'Chat',
      conversationId,
      contactId: contactId || '',
      senderName: contactName || 'Customer',
      channelId: 'inbox_messages_v2',
      imageUrl: notifImage,
    };

    for (const profile of targets) {
      if (!profile.fcm_token) continue;

      const result = await sendPushNotification({
        token: profile.fcm_token,
        title: notifTitle,
        body: notifBody,
        data: notifData,
        channelId: 'inbox_messages_v2',
        imageUrl: notifImage,
      });

      if (result.success) {
        dispatched++;
      } else {
        failed++;
        // If device token is unregistered/expired, clear it so we don't repeat calls
        if (result.unregistered) {
          console.info(`[PushService] Removing expired FCM token for user ${profile.user_id}`);
          void db
            .from('profiles')
            .update({ fcm_token: null })
            .eq('id', profile.id);
        }
      }
    }

    return { dispatched, failed };
  } catch (err) {
    console.error('[PushService] dispatchInboundPushNotification error:', err);
    return { dispatched: 0, failed: 0 };
  }
}

