import { useEffect } from 'react';
import { useDeviceStore } from '../stores/device-store';
import { subscribeDeviceStatus } from '../services/presence/subscribe-device-status';
import { setDeviceOnline, setDeviceOffline } from '../services/presence/set-device-online';
import { deviceStorage } from '../lib/device/device-storage';
import { getDeviceName } from '../lib/device/get-device-name';

export function useDevicePresence(userId: string | undefined, roomId: string | undefined) {
  const { setDevices } = useDeviceStore();

  useEffect(() => {
    if (!userId || !roomId) return;
    const deviceId = deviceStorage.getDeviceId();
    const deviceName = getDeviceName();

    // Mark online
    setDeviceOnline(userId, deviceId, deviceName).catch(console.error);

    // Subscribe to all devices in the room
    const unsubscribe = subscribeDeviceStatus(roomId, (devices) => {
      setDevices(devices);
    });

    return () => {
      setDeviceOffline(userId, deviceId).catch(console.error);
      unsubscribe();
    };
  }, [userId, roomId, setDevices]);
}
