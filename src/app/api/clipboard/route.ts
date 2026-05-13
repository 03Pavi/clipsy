import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/shared/api/firebase-admin';
import { ClipboardItem } from '@/entities/clipboard/model/types';

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
    console.error('🔐 Auth Verification Failed:', error.message);
    throw new Error('UNAUTHORIZED');
  }
}

/* GET – fetch user clipboard items */
export async function GET(req: Request) {
  try {
    const uid = await getUserId(req);
    console.log('📡 [GET /api/clipboard] Fetching for UID:', uid);
    
    const snap = await adminDb
      .collection('clipboard')
      .where('userId', '==', uid)
      .get();
      
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClipboardItem[];
    console.log(`✅ [GET /api/clipboard] Success: ${items.length} items found`);
    return NextResponse.json({ items });
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
    const uid = await getUserId(req);
    const data = await req.json();
    console.log('📡 [POST /api/clipboard] Adding item for UID:', uid);

    const newItem: Omit<ClipboardItem, 'id'> = {
      userId: uid,
      sourceDeviceId: data.sourceDeviceId || 'unknown',
      syncLinkId: data.syncLinkId || 'global',
      type: data.type || 'text',
      content: data.content || '',
      title: data.title,
      fileUrl: data.fileUrl || data.imageUrl, // Fallback for legacy clients
      fileName: data.fileName,
      fileSize: data.fileSize,
      metadata: data.metadata,
      isPinned: false,
      timestamp: data.timestamp ?? Date.now(),
    };
    
    console.log(`💾 [POST /api/clipboard] Saving to Firestore... (Content Length: ${data.content?.length || 0}, Source: ${newItem.sourceDeviceId})`);
    
    const ref = await adminDb.collection('clipboard').add(newItem);
    console.log('✅ [POST /api/clipboard] Save complete. ID:', ref.id);

    // 6. ROLLING HISTORY PRUNING (Maintain Top 10)
    try {
      // We fetch all and sort in-memory to avoid "Index Required" errors
      const snap = await adminDb.collection('clipboard')
        .where('userId', '==', uid)
        .get();

      if (snap.size > 10) {
        console.log(`🧹 [POST /api/clipboard] Pruning ${snap.size - 10} old clips...`);
        
        // Sort: Pinned first, then Timestamp desc
        const allItems = snap.docs.map(doc => ({ 
          ref: doc.ref, 
          data: doc.data() 
        }));

        allItems.sort((a, b) => {
          if (a.data.isPinned !== b.data.isPinned) return a.data.isPinned ? -1 : 1;
          return (b.data.timestamp || 0) - (a.data.timestamp || 0);
        });

        const batch = adminDb.batch();
        // Keep top 10, delete the rest
        allItems.slice(10).forEach(item => {
          batch.delete(item.ref);
        });
        await batch.commit();
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
    const uid = await getUserId(req);
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
    const uid = await getUserId(req);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
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