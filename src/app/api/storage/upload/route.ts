import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/account';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('agent');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileType = (formData.get('fileType') as string) || 'images'; // 'images' | 'documents' | 'videos' | 'audio'
    const fileName = (formData.get('fileName') as string) || file?.name || `upload_${Date.now()}.jpg`;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 1. Fetch account's storage integrations & routing preferences
    const { data: integrations } = await supabase
      .from('storage_integrations')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    const prefs = integrations?.media_preferences || {
      images: 'imagekit',
      documents: 'imagekit',
      videos: 'cloudinary',
      audio: 'cloudinary',
    };

    const targetProvider: 'imagekit' | 'cloudinary' =
      prefs[fileType as keyof typeof prefs] || 'imagekit';

    const imagekitConfig = integrations?.imagekit_config || {};
    const cloudinaryConfig = integrations?.cloudinary_config || {};

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 2. Upload via ImageKit if selected and configured
    if (targetProvider === 'imagekit' && imagekitConfig?.privateKey) {
      try {
        const ikFormData = new FormData();
        const blob = new Blob([fileBuffer], { type: file.type || 'image/jpeg' });
        ikFormData.append('file', blob, fileName);
        ikFormData.append('fileName', fileName);
        ikFormData.append('useUniqueFileName', 'true');
        ikFormData.append('folder', '/products');

        const authHeader = 'Basic ' + Buffer.from(imagekitConfig.privateKey + ':').toString('base64');

        const ikRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
          method: 'POST',
          headers: {
            Authorization: authHeader,
          },
          body: ikFormData,
        });

        const ikData = await ikRes.json();
        if (ikRes.ok && ikData.url) {
          return NextResponse.json({
            url: ikData.url,
            provider: 'imagekit',
            fileId: ikData.fileId,
            name: ikData.name,
            size: ikData.size,
          });
        } else {
          console.warn('[ImageKit Upload Error]', ikData);
          // Fall through to fallback
        }
      } catch (err) {
        console.warn('[ImageKit Upload Exception]', err);
      }
    }

    // 3. Upload via Cloudinary if selected and configured
    if (
      (targetProvider === 'cloudinary' || !imagekitConfig?.privateKey) &&
      cloudinaryConfig?.cloudName &&
      (cloudinaryConfig?.apiKey || cloudinaryConfig?.uploadPreset)
    ) {
      try {
        const cloudName = cloudinaryConfig.cloudName;
        const cldFormData = new FormData();
        const blob = new Blob([fileBuffer], { type: file.type || 'image/jpeg' });
        cldFormData.append('file', blob, fileName);

        if (cloudinaryConfig.uploadPreset) {
          cldFormData.append('upload_preset', cloudinaryConfig.uploadPreset);
        } else if (cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret) {
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const folder = 'products';
          const stringToSign = `folder=${folder}&timestamp=${timestamp}${cloudinaryConfig.apiSecret}`;
          const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

          cldFormData.append('api_key', cloudinaryConfig.apiKey);
          cldFormData.append('timestamp', timestamp);
          cldFormData.append('signature', signature);
          cldFormData.append('folder', folder);
        }

        const resourceType = fileType === 'videos' ? 'video' : fileType === 'documents' ? 'raw' : 'image';
        const cldRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
          {
            method: 'POST',
            body: cldFormData,
          }
        );

        const cldData = await cldRes.json();
        if (cldRes.ok && (cldData.secure_url || cldData.url)) {
          return NextResponse.json({
            url: cldData.secure_url || cldData.url,
            provider: 'cloudinary',
            publicId: cldData.public_id,
            format: cldData.format,
            bytes: cldData.bytes,
          });
        } else {
          console.warn('[Cloudinary Upload Error]', cldData);
        }
      } catch (err) {
        console.warn('[Cloudinary Upload Exception]', err);
      }
    }

    // 4. Graceful Fallback (Supabase Storage or Base64 Data URL for testing)
    // Try uploading to Supabase Storage bucket 'media' or 'catalog'
    const storagePath = `products/${accountId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data: sData, error: sErr } = await supabase.storage
      .from('media')
      .upload(storagePath, fileBuffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (!sErr && sData) {
      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(storagePath);
      return NextResponse.json({
        url: publicUrlData.publicUrl,
        provider: 'supabase',
        fileName,
        note: 'Uploaded to local storage. Configure ImageKit or Cloudinary in Integrations for direct CDN delivery.',
      });
    }

    // Direct Data URL fallback for instant testing when no storage bucket exists
    const base64Data = `data:${file.type || 'image/jpeg'};base64,${fileBuffer.toString('base64')}`;
    return NextResponse.json({
      url: base64Data,
      provider: 'local',
      fileName,
      note: 'Saved as optimized data URL. Configure ImageKit/Cloudinary in Integrations to enable cloud CDN hosting.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
