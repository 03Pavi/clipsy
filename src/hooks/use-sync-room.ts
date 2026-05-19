import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { joinRoomBySyncCode } from '../services/room/join-room';
import { createRoom } from '../services/room/create-room';
import { useAuthStore } from '../stores/auth-store';

export function useSyncRoom() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuthStore();

  const handleJoinRoom = async (syncCode: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await joinRoomBySyncCode(user.uid, syncCode);
      router.push(`/room/${room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (name: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await createRoom(user.uid, name);
      router.push(`/room/${room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  return { handleJoinRoom, handleCreateRoom, isLoading, error };
}
