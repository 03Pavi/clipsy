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
  const participantId = `${userId}_${deviceId}`;
  
  // 1. Check if already a participant
  const participantRef = doc(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`, participantId);
  const participantSnap = await getDoc(participantRef);
  
  if (participantSnap.exists()) {
    return roomData;
  }

  // 2. Handle private room access permissions
  if (roomData.isPrivate && roomData.createdBy !== userId) {
    const requestRef = doc(db, 'rooms', roomId, 'requests', userId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      await setDoc(requestRef, {
        userId,
        userName: getDeviceName(),
        deviceName: getDeviceName(),
        requestedAt: Date.now(),
        status: 'pending'
      });
      throw new Error('PRIVATE_ROOM_REQUEST_PENDING');
    }

    const requestData = requestSnap.data();
    if (requestData?.status === 'pending') {
      throw new Error('PRIVATE_ROOM_REQUEST_PENDING');
    } else if (requestData?.status === 'rejected') {
      // Re-knock: Reset status back to pending to allow joining again
      await setDoc(requestRef, {
        userId,
        userName: getDeviceName(),
        deviceName: getDeviceName(),
        requestedAt: Date.now(),
        status: 'pending'
      });
      throw new Error('PRIVATE_ROOM_REQUEST_PENDING');
    }
  }

  // 3. Save participant record
  await setDoc(participantRef, {
    id: participantId,
    roomId,
    userId,
    deviceId,
    deviceName: getDeviceName(),
    joinedAt: Date.now(),
    role: 'member'
  }, { merge: true });

  // add to user's joinedRooms history
  await setDoc(doc(db, 'users', userId, 'joinedRooms', roomId), {
    id: roomId,
    name: roomData.name,
    syncCode: roomData.syncCode,
    joinedAt: Date.now(),
    createdBy: roomData.createdBy,
    isPrivate: roomData.isPrivate || false
  });

  return roomData;
}
