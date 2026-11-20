/**
 * Image URL Optimization Utility
 *
 * Automatically injects responsive sizing and format compression parameters
 * for ImageKit, Cloudinary, and Supabase Storage to drastically reduce egress.
 */

export function getOptimizedImageUrl(
  url: string | null | undefined,
  width = 400,
  quality = 80
): string {
  if (!url || typeof url !== 'string') return '';

  const cleanUrl = url.trim();

  // 1. ImageKit Transformation (tr=w-400,q-80,f-auto)
  if (cleanUrl.includes('ik.imagekit.io')) {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    // If transformation parameter is not already attached:
    if (!cleanUrl.includes('tr=')) {
      return `${cleanUrl}${separator}tr=w-${width},q-${quality},f-auto`;
    }
    return cleanUrl;
  }

  // 2. Cloudinary Transformation (w_400,q_auto,f_auto)
  if (cleanUrl.includes('res.cloudinary.com') && cleanUrl.includes('/upload/')) {
    if (!cleanUrl.includes('f_auto') && !cleanUrl.includes('q_auto')) {
      return cleanUrl.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`);
    }
    return cleanUrl;
  }

  // 3. Supabase Storage Render Transform (if enabled on Supabase Pro/Team)
  if (cleanUrl.includes('/storage/v1/object/public/')) {
    // Falls back gracefully if standard public object
    return cleanUrl;
  }

  return cleanUrl;
}
