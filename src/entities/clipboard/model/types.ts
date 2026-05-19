// src/entities/clipboard/model/types.ts
export interface ClipboardItem {
  id: string;
  userId: string;                     // Owner UID
  sourceDeviceId: string;             // ID of the device that created this item
  syncLinkId: string;                 // ID of the SyncLink this belongs to (can be "global")
  roomId?: string;                    // Room ID for cross-user sync (optional)
  type: 'text' | 'image' | 'file' | 'code' | 'link' | 'doc' | 'palette';
  content: string;                    // Text content or file reference
  title?: string;
  fileUrl?: string;                   // Firebase Storage URL for images/files
  imageUrl?: string;                  // Legacy image URL fallback
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  metadata?: string;                  // JSON string for additional properties
  isPinned: boolean;                  // Priority status
  isTransient?: boolean;               // For temporary, mesh-synced items
  timestamp: number;                  // Unix Timestamp
}
