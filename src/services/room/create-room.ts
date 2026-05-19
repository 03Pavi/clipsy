import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase-client';
import { Room } from '../../types/room.types';
import { COLLECTIONS } from '../../constants/firebase.constants';
import { generateSyncCode } from '../../lib/helpers/generate-sync-code';
import { ROOM_SYNC_CODE_LENGTH } from '../../constants/room.constants';
import { deviceStorage } from '../../lib/device/device-storage';
import { getDeviceName } from '../../lib/device/get-device-name';

export async function createRoom(userId: string, name: string): Promise<Room> {
  const roomsRef = collection(db, COLLECTIONS.ROOMS);
  const roomId = doc(roomsRef).id;
  
  // ensure unique sync code
  let syncCode = generateSyncCode(ROOM_SYNC_CODE_LENGTH);
  let isUnique = false;
  while (!isUnique) {
    const q = query(roomsRef, where('syncCode', '==', syncCode));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      isUnique = true;
    } else {
      syncCode = generateSyncCode(ROOM_SYNC_CODE_LENGTH);
    }
  }

  const newRoom: Room = {
    id: roomId,
    name,
    syncCode,
    createdBy: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await setDoc(doc(db, COLLECTIONS.ROOMS, roomId), newRoom);

  // add creator as participant
  const deviceId = deviceStorage.getDeviceId();
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, `${userId}_${deviceId}`);
  
  await setDoc(participantRef, {
    id: `${userId}_${deviceId}`,
    roomId,
    userId,
    deviceId,
    deviceName: getDeviceName(),
    joinedAt: Date.now(),
    role: 'owner'
  });

  return newRoom;
}
