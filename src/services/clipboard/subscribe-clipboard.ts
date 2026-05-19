import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { ClipboardItem } from '../../types/clipboard.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

export function subscribeClipboard(roomId: string, callback: (items: ClipboardItem[]) => void) {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const q = query(itemsRef, orderBy('createdAt', 'desc'), limit(100));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => doc.data() as ClipboardItem);
    callback(items);
  });

  return unsubscribe;
}
