import { useEffect } from 'react';
import { db, auth } from '@/shared/api/firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { DeviceProfile } from './use-device';

export function usePresence(profile: DeviceProfile | null) {
  useEffect(() => {
    if (!profile || !auth.currentUser) return;

    const userUid = auth.currentUser.uid;
    
    const updatePresence = async (status: 'online' | 'offline') => {
      try {
        // Find the device document for this user and deviceId
        // Note: For efficiency, we should ideally have the firestore doc ID
        // but we can look it up or use a stable ID path: devices/{uid}_{deviceId}
        const deviceRef = doc(db, 'devices', `${userUid}_${profile.deviceId}`);
        
        // Check if doc exists, if not, it will be created by the register API call
        // we'll just attempt to update it here
        await updateDoc(deviceRef, {
          status,
          lastSeenAt: Date.now()
        });
      } catch (e) {
        // If update fails (e.g. doc not created yet), we ignore and let register handle it
      }
    };

    // 1. Initial Online Heartbeat
    updatePresence('online');

    // 2. Periodic Heartbeat
    const interval = setInterval(() => updatePresence('online'), 30000);

    // 3. Cleanup / Offline Status
    const handleUnload = () => {
      // Use navigator.sendBeacon or similar if possible for reliable offline update
      // For Firestore, we just attempt it
      updatePresence('offline');
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      updatePresence('offline');
    };
  }, [profile]);
}
