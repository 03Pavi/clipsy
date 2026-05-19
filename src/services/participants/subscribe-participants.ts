import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Participant } from '../../types/participant.types';
import { COLLECTIONS } from '../../constants/firebase.constants';

export function subscribeParticipants(roomId: string, callback: (participants: Participant[]) => void) {
  const participantsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`);
  const q = query(participantsRef, orderBy('joinedAt', 'asc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map(doc => doc.data() as Participant);
    callback(participants);
  });

  return unsubscribe;
}
