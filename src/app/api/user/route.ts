import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/shared/api/firebase-admin';

export const dynamic = 'force-dynamic';

async function getUserId(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error: any) {
    console.error('🔐 Auth Verification Failed (User API):', error.message);
    throw new Error('UNAUTHORIZED');
  }
}

/* GET – fetch user profile data */
export async function GET(req: Request) {
  try {
    const uid = await getUserId(req);
    console.log('📡 [GET /api/user] Fetching profile for UID:', uid);
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      console.log('ℹ️ [GET /api/user] No profile found, returning defaults');
      return NextResponse.json({ 
        user: { 
          uid, 
          syncEnabled: true, 
          theme: 'dark' 
        } 
      });
    }

    console.log('✅ [GET /api/user] Profile found');
    return NextResponse.json({ user: { uid, ...userDoc.data() } });
  } catch (e: any) {
    console.error('❌ [GET /api/user] Error:', e.message);
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

/* POST – update or initialize user profile */
export async function POST(req: Request) {
  try {
    const uid = await getUserId(req);
    const data = await req.json();
    console.log('📡 [POST /api/user] Updating profile for UID:', uid);

    const userData = {
      ...data,
      updatedAt: Date.now(),
    };

    await adminDb.collection('users').doc(uid).set(userData, { merge: true });
    console.log('✅ [POST /api/user] Update successful');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('❌ [POST /api/user] Error:', e.message);
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}
