import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export async function GET() {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data: templates, error } = await supabase
      .from('message_templates')
      .select('id, name, status, category, language')
      .eq('user_id', accountId)
      .order('name', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ templates: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
