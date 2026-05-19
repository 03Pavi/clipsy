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

export interface Mesh {
  id: string;                    // e.g., "mesh_uid1_uid2"
  userIds: string[];             // The two user UIDs in this mesh
  deviceIds: string[];           // Device IDs belonging to this mesh
  createdAt: number;             // Unix timestamp
  status: 'active' | 'revoked';
}
