import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Room } from '../../types/room.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void) {
  const roomRef = doc(db, COLLECTIONS.ROOMS, roomId);
  
  const unsubscribe = onSnapshot(roomRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as Room);
    } else {
      callback(null);
    }
  });

  return unsubscribe;
}
