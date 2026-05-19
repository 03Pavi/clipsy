import { ref, onValue, set, onDisconnect, serverTimestamp } from 'firebase/database';
import { rtdb, db } from '../../config/firebase-client';
import { Device } from '../../types/device.types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export async function setDeviceOnline(userId: string, deviceId: string, deviceName: string) {
  const deviceStatusRef = ref(rtdb, `/status/${userId}/${deviceId}`);
  
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: serverTimestamp(),
  };

  const isOnlineForDatabase = {
    state: 'online',
    last_changed: serverTimestamp(),
  };

  // Connected status from Firebase core
  const connectedRef = ref(rtdb, '.info/connected');
  
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(deviceStatusRef).set(isOfflineForDatabase).then(() => {
        set(deviceStatusRef, isOnlineForDatabase);
      });
    }
  });
}

export async function setDeviceOffline(userId: string, deviceId: string) {
  const deviceStatusRef = ref(rtdb, `/status/${userId}/${deviceId}`);
  const isOfflineForDatabase = {
    state: 'offline',
    last_changed: serverTimestamp(),
  };
  await set(deviceStatusRef, isOfflineForDatabase);
}
