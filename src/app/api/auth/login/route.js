import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    await connectDB();
    
    const { username, password } = await request.json();
    
    const user = await User.findOne({ username });
    
    if (user && (await user.comparePassword(password))) {
      const token = await signToken({ id: user._id });
      
      const response = NextResponse.json({
        success: true,
        user: {
          _id: user._id.toString(),
          username: user.username,
          role: user.role,
          ngoId: user.ngoId,
          name: user.name
        },
        token
      });
      
      // Set the auth cookie
      response.cookies.set({
        name: 'auth-token',
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/'
      });
      
      return response;
    } else {
      console.log('Invalid username or password in login'); // Debugging log
      return NextResponse.json(
        { success: false, message: 'Invalid username or password' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error in login POST handler:', error); // Debugging log
    return NextResponse.json(
      { success: false, message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}