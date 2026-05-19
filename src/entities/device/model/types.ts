// src/entities/device/model/types.ts
export interface Device {
  id: string;                         // Firestore Doc ID
  deviceId: string;                   // Hardware-specific unique ID
  userId: string;                     // Owner UID
  name: string;                       // User-defined name
  platform: 'mobile' | 'desktop' | 'tablet' | 'web';
  os?: string;                        // e.g. "iOS 17.4", "Windows 11"
  browser?: string;                   // e.g. "Chrome 124"
  status: 'online' | 'offline';
  syncEnabled: boolean;
  lastSeenAt: number;                 // Unix Timestamp
  activeSyncLinkIds: string[];        // IDs of SyncLinks this device belongs to
  roomId?: string;                    // ID of the room this device belongs to (for cross-user sync)
}
