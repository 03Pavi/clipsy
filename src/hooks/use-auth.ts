import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase-client';
import { useAuthStore } from '../stores/auth-store';
import { User } from '../types/auth.types';

export function useAuth() {
  const { user, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userData: User = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || 'Anonymous Guest',
          photoURL: firebaseUser.photoURL || '',
          isAnonymous: firebaseUser.isAnonymous,
        };
        
        setUser(userData);
        
        // Sync user to firestore
        try {
          await setDoc(doc(db, 'users', userData.uid), userData, { merge: true });
        } catch (error) {
          console.error('Error syncing user to firestore:', error);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setUser, setLoading]);

  return { user, isLoading };
}
