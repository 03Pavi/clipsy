import { doc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase-client';

export const deleteRoomFromFirebase = async (roomId: string, userId?: string) => {
  try {
    const roomRef = doc(db, 'rooms', roomId);
    
    // Delete all clipboard items in subcollection
    const itemsSnapshot = await getDocs(collection(db, 'rooms', roomId, 'clipboard-items'));
    const deleteItemsPromises = itemsSnapshot.docs.map(itemDoc => deleteDoc(itemDoc.ref));
    await Promise.all(deleteItemsPromises);

    // Delete all participants in subcollection
    const participantsSnapshot = await getDocs(collection(db, 'rooms', roomId, 'participants'));
    const deleteParticipantsPromises = participantsSnapshot.docs.map(partDoc => deleteDoc(partDoc.ref));
    await Promise.all(deleteParticipantsPromises);

    // Finally delete the room document itself
    await deleteDoc(roomRef);

    // Delete the room from the user's history if userId is provided
    if (userId) {
      const userRoomRef = doc(db, 'users', userId, 'joinedRooms', roomId);
      await deleteDoc(userRoomRef);
    }
  } catch (error) {
    console.error('Error deleting room from Firebase:', error);
    throw error;
  }
};
