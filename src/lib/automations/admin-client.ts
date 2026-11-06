import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
let _adminClient: SupabaseClient | null = null

class StubWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3
  readonly readyState = 3
  readonly url = ''
  readonly protocol = ''
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = StubWebSocket as unknown as typeof WebSocket
}

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl) {
      throw new Error(
        'Supabase URL is required. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL in your environment variables.'
      )
    }
    if (!serviceRoleKey) {
      throw new Error(
        'Supabase service role key is required. Set SUPABASE_SERVICE_ROLE_KEY in your environment variables.'
      )
    }

    const transport = typeof globalThis.WebSocket !== 'undefined'
      ? globalThis.WebSocket
      : StubWebSocket

    _adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        transport: transport as never,
      },
    })
  }
  return _adminClient
}
