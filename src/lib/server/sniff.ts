/** Sniff magic bytes so a renamed file or HTML payload is rejected before it costs money. */
export function sniffImage(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  return null;
}

/** Map a browser MediaRecorder MIME type (or file extension) to the format name the STT API wants. */
export function audioFormat(mime: string, filename: string): string | null {
  const m = `${mime} ${filename}`.toLowerCase();
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'm4a';
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg') || m.includes('opus')) return 'ogg';
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  return null;
}
