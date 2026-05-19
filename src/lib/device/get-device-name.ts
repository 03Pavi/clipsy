export function getDeviceName(): string {
  if (typeof window === 'undefined') return 'Unknown Device';
  const userAgent = window.navigator.userAgent;
  let deviceName = 'Unknown Device';

  if (/windows phone/i.test(userAgent)) {
    deviceName = 'Windows Phone';
  } else if (/win/i.test(userAgent)) {
    deviceName = 'Windows PC';
  } else if (/mac/i.test(userAgent)) {
    deviceName = 'Mac';
  } else if (/linux/i.test(userAgent)) {
    deviceName = 'Linux PC';
  } else if (/ipad|iphone|ipod/i.test(userAgent)) {
    deviceName = 'iOS Device';
  } else if (/android/i.test(userAgent)) {
    deviceName = 'Android Device';
  }

  return `${deviceName} - ${new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
