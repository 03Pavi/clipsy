export interface Room {
  id: string;
  name: string;
  syncCode: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isPrivate?: boolean;
  isTemporary?: boolean;
  activeScreenShare?: {
    sharerId: string;
    sharerName: string;
    active: boolean;
    type?: 'screen' | 'camera';
    startedAt: number;
  };
  activeStreams?: Record<string, {
    sharerId: string;
    sharerName: string;
    active: boolean;
    type?: 'screen' | 'camera';
    startedAt: number;
  }>;
}
