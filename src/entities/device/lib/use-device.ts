import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface DeviceProfile {
  deviceId: string;
  platform: 'mobile' | 'desktop' | 'tablet' | 'web';
  os: string;
  browser: string;
  name: string;
}

export function useDevice() {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);

  useEffect(() => {
    // 1. Get or Generate Persistent Device ID
    let deviceId = localStorage.getItem('clipsy_device_id');
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem('clipsy_device_id', deviceId);
    }

    // 2. Detect Platform Info
    const ua = navigator.userAgent;
    let platform: DeviceProfile['platform'] = 'web';
    if (/tablet|ipad|playbook|silk/i.test(ua)) platform = 'tablet';
    else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) platform = 'mobile';
    else platform = 'desktop';

    // 3. Detect OS & Browser
    const os = ua.match(/\(([^)]+)\)/)?.[1] || 'Unknown OS';
    const browser = ua.match(/(firefox|msie|chrome|safari|trident)/i)?.[0] || 'Unknown Browser';
    
    // 4. Generate Default Name
    const name = localStorage.getItem('clipsy_device_name') || `${browser.charAt(0).toUpperCase() + browser.slice(1)} on ${os.split(';')[0]}`;

    setProfile({
      deviceId,
      platform,
      os,
      browser,
      name
    });
  }, []);

  const updateDeviceName = (newName: string) => {
    localStorage.setItem('clipsy_device_name', newName);
    if (profile) setProfile({ ...profile, name: newName });
  };

  return { profile, updateDeviceName };
}
