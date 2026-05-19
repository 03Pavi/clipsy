export type ClipboardItemType = 'text' | 'code' | 'link' | 'image' | 'file';

export interface ClipboardItem {
  id: string;
  roomId: string;
  type: ClipboardItemType;
  content: string; // Text content, or original file name
  fileUrl?: string; // If image or file
  filePath?: string; // Storage path
  mimeType?: string;
  size?: number;
  createdByUserId: string;
  createdByDeviceId: string;
  createdAt: number;
}
