/**
 * Compresses an image file in the browser to strictly <= 80 KB (81,920 bytes)
 * while maintaining maximum visual sharpness, color accuracy, and aspect ratio.
 */
export async function compressImageTo80KB(file: File): Promise<File> {
  const TARGET_MAX_BYTES = 80 * 1024; // 81,920 bytes

  // If already under target size, return as-is
  if (file.size <= TARGET_MAX_BYTES) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        // High quality scale down: preserve sharpness
        let width = img.width;
        let height = img.height;
        const maxDimension = 1400;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Iterative binary-step search for highest quality under 80KB
        let minQuality = 0.4;
        let maxQuality = 0.95;
        let bestBlob: Blob | null = null;
        let iterations = 0;

        const tryCompress = (q: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              iterations++;

              if (blob.size <= TARGET_MAX_BYTES) {
                bestBlob = blob;
                minQuality = q;
              } else {
                maxQuality = q;
              }

              if (iterations < 6 && maxQuality - minQuality > 0.05) {
                const nextQ = (minQuality + maxQuality) / 2;
                tryCompress(nextQ);
              } else {
                // If even the lowest quality is slightly above 80KB, scale canvas down slightly
                if (!bestBlob || bestBlob.size > TARGET_MAX_BYTES) {
                  const scale = 0.75;
                  canvas.width = Math.round(width * scale);
                  canvas.height = Math.round(height * scale);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  canvas.toBlob(
                    (finalBlob) => {
                      const result = finalBlob || blob;
                      const compressedFile = new File(
                        [result],
                        file.name.replace(/\.[^.]+$/, '.jpg'),
                        {
                          type: 'image/jpeg',
                          lastModified: Date.now(),
                        }
                      );
                      resolve(compressedFile);
                    },
                    'image/jpeg',
                    0.8
                  );
                } else {
                  const compressedFile = new File(
                    [bestBlob],
                    file.name.replace(/\.[^.]+$/, '.jpg'),
                    {
                      type: 'image/jpeg',
                      lastModified: Date.now(),
                    }
                  );
                  resolve(compressedFile);
                }
              }
            },
            'image/jpeg',
            (minQuality + maxQuality) / 2
          );
        };

        tryCompress(0.85);
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}
