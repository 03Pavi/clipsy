import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';

export async function removeParticipant(roomId: string, participantId: string) {
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, participantId);
  await deleteDoc(participantRef);
}
