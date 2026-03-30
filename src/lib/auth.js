import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import connectDB from './db';
import User from '@/models/User';
import CredentialsProvider from 'next-auth/providers/credentials';

const getSecretKey = () => {
  return new TextEncoder().encode(process.env.JWT_SECRET);
};

export async function signToken(user) {
  const payload = {
    userId: user._id.toString(),
    role: user.role
  };
  
  const secretKey = getSecretKey();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secretKey);
}

export async function verifyToken(token) {
  try {
    const secretKey = getSecretKey();
    const { payload } = await jwtVerify(token, secretKey);
    return payload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getServerSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return null;
  }

  return payload;
}

export async function getCurrentUser() {
  try {
    const session = await getServerSession();
    if (!session) {
      return null;
    }
    
    await connectDB();
    
    // Use userId from the JWT payload
    const userId = session.userId;
    if (!userId) {
      return null;
    }
    
    const user = await User.findById(userId).select('-password');
    return user;
  } catch (error) {
    return null;
  }
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function isNGO(user) {
  return user?.role === 'ngo';
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await User.findOne({ username: credentials.username });
        if (user && (await user.comparePassword(credentials.password))) {
          return { id: user._id.toString(), name: user.name, role: user.role };
        }
        return null;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};