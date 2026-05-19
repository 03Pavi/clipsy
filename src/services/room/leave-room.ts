import { doc, deleteDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { deviceStorage } from '../../lib/device/device-storage';
import { getDeviceName } from '../../lib/device/get-device-name';

/**
 * Leave a room — removes the current device's participant document and updates presence.
 * @param roomId The room to leave.
 * @param userId   The auth UID of the leaving user.
 */
export async function leaveRoom(roomId: string, userId: string) {
  const deviceId = deviceStorage.getDeviceId();

  // Remove participant document
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, `${userId}_${deviceId}`);
  await deleteDoc(participantRef);

  // Remove record from user's recent rooms in redux persisted store
  // (handled by caller — see useSyncRoom / DashboardPage)

  return { success: true, roomId, userId, deviceId };
}
