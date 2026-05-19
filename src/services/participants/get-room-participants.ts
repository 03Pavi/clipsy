import { collection, query, where, orderBy, onSnapshot, limit, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { Participant } from '../../types/participant.types';

/**
 * Subscribe to realtime participant list for a room (for populating users view / device list).
 * Fires the callback with the current list and every subsequent change.
 */
export function subscribeRoomParticipants(
  roomId: string,
  callback: (participants: Participant[]) => void
): () => void {
  const participantsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`);
  const q = query(participantsRef, orderBy('joinedAt', 'asc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const participants = snapshot.docs.map((docSnap) => docSnap.data() as Participant);
      callback(participants);
    },
    (error) => {
      console.error('[participants] subscribeRoomParticipants error:', error);
      callback([]);
    }
  );
}

/**
 * Fetch the active participant list once (no realtime subscription).
 */
export async function getRoomParticipants(roomId: string): Promise<Participant[]> {
  const participantsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`);
  const q = query(participantsRef, orderBy('joinedAt', 'asc'), limit(50));

  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => docSnap.data() as Participant);
}
