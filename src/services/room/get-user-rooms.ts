import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Room } from '../../types/room.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

export function subscribeUserRooms(userId: string, callback: (rooms: Room[]) => void) {
  // A proper implementation would query a subcollection in users/{userId}/rooms
  // For now, we query rooms created by the user
  const roomsQuery = query(
    collection(db, COLLECTIONS.ROOMS),
    where('createdBy', '==', userId)
  );

  return onSnapshot(roomsQuery, (snapshot) => {
    const rooms = snapshot.docs.map(doc => doc.data() as Room);
    callback(rooms);
  });
}
