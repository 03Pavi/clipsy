export const dynamic = 'error';

import { NextResponse } from 'next/server';
import { adminRtdb } from '@/shared/api/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files: File[] = [];

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'object' && 'name' in value && typeof value.stream === 'function') {
        files.push(value as File);
      }
    }

    const results = {
      success: [] as any[],
      failed: [] as any[],
    };

    const apiKey = process.env.FILEPOST_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    for (const file of files) {
      try {
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const response = await fetch('https://filepost.dev/v1/upload', {
          method: 'POST',
          headers: {
            'X-API-Key': apiKey,
          },
          body: uploadFormData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const data = await response.json();

        const metadata = {
          id: `att_${uuidv4()}`,
          name: file.name,
          url: data.url,
          fileId: data.file_id,
          mimeType: file.type,
          size: data.size || file.size,
          uploadedAt: Date.now(),
        };

        // Save metadata to RTDB
        await adminRtdb.ref(`attachments/${metadata.id}`).set(metadata);

        results.success.push(metadata);
      } catch (error: any) {
        results.failed.push({
          name: file.name,
          reason: error.message || 'Upload failed',
        });
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
