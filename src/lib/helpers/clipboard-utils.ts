export function isValidUrl(string: string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function detectClipboardType(content: string, file?: File): 'text' | 'link' | 'image' | 'file' {
  if (file) {
    if (file.type.startsWith('image/')) return 'image';
    return 'file';
  }
  
  if (isValidUrl(content)) return 'link';
  
  return 'text';
}
