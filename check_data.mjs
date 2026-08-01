import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

async function checkData() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  const count = await db.collection('users').countDocuments();
  console.log(`There are ${count} users remaining in the database.`);
  const users = await db.collection('users').find({}).toArray();
  console.log(users.map(u => u.username));
  process.exit(0);
}

checkData();
