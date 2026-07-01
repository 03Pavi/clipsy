export const dynamic = 'error';

import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/shared/api/firebase-admin';
import { ClipboardItem } from '@/entities/clipboard/model/types';

async function getUserId(req: Request) {
  const authHeader = ('Bearer fake' as string | null) /* Next.js static export hack */;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('UNAUTHORIZED');
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return { uid: decodedToken.uid, isAnonymous: decodedToken.firebase?.sign_in_provider === 'anonymous' };
  } catch (error: any) {
    console.error('🔐 Auth Verification Failed:', error.message);
    throw new Error('UNAUTHORIZED');
  }
}

export async function GET(req: Request) {
  try {
    const { uid, isAnonymous } = await getUserId(req);

    // Get user's devices to find their room ID
    const devicesSnap = await adminDb.collection('devices').where('userId', '==', uid).get();
    const devices = devicesSnap.docs.map(d => d.data());
    const roomId = devices.find(d => d.roomId)?.roomId;

    let allItems: ClipboardItem[] = [];

    if (roomId) {
      // Fetch all clipboard items for this room
      const snap = await adminDb.collection('clipboard')
        .where('roomId', '==', roomId)
        .orderBy('timestamp', 'desc')
        .get();
      allItems = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClipboardItem[];
    } else {
      // No room - fetch only own items
      const snap = await adminDb.collection('clipboard')
        .where('userId', '==', uid)
        .orderBy('timestamp', 'desc')
        .get();
      allItems = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClipboardItem[];
    }

    console.log(`✅ [GET /api/clipboard] Success: ${allItems.length} items found (isAnon: ${isAnonymous})`);
    return NextResponse.json({ items: allItems });
  } catch (e: any) {
    console.error('❌ [GET /api/clipboard] Error:', e.message);
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

/* POST – add a new item */
export async function POST(req: Request) {
  try {
    const { uid, isAnonymous } = await getUserId(req);
    const data = await req.json();
    
    // SECURITY: Anonymous users can ONLY sync transient data (Public Mesh)
    if (isAnonymous && !data.isTransient) {
      return NextResponse.json({ error: 'PERMANENT_STORAGE_NOT_ALLOWED' }, { status: 403 });
    }
    console.log('📡 [POST /api/clipboard] Adding item for UID:', uid);

    // Determine room ID from user's devices
    const devicesSnap = await adminDb.collection('devices').where('userId', '==', uid).get();
    const devices = devicesSnap.docs.map(d => d.data());
    const roomId = devices.find(d => d.roomId)?.roomId;

    const newItem: Omit<ClipboardItem, 'id'> = {
      userId: uid,
      sourceDeviceId: data.sourceDeviceId || 'unknown',
      syncLinkId: roomId || 'global',
      type: data.type || 'text',
      content: data.content || '',
      title: data.title,
      fileUrl: data.fileUrl || data.imageUrl, // Fallback for legacy clients
      fileName: data.fileName,
      fileSize: data.fileSize,
      metadata: data.metadata,
      isPinned: false,
      isTransient: !!data.isTransient,
      timestamp: data.timestamp ?? Date.now(),
      roomId
    };
    
    console.log(`💾 [POST /api/clipboard] Saving to Firestore... (Content Length: ${data.content?.length || 0}, Source: ${newItem.sourceDeviceId})`);
    
    const ref = await adminDb.collection('clipboard').add(newItem);
    console.log('✅ [POST /api/clipboard] Save complete. ID:', ref.id);

    // 6. ROLLING HISTORY PRUNING
    try {
      // Fetch all for this user or room
      let snap;
      if (roomId) {
        snap = await adminDb.collection('clipboard')
          .where('roomId', '==', roomId)
          .get();
      } else {
        snap = await adminDb.collection('clipboard')
          .where('userId', '==', uid)
          .get();
      }

      const limit = isAnonymous ? 3 : 10;
      
      if (snap.size > limit) {
        console.log(`🧹 [POST /api/clipboard] Pruning ${snap.size - limit} old clips (Limit: ${limit})...`);
        
        const allItems = snap.docs.map(doc => ({ 
          ref: doc.ref, 
          data: doc.data() 
        }));

        // Sort: Pinned first (for normal users), then Timestamp desc
        allItems.sort((a, b) => {
          if (a.data.isPinned !== b.data.isPinned) return a.data.isPinned ? -1 : 1;
          return (b.data.timestamp || 0) - (a.data.timestamp || 0);
        });

        // Delete items beyond the limit
        const toDelete = allItems.slice(limit);
        for (const item of toDelete) {
          await item.ref.delete();
        }
      }
    } catch (pruneError) {
      console.error('⚠️ [POST /api/clipboard] Pruning failed:', pruneError);
    }

    return NextResponse.json({ item: { id: ref.id, ...newItem } }, { status: 201 });
  } catch (e: any) {
    console.error('❌ [POST /api/clipboard] Error:', e.message);
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}

/* PATCH – update an item (pin/unpin) */
export async function PATCH(req: Request) {
  try {
    const { uid, isAnonymous } = await getUserId(req);
    if (isAnonymous) return NextResponse.json({ error: 'ANONYMOUS_STORAGE_NOT_ALLOWED' }, { status: 403 });
    const data = await req.json();
    const { id, isPinned } = data;
    if (!id) throw new Error('MISSING_ID');

    const snap = await adminDb.collection('clipboard').doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    
    const itemData = snap.data();
    if (itemData?.userId !== uid) throw new Error('FORBIDDEN');

    await adminDb.collection('clipboard').doc(id).update({ isPinned });
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

/* DELETE – remove an item */
export async function DELETE(req: Request) {
  try {
    const { uid, isAnonymous } = await getUserId(req);
    if (isAnonymous) return NextResponse.json({ error: 'ANONYMOUS_STORAGE_NOT_ALLOWED' }, { status: 403 });
    const { searchParams } = new URL('http://localhost' /* Next.js static export hack */);
    const id = (null as string | null) /* Next.js static export hack */;
    if (!id) throw new Error('MISSING_ID');

    const snap = await adminDb.collection('clipboard').doc(id).get();
    if (!snap.exists) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
    
    const itemData = snap.data();
    if (itemData?.userId !== uid) throw new Error('FORBIDDEN');

    await adminDb.collection('clipboard').doc(id).delete();
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