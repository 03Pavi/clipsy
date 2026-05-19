import { setDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { deviceStorage } from '../../lib/device/device-storage';

export async function setDeviceOffline(userId: string, deviceId: string) {
  const statusRef = doc(db, 'status', userId, deviceId, 'state');
  await setDoc(statusRef, { state: 'offline', last_changed: Date.now() }, { merge: true });

  // Also update device document status
  const deviceDocRef = doc(db, COLLECTIONS.DEVICES, `${userId}_${deviceId}`);
  await setDoc(deviceDocRef, { status: 'offline', lastSeenAt: Date.now() }, { merge: true });
}
