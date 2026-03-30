import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const getSecretKey = () => new TextEncoder().encode(process.env.JWT_SECRET);

async function getTokenRole(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role || null;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const isPublicPath = path === '/login' || path === '/pending';

  const token = request.cookies.get('auth-token')?.value;
  const isAuthenticated = !!token;

  if (isPublicPath && isAuthenticated) {
    const role = await getTokenRole(token);
    const dest = role === 'admin' ? '/admin' : '/dashboard';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (!isAuthenticated && !isPublicPath) {
    const url = new URL('/login', request.url);
    url.searchParams.set('from', path);
    return NextResponse.redirect(url);
  }

  // Protect /admin/* — only admin role allowed
  if (path.startsWith('/admin') && isAuthenticated) {
    const role = await getTokenRole(token);
    if (!role) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/login',
    '/pending',
    '/dashboard',
    '/dashboard/:path*',
    '/reports/:path*',
    '/admin',
    '/admin/:path*',
  ]
};
