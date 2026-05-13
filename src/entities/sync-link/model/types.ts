// src/entities/sync-link/model/types.ts
export type SyncMode = 'private' | 'global';

export interface SyncLink {
  id: string;
  ownerId: string;               // User UID who owns the link
  deviceIds: string[];           // List of device IDs in this link
  mode: SyncMode;
  status: 'active' | 'paused' | 'revoked';
  createdAt: number;
}
