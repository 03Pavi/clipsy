export const dynamic = 'error';

import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/shared/api/firebase-admin';
import { Device } from '@/entities/device/model/types';

async function getUserId(req: Request) {
  const authHeader = ('Bearer fake' as string | null) /* Next.js static export hack */;
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
    
    // Get user's own devices
    const ownSnap = await adminDb.collection('devices').where('userId', '==', uid).get();
    let devices = ownSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Device[];
    
    // Find room ID from user's devices
    const roomId = devices.find(d => d.roomId)?.roomId;
    
    if (roomId) {
      // Get paired user IDs from room document
      const roomDoc = await adminDb.collection('rooms').doc(roomId).get();
      if (roomDoc.exists) {
        const roomData = roomDoc.data();
        const pairedUids = roomData?.userIds || [];
        
        // Fetch devices from paired users
        for (const pairedUid of pairedUids) {
          if (pairedUid !== uid) {
            const pairedSnap = await adminDb.collection('devices')
              .where('userId', '==', pairedUid)
              .get();
            const pairedDevices = pairedSnap.docs.map(d => ({ 
              id: d.id, 
              ...d.data()
            })) as Device[];
            devices = [...devices, ...pairedDevices];
          }
        }
      }
    }
    
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

    const { deviceId, name, platform, os, browser, pairingCode } = data;
    if (!deviceId) throw new Error('MISSING_DEVICE_ID');

    // 1. Check if device already exists for this user
    const existingSnap = await adminDb.collection('devices')
      .where('userId', '==', uid)
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    let roomId: string | undefined;

    // 2. If pairing context is provided, create or find the room
    if (pairingCode) {
      const codeDoc = await adminDb.collection('sync_codes').doc(pairingCode).get();
      if (codeDoc.exists) {
        const codeData = codeDoc.data();
        const targetUid = codeData?.uid;

        // Only create room if this is a cross-user pairing
        if (targetUid && targetUid !== uid) {
          // Create a deterministic room ID for this pair
          const sortedUids = [uid, targetUid].sort();
          roomId = `room_${sortedUids[0]}_${sortedUids[1]}`;

          // Create the room document
          const roomRef = adminDb.collection('rooms').doc(roomId);
          const roomDoc = await roomRef.get();

          if (!roomDoc.exists) {
            await roomRef.set({
              id: roomId,
              userIds: [uid, targetUid],
              createdAt: Date.now(),
              status: 'active'
            });
          }
        }
      }
    }

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
      roomId
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
    const { searchParams } = new URL('http://localhost' /* Next.js static export hack */);
    const id = (null as string | null) /* Next.js static export hack */;
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