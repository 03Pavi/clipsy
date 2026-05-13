import { storage, db } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export interface UploadProgress {
  progress: number;
  status: 'uploading' | 'success' | 'error';
  url?: string;
  error?: any;
}

export const uploadFile = (
  file: File, 
  userId: string, 
  deviceId: string,
  onProgress?: (progress: UploadProgress) => void
) => {
  const fileId = `${Date.now()}-${file.name}`;
  const storageRef = ref(storage, `users/${userId}/clips/${fileId}`);
  const uploadTask = uploadBytesResumable(storageRef, file);

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.({ progress, status: 'uploading' });
    },
    (error) => {
      onProgress?.({ progress: 0, status: 'error', error });
    },
    async () => {
      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
      onProgress?.({ progress: 100, status: 'success', url: downloadURL });
    }
  );

  return uploadTask;
};
