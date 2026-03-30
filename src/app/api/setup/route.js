import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const reset = searchParams.get('reset') === 'true';

  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Administrator';

  if (!username || !password) {
    return NextResponse.json(
      { success: false, message: 'ADMIN_USERNAME and ADMIN_PASSWORD must be set in .env' },
      { status: 500 }
    );
  }

  try {
    await connectDB();

    const adminExists = await User.findOne({ role: 'admin' });

    if (adminExists && !reset) {
      return NextResponse.json(
        { success: false, message: 'Admin already exists. Use ?reset=true to update credentials.' },
        { status: 409 }
      );
    }

    if (adminExists && reset) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await User.findByIdAndUpdate(adminExists._id, {
        username,
        password: hashedPassword,
        name,
        status: 'approved'
      });
      return NextResponse.json({
        success: true,
        message: `Admin credentials updated. Username is now '${username}'.`
      });
    }

    await User.create({ username, password, role: 'admin', name, status: 'approved' });

    return NextResponse.json({
      success: true,
      message: `Admin account '${username}' created. You can now log in.`
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
