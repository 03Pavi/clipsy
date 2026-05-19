export interface Participant {
  id: string; // Document ID (usually same as deviceId or composite)
  roomId: string;
  userId: string;
  deviceId: string;
  joinedAt: number;
  role: 'owner' | 'member';
}
