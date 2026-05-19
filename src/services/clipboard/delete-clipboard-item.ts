import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';

export const deleteClipboardItem = async (roomId: string, itemId: string) => {
  try {
    const itemRef = doc(db, 'rooms', roomId, 'clipboard-items', itemId);
    await deleteDoc(itemRef);
  } catch (error) {
    console.error('Error deleting clipboard item:', error);
    throw error;
  }
};
