import { useEffect } from 'react';
import { useParticipantStore } from '../stores/participant-store';
import { subscribeParticipants } from '../services/participants/subscribe-participants';

export function useRoomParticipants(roomId: string | undefined) {
  const { participants, isLoading, setParticipants, setLoading } = useParticipantStore();

  useEffect(() => {
    if (!roomId) {
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeParticipants(roomId, (pts) => {
      setParticipants(pts);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, setParticipants, setLoading]);

  return { participants, isLoading };
}
