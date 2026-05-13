'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/shared/api/firebase';
import { useAppDispatch } from '@/shared/lib/redux';
import { setUser, logout, setLoading } from '@/entities/user';

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setLoading(true));
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUser({
          uid: user.uid,
          name: user.displayName || 'Anonymous',
          email: user.email || '',
          avatarUrl: user.photoURL || '',
          isAnonymous: user.isAnonymous,
        }));
      } else {
        dispatch(logout());
      }
    });

    return () => unsubscribe();
  }, [dispatch]);

  return <>{children}</>;
}
