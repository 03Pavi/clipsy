import { collection, query, where, orderBy, getDocs, limit, startAfter } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { ClipboardItem } from '../../types/clipboard.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

/**
 * Fetch the full clipboard history for a given room.
 * Returns up to `limitCount` items sorted by createdAt descending.
 */
export async function getRoomClipboard(
  roomId: string,
  limitCount: number = 100
): Promise<ClipboardItem[]> {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const q = query(itemsRef, orderBy('createdAt', 'desc'), limit(limitCount));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as ClipboardItem);
}

/**
 * Fetch clipboard items for a specific user inside a room.
 */
export async function getUserClipboard(
  roomId: string,
  userId: string,
  limitCount: number = 100
): Promise<ClipboardItem[]> {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const q = query(
    itemsRef,
    where('createdByUserId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data() as ClipboardItem);
}
