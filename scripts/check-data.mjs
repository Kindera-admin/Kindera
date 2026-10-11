// Print how many users are in the database.
// Run with: node scripts/check-data.mjs

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env.local');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const count = await mongoose.connection.db.collection('users').countDocuments();
console.log(`There are ${count} users remaining in the database.`);
await mongoose.disconnect();
