import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import { signToken } from '@/lib/auth';

export async function POST(request) {
  try {
    await connectDB();

    const { name, username, password, confirmPassword, role } = await request.json();

    // ── Validation ──
    if (!name || !username || !password || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'All fields are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: 'Passwords do not match' },
        { status: 400 }
      );
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Username already taken' },
        { status: 409 }
      );
    }

    // ── Create user ──
    const user = await User.create({
      name: name.trim(),
      username: username.toLowerCase().trim(),
      password,
      role: role || 'volunteer', // default role
    });

    // ── Generate token & respond ──
    const token = await signToken({ id: user._id });

    const response = NextResponse.json({
      success: true,
      user: {
        _id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name,
      },
      token,
    });

    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in signup POST handler:', error);

    // Handle mongoose duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, message: 'Username already taken' },
        { status: 409 }
      );
    }

    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return NextResponse.json(
        { success: false, message: messages.join(', ') },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Server error', error: error.message },
      { status: 500 }
    );
  }
}