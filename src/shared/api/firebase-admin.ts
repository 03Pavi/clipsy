import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    try {
      initializeApp({
        credential: cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });
    } catch {
      initializeApp();
    }
  } else {
    initializeApp();
  }
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
export { FieldValue };

if (getApps().length) {
  try {
    adminDb.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    // Already initialized settings, safe to ignore
  }
}