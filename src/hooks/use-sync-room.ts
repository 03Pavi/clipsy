import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, doc, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase-client';
import { joinRoomBySyncCode } from '../services/room/join-room';
import { createRoom } from '../services/room/create-room';
import { useAuthStore } from '../stores/auth-store';

export function useSyncRoom() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{ roomId: string; syncCode: string } | null>(null);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'pending' | 'rejected'>('idle');
  const router = useRouter();
  const { user } = useAuthStore();

  const handleJoinRoom = async (syncCode: string) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await joinRoomBySyncCode(user.uid, syncCode);
      router.push(`/room?id=${room.id}`);
    } catch (err: any) {
      if (err.message === 'PRIVATE_ROOM_REQUEST_PENDING') {
        const roomsRef = collection(db, 'rooms');
        const q = query(roomsRef, where('syncCode', '==', syncCode.toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const roomId = querySnapshot.docs[0].id;
          setPendingRequest({ roomId, syncCode });
          setRequestStatus('pending');
        }
      } else if (err.message === 'PRIVATE_ROOM_REQUEST_REJECTED') {
        setRequestStatus('rejected');
        setError('Your request to join this private room was declined by the owner.');
      } else {
        setError(err.message || 'Failed to join room');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (name: string, isPrivate = false) => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const room = await createRoom(user.uid, name, isPrivate);
      router.push(`/room?id=${room.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user || requestStatus !== 'pending' || !pendingRequest) return;

    const requestRef = doc(db, 'rooms', pendingRequest.roomId, 'requests', user.uid);
    const unsubscribe = onSnapshot(requestRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'approved') {
          setRequestStatus('idle');
          setPendingRequest(null);
          handleJoinRoom(pendingRequest.syncCode);
        } else if (data.status === 'rejected') {
          setRequestStatus('rejected');
          setError('Your request to join this private room was declined by the owner.');
          setPendingRequest(null);
        }
      }
    });

    return () => unsubscribe();
  }, [user, requestStatus, pendingRequest]);

  return { 
    handleJoinRoom, 
    handleCreateRoom, 
    isLoading, 
    error, 
    requestStatus, 
    setRequestStatus, 
    pendingRequest 
  };
}
