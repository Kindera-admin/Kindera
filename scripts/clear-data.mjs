// DESTRUCTIVE: wipe announcements, attendances, events, messages, reports,
// and every user except admin and ngo accounts. NGO partners and impact
// photos are kept. Whatever database MONGODB_URI points at is wiped.
// Run with: node scripts/clear-data.mjs

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

try {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;

  for (const name of ['announcements', 'attendances', 'events', 'messages', 'reports']) {
    console.log(`Clearing ${name}...`);
    await db.collection(name).deleteMany({});
  }

  console.log('Clearing users (excluding admin and ngo roles)...');
  const userResult = await db.collection('users').deleteMany({
    role: { $nin: ['admin', 'ngo'] }
  });
  console.log(`Deleted ${userResult.deletedCount} users.`);

  console.log('✅ Data cleared.');
  await mongoose.disconnect();
} catch (error) {
  console.error('Error clearing data:', error);
  process.exit(1);
}
