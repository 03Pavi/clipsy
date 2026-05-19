export interface Device {
  id: string; // Persistent device ID
  userId: string;
  deviceName: string;
  online: boolean;
  lastSeen: number;
  createdAt: number;
}
