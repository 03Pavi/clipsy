import { ClipboardItem, ClipboardItemType } from '../../types/clipboard.types';
import { MAX_FILE_SIZE_BYTES } from '../../constants/clipboard.constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a clipboard item before it is stored or synced.
 */
export function validateClipboardItem(item: Partial<ClipboardItem>): ValidationResult {
  if (!item.type) {
    return { valid: false, error: 'Item type is required.' };
  }

  const validTypes: ClipboardItemType[] = ['text', 'code', 'link', 'image', 'file'];
  if (!validTypes.includes(item.type as ClipboardItemType)) {
    return { valid: false, error: `Invalid item type: ${item.type}` };
  }

  if (
    (item.type === 'text' || item.type === 'code' || item.type === 'link') &&
    (!item.content || item.content.trim() === '')
  ) {
    return { valid: false, error: 'Content is required for text, code, and link items.' };
  }

  if (item.type === 'link' && item.content) {
    try {
      new URL(item.content);
    } catch {
      return { valid: false, error: 'Content for link items must be a valid URL.' };
    }
  }

  if ((item.type === 'image' || item.type === 'file') && item.size != null) {
    if (item.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        error: `File exceeds maximum size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Strip inline event-handler attributes and <script> tags from raw HTML.
 * Feed result into MUI's `dangerouslySetInnerHTML` safely.
 */
export function sanitizeHTML(html: string): string {
  return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+(?:\s+on\w+\s*=\s*"[^"]*")[^>]*>/gi, '');
}

/**
 * Validate that a string is a valid CSS/hex colour code.
 */
export function isValidContentColor(color: string): boolean {
  return /^#?([a-fA-F0-9]{6}|[a-fA-F0-9]{3})$/.test(color);
}
