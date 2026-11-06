import '@/workers/websocket-polyfill'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { StubWebSocket } from '@/workers/websocket-polyfill'

// Lazy, shared service-role client for the AI auto-reply path.
let _adminClient: SupabaseClient | null = null

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
