import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { DOMAINS, COMPLIANCE_ITEMS } from '../data/complianceData';
import * as dotenv from 'dotenv';

dotenv.config();

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountJson) {
  console.error('FIREBASE_SERVICE_ACCOUNT environment variable is not set.');
  console.log('Please ensure you have a .env file with FIREBASE_SERVICE_ACCOUNT=... (stringified JSON)');
  process.exit(1);
}

try {
  const serviceAccount = JSON.parse(serviceAccountJson);
  initializeApp({ credential: cert(serviceAccount) });
} catch (err) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT JSON or initialize Firebase Admin:', err);
  process.exit(1);
}

const db = getFirestore();

async function seed() {
  console.log('🚀 Starting Seeding Process...');

  // 1. Seed Domains
  console.log(`📂 Seeding ${DOMAINS.length} domains to 'compliance_domains'...`);
  const domainBatch = db.batch();
  for (const domain of DOMAINS) {
    const docRef = db.collection('compliance_domains').doc(domain.id);
    domainBatch.set(docRef, {
      ...domain,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
  await domainBatch.commit();
  console.log('✅ Domains seeded successfully.');

  // 2. Seed Compliance Library
  console.log(`📄 Seeding ${COMPLIANCE_ITEMS.length} compliance items to 'compliance_library'...`);
  
  // Use chunks for library items if there are many (batch limit is 500)
  const ITEM_LIMIT = 400;
  for (let i = 0; i < COMPLIANCE_ITEMS.length; i += ITEM_LIMIT) {
    const chunk = COMPLIANCE_ITEMS.slice(i, i + ITEM_LIMIT);
    const itemBatch = db.batch();
    for (const item of chunk) {
      const docRef = db.collection('compliance_library').doc(item.id);
      itemBatch.set(docRef, {
        ...item,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    await itemBatch.commit();
    console.log(`   Processed ${i + chunk.length}/${COMPLIANCE_ITEMS.length} items...`);
  }

  console.log('🎉 Seeding Complete!');
}

seed().catch(err => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
