import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { deviceStorage } from '../../lib/device/device-storage';
import { getDeviceName } from '../../lib/device/get-device-name';

export async function addParticipant(roomId: string, userId: string, role: 'owner' | 'member' = 'member') {
  const deviceId = deviceStorage.getDeviceId();
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, `${userId}_${deviceId}`);
  
  await setDoc(participantRef, {
    id: `${userId}_${deviceId}`,
    roomId,
    userId,
    deviceId,
    deviceName: getDeviceName(),
    joinedAt: Date.now(),
    role,
  }, { merge: true });
}
