import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/shared/api/firebase-admin';
import { Device } from '@/entities/device/model/types';

async function getUserId(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch {
    throw new Error('UNAUTHORIZED');
  }
}

/* GET – list user's devices */
export async function GET(req: Request) {
  try {
    const uid = await getUserId(req);
    const snap = await adminDb.collection('devices').where('userId', '==', uid).get();
    const devices = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Device[];
    return NextResponse.json({ devices });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

/* POST – register/update a device instance */
export async function POST(req: Request) {
  try {
    const uid = await getUserId(req);
    const data = await req.json();

    const { deviceId, name, platform, os, browser } = data;
    if (!deviceId) throw new Error('MISSING_DEVICE_ID');

    // 1. Check if device already exists for this user
    const snap = await adminDb.collection('devices')
      .where('userId', '==', uid)
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    const deviceData: Omit<Device, 'id'> = {
      deviceId,
      userId: uid,
      name: name || 'Unnamed Device',
      platform: platform || 'web',
      os: os || 'Unknown OS',
      browser: browser || 'Unknown Browser',
      status: 'online',
      syncEnabled: true,
      lastSeenAt: Date.now(),
      activeSyncLinkIds: [],
    };

    // Use stable ID: {uid}_{deviceId}
    const docId = `${uid}_${deviceId}`;
    await adminDb.collection('devices').doc(docId).set(deviceData, { merge: true });
    
    return NextResponse.json({ device: { id: docId, ...deviceData } });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

/* PATCH – toggle sync state */
export async function PATCH(req: Request) {
  try {
    const uid = await getUserId(req);
    const data = await req.json();
    const { id, syncEnabled } = data;
    if (!id) throw new Error('MISSING_ID');

    const snap = await adminDb.collection('devices').where('userId', '==', uid).get();
    const owns = snap.docs.some(d => d.id === id);
    if (!owns) throw new Error('FORBIDDEN');

    await adminDb.collection('devices').doc(id).update({ syncEnabled });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const status =
      e.message === 'UNAUTHORIZED'
        ? 401
        : e.message === 'MISSING_ID'
        ? 400
        : e.message === 'FORBIDDEN'
        ? 403
        : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

/* DELETE – remove a device */
export async function DELETE(req: Request) {
  try {
    const uid = await getUserId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) throw new Error('MISSING_ID');

    const snap = await adminDb.collection('devices').where('userId', '==', uid).get();
    const owns = snap.docs.some(d => d.id === id);
    if (!owns) throw new Error('FORBIDDEN');

    await adminDb.collection('devices').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const status =
      e.message === 'UNAUTHORIZED'
        ? 401
        : e.message === 'MISSING_ID'
        ? 400
        : e.message === 'FORBIDDEN'
        ? 403
        : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}