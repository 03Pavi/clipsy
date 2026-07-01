export const dynamic = 'error';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Sync API is running' });
}
