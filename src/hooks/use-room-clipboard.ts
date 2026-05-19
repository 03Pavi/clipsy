import { useEffect } from 'react';
import { useClipboardStore } from '../stores/clipboard-store';
import { subscribeClipboard } from '../services/clipboard/subscribe-clipboard';

export function useRoomClipboard(roomId: string | undefined) {
  const { items, isLoading, setItems, setLoading } = useClipboardStore();

  useEffect(() => {
    if (!roomId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeClipboard(roomId, (newItems) => {
      setItems(newItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [roomId, setItems, setLoading]);

  return { items, isLoading };
}
