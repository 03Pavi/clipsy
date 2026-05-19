import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase-client';
import { generateDeviceId } from '../../lib/device/generate-device-id';

export async function uploadClipboardFile(
  roomId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; path: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${generateDeviceId()}.${fileExt}`;
  const filePath = `rooms/${roomId}/clipboard/${fileName}`;
  
  const storageRef = ref(storage, filePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve({ url: downloadURL, path: filePath });
      }
    );
  });
}
