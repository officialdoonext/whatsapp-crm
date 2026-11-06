import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy, shared service-role client for automation engine work.
// Mirrors the pattern used by the webhook handler
// (src/app/api/whatsapp/webhook/route.ts).
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

    _adminClient = createClient(supabaseUrl, serviceRoleKey)
  }
  return _adminClient
}
