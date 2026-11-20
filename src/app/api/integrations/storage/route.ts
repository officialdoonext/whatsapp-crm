import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('viewer');

    const { data, error } = await supabase
      .from('storage_integrations')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    if (error && error.code !== '42P01') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Default configuration if none saved yet
    const config = data || {
      imagekit_config: { publicKey: '', privateKey: '', urlEndpoint: '' },
      cloudinary_config: { cloudName: '', apiKey: '', apiSecret: '', uploadPreset: '' },
      media_preferences: {
        images: 'imagekit',
        documents: 'imagekit',
        videos: 'cloudinary',
        audio: 'cloudinary',
      },
    };

    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch storage integrations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');
    const body = await request.json();

    const { imagekit_config, cloudinary_config, media_preferences } = body;

    const payload = {
      account_id: accountId,
      imagekit_config: imagekit_config || {},
      cloudinary_config: cloudinary_config || {},
      media_preferences: media_preferences || {
        images: 'imagekit',
        documents: 'imagekit',
        videos: 'cloudinary',
        audio: 'cloudinary',
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('storage_integrations')
      .upsert(payload, { onConflict: 'account_id' })
      .select()
      .single();

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json(
          { error: 'Table storage_integrations missing. Please run migration 058.' },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, integrations: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save storage integrations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
