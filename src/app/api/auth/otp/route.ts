import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/shared/api/firebase-admin';

// Generate a 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* 
  POST /api/auth/otp 
  Body: { action: 'generate' | 'verify', code?: string }
*/
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, code } = body;
    console.log(`🔑 [OTP API] Action: ${action}`);

    if (action === 'generate') {
      // Must be authenticated to generate a code
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        console.error('❌ [OTP API] Missing or invalid Authorization Header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const uid = decodedToken.uid;
      console.log('📡 [OTP API] Fetching/Generating static code for UID:', uid);

      // 1. Check if a code already exists for this user
      const existingCodes = await adminDb.collection('sync_codes').where('uid', '==', uid).get();
      
      if (!existingCodes.empty) {
        const existingOtp = existingCodes.docs[0].id;
        console.log('✅ [OTP API] Existing Static Code Found:', existingOtp);
        return NextResponse.json({ code: existingOtp });
      }

      // 2. If not, generate a new static code
      const otp = generateOTP();
      await adminDb.collection('sync_codes').doc(otp).set({
        uid,
        createdAt: Date.now(),
        isStatic: true
      });

      console.log('✅ [OTP API] New Static Code Generated:', otp);
      return NextResponse.json({ code: otp });
    }

    if (action === 'verify') {
      console.log('📡 [OTP API] Verifying static code:', code);
      if (!code) return NextResponse.json({ error: 'Code required' }, { status: 400 });

      const doc = await adminDb.collection('sync_codes').doc(code).get();
      if (!doc.exists) {
        console.error('❌ [OTP API] Code not found in database');
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
      }

      const data = doc.data();
      console.log('🔐 [OTP API] Creating Custom Token for UID:', data?.uid);
      
      // Generate a custom token for the linked user
      const customToken = await adminAuth.createCustomToken(data?.uid);

      // Note: We DO NOT delete the code here anymore to keep it static/forever
      console.log('✅ [OTP API] Verification Successful (Code Preserved)');

      return NextResponse.json({ token: customToken });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('💥 [OTP API] Critical Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
