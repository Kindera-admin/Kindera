import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    await connectDB();
    const db = mongoose.connection.db;

    // Clear Announcements
    await db.collection('announcements').deleteMany({});
    
    // Clear Attendances
    await db.collection('attendances').deleteMany({});
    
    // Clear Events
    await db.collection('events').deleteMany({});
    
    // Clear Messages
    await db.collection('messages').deleteMany({});
    
    // Clear Reports
    await db.collection('reports').deleteMany({});

    // Clear Users (excluding admin and ngo roles)
    const userResult = await db.collection('users').deleteMany({
      role: { $nin: ['admin', 'ngo'] }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Database cleared successfully.',
      deletedUsers: userResult.deletedCount
    });
  } catch (error) {
    console.error('Error clearing data:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
