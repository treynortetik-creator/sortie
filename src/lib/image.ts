/** Shrink a camera frame or picked photo to a JPEG that is small to store and cheap to read. */
export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;

export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

type Drawable = HTMLVideoElement | ImageBitmap | HTMLImageElement;

function dims(src: Drawable): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

export async function toJpeg(src: Drawable, max = MAX_EDGE, quality = JPEG_QUALITY): Promise<Blob> {
  const { w, h } = dims(src);
  if (!w || !h) throw new Error('Camera is not ready yet');
  const { width, height } = fitWithin(w, h, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(src, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Could not encode the photo');
  return blob;
}

/** Photos from the library or the native camera sheet. Honours EXIF rotation so portrait shots are upright. */
export async function fileToJpeg(file: File): Promise<Blob> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        return await toJpeg(bmp);
      } finally {
        bmp.close();
      }
    } catch {
      /* fall through to <img> decoding */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await toJpeg(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
