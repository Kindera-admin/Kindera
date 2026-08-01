import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

async function clearData() {
  if (!MONGODB_URI) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected.');

    const db = mongoose.connection.db;

    console.log('Clearing Announcements...');
    await db.collection('announcements').deleteMany({});
    
    console.log('Clearing Attendances...');
    await db.collection('attendances').deleteMany({});
    
    console.log('Clearing Events...');
    await db.collection('events').deleteMany({});
    
    console.log('Clearing Messages...');
    await db.collection('messages').deleteMany({});
    
    console.log('Clearing Reports...');
    await db.collection('reports').deleteMany({});

    console.log('Clearing Users (excluding admin role)...');
    const userResult = await db.collection('users').deleteMany({
      role: { $ne: 'admin' }
    });
    console.log(`Deleted ${userResult.deletedCount} users.`);

    // NGOPartners collection and ImpactPhotos collection are NOT deleted.

    console.log('Data cleared successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing data:', error);
    process.exit(1);
  }
}

clearData();
