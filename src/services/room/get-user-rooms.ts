import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase-client';

export function subscribeUserRooms(userId: string, callback: (rooms: any[]) => void) {
  const joinedRoomsQuery = query(
    collection(db, 'users', userId, 'joinedRooms'),
    orderBy('joinedAt', 'desc')
  );

  return onSnapshot(joinedRoomsQuery, (snapshot) => {
    const rooms = snapshot.docs.map(doc => doc.data());
    callback(rooms);
  }, (error) => {
    console.error('Error fetching joined rooms:', error);
  });
}
