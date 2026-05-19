import { useEffect } from 'react';
import { useRoomStore } from '../stores/room-store';
import { subscribeRoom } from '../services/room/subscribe-room';

export function useRoom(roomId: string | undefined) {
  const { currentRoom, isLoading, setCurrentRoom, setLoading } = useRoomStore();

  useEffect(() => {
    if (!roomId) {
      setCurrentRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeRoom(roomId, (room) => {
      setCurrentRoom(room);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, setCurrentRoom, setLoading]);

  return { room: currentRoom, isLoading };
}
