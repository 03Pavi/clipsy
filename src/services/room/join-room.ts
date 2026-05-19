import { collection, doc, setDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Room } from '../../types/room.types';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { deviceStorage } from '../../lib/device/device-storage';
import { getDeviceName } from '../../lib/device/get-device-name';

export async function joinRoomBySyncCode(userId: string, syncCode: string): Promise<Room> {
  const roomsRef = collection(db, COLLECTIONS.ROOMS);
  const q = query(roomsRef, where('syncCode', '==', syncCode.toUpperCase()));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    throw new Error('Room not found or invalid sync code.');
  }

  const roomDoc = querySnapshot.docs[0];
  const roomData = roomDoc.data() as Room;
  const roomId = roomDoc.id;

  const deviceId = deviceStorage.getDeviceId();
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, `${userId}_${deviceId}`);
  
  await setDoc(participantRef, {
    id: `${userId}_${deviceId}`,
    roomId,
    userId,
    deviceId,
    deviceName: getDeviceName(),
    joinedAt: Date.now(),
    role: 'member'
  }, { merge: true });

  return roomData;
}
