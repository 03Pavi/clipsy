import { ref, onValue } from 'firebase/database';
import { rtdb, db } from '../../config/firebase-client';
import { Device } from '../../types/device.types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS } from '../../constants/firebase.constants';

// This is a simplified version. In reality, you might track devices by querying participants of a room
// and then merging with RTDB status.
export function subscribeDeviceStatus(roomId: string, callback: (devices: Device[]) => void) {
  const participantsRef = collection(db, `${COLLECTIONS.ROOMS}/${roomId}/${COLLECTIONS.PARTICIPANTS}`);
  
  const unsubscribeFirestore = onSnapshot(participantsRef, (snapshot) => {
    const devicesList: Device[] = [];
    let pending = snapshot.docs.length;
    
    if (pending === 0) {
      callback([]);
      return;
    }

    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data();
      const userId = data.userId;
      const deviceId = data.deviceId;

      // Listen to RTDB for each participant's device
      const statusRef = ref(rtdb, `/status/${userId}/${deviceId}`);
      onValue(statusRef, (statusSnap) => {
        const status = statusSnap.val();
        
        const deviceData: Device = {
          id: deviceId,
          userId,
          deviceName: data.deviceName || 'Unknown', // Ideally saved in participant doc
          online: status?.state === 'online',
          lastSeen: status?.last_changed || 0,
          createdAt: data.joinedAt,
        };

        const existingIndex = devicesList.findIndex(d => d.id === deviceId);
        if (existingIndex > -1) {
          devicesList[existingIndex] = deviceData;
        } else {
          devicesList.push(deviceData);
        }
        
        callback([...devicesList]);
      });
    });
  });

  return () => {
    unsubscribeFirestore();
  };
}
