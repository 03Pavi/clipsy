/**
 * Clipsy Database Manager Script
 * Run with: npx tsx scripts/db-manager.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!privateKey || !clientEmail || !projectId) {
  console.error('❌ Error: Missing Firebase Admin credentials in .env.local');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId,
    privateKey,
    clientEmail,
  }),
});

const db = getFirestore(app);

async function listCollections() {
  console.log('\n--- Live Data Overview ---');

  const collections = ['users', 'clipboard', 'devices', 'sync_codes'];

  for (const col of collections) {
    const snap = await db.collection(col).get();
    console.log(`📦 Collection [${col}]: ${snap.size} documents`);

    if (snap.size > 0) {
      snap.docs.slice(0, 3).forEach(doc => {
        console.log(`   - ID: ${doc.id}`);
        console.log(`     Data:`, JSON.stringify(doc.data()).substring(0, 100) + '...');
      });
      if (snap.size > 3) console.log(`   ... and ${snap.size - 3} more`);
    }
    console.log('');
  }
}

async function seedData(uid: string) {
  console.log(`🌱 Seeding data for User: ${uid}...`);

  const clips = [
    { type: 'code', content: 'const greeting = "Hello World";\nconsole.log(greeting);', title: 'JS Greeting' },
    { type: 'link', content: 'https://nextjs.org/docs', title: 'Next.js Documentation' },
    { type: 'text', content: 'Remember to buy groceries: Milk, Eggs, Bread.', title: 'Grocery List' },
    { type: 'palette', content: '--theme-primary, #050914, #ffffff', title: 'Brand Colors' },
    { type: 'code', content: 'def hello():\n    print("Hello from Python")', title: 'Python Hello' }
  ];

  const devices = [
    { name: 'MacBook Pro 16"', platform: 'desktop', status: 'online', syncEnabled: true },
    { name: 'iPhone 15 Pro', platform: 'mobile', status: 'online', syncEnabled: true },
    { name: 'iPad Air', platform: 'tablet', status: 'offline', syncEnabled: false }
  ];

  // Seed Clips
  for (const clip of clips) {
    await db.collection('clipboard').add({
      ...clip,
      userId: uid,
      timestamp: Date.now() - Math.floor(Math.random() * 10000000)
    });
  }

  // Seed Devices
  for (const device of devices) {
    await db.collection('devices').add({
      ...device,
      userId: uid,
      lastSeen: Date.now()
    });
  }

  // Initialize User
  await db.collection('users').doc(uid).set({
    uid,
    syncEnabled: true,
    theme: 'dark',
    updatedAt: Date.now()
  }, { merge: true });

  console.log('✅ Seeding complete!');
}

async function run() {
  const args = process.argv.slice(2);
  const isSeed = args.includes('--seed');
  const targetUid = args.find(a => !a.startsWith('--'));

  try {
    console.log('🚀 Connecting to Firestore...');

    if (isSeed) {
      if (!targetUid) {
        console.error('❌ Error: Please provide a User ID to seed data for.');
        console.log('Usage: npx tsx scripts/db-manager.ts --seed <USER_ID>');
        process.exit(1);
      }
      await seedData(targetUid);
    } else {
      await listCollections();
      console.log('💡 Tip: Use --seed <USER_ID> to populate the DB with sample data.');
    }

    console.log('✅ Operation completed.');
  } catch (error) {
    console.error('💥 Script Error:', error);
  } finally {
    process.exit(0);
  }
}

run();
