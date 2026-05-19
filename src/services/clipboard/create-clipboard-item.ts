import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { ClipboardItem } from '../../types/clipboard.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

export async function createClipboardItem(item: Omit<ClipboardItem, 'id'>): Promise<string> {
  const itemsRef = collection(db, `${COLLECTIONS.ROOMS}/${item.roomId}/${COLLECTIONS.CLIPBOARD_ITEMS}`);
  const newItemRef = doc(itemsRef);
  
  const newItem: ClipboardItem = {
    ...item,
    id: newItemRef.id,
  };

  await setDoc(newItemRef, newItem);
  return newItemRef.id;
}
