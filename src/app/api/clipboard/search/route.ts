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
    console.error('🔐 Search Auth Verification Failed:', error.message);
    throw new Error('UNAUTHORIZED');
  }
}

export async function GET(req: Request) {
  try {
    const uid = await getUserId(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase() || '';

    console.log(`📡 [SEARCH /api/clipboard/search] Query: "${query}" for UID:`, uid);

    // Fetch all user items (pruned to top 10-20 by POST logic)
    const snap = await adminDb
      .collection('clipboard')
      .where('userId', '==', uid)
      .orderBy('timestamp', 'desc')
      .get();
      
    let items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClipboardItem[];

    // Filter by query if provided
    if (query) {
      items = items.filter(item => 
        item.content.toLowerCase().includes(query) ||
        (item.title && item.title.toLowerCase().includes(query)) ||
        item.type.toLowerCase().includes(query)
      );
    }

    // Sort by timestamp desc
    items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    console.log(`✅ [SEARCH /api/clipboard/search] Success: ${items.length} matches found`);
    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('❌ [SEARCH /api/clipboard/search] Error:', e.message);
    return NextResponse.json(
      { error: e.message },
      { status: e.message === 'UNAUTHORIZED' ? 401 : 500 }
    );
  }
}
