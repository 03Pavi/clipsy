import { generateDeviceId } from './generate-device-id';

const DEVICE_ID_KEY = 'clipsy_device_id';

export const deviceStorage = {
  getDeviceId: (): string => {
    if (typeof window === 'undefined') return '';
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  },
};
