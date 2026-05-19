import { collection, query, where, onSnapshot, limit as fsLimit, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { ClipboardItem } from '../../types/clipboard.types';

/**
 * Listen to realtime updates for all clipboard items inside a room.
 * Fires callback immediately with the current snapshot, then on every change.
 */
export function subscribeRoomClipboard(
  roomId: string,
  callback: (items: ClipboardItem[]) => void
): () => void {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const q = query(itemsRef, orderBy('createdAt', 'desc'), fsLimit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as ClipboardItem);
      callback(items);
    },
    (error) => {
      console.error('[clipboard-listeners] subscribeRoomClipboard error:', error);
    }
  );
}

/**
 * Listen to realtime updates for ONLY the current user's clipboard items inside a room.
 * Uses onSnapshot — fires on every change.
 */
export function subscribeOwnClipboard(
  roomId: string,
  userId: string,
  callback: (items: ClipboardItem[]) => void
): () => void {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const q = query(itemsRef, where('createdByUserId', '==', userId), orderBy('createdAt', 'desc'), fsLimit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as ClipboardItem);
      callback(items);
    },
    (error) => {
      console.error('[clipboard-listeners] subscribeOwnClipboard error:', error);
    }
  );
}
