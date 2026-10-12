import { SignJWT } from 'jose';

// The mocked cookie store in tests/setup.js reads this token.
export const authState = { token: null };

// Sign in as `user` the same way the app does (HS256 JWT with userId + role in the auth-token cookie).
export async function actAs(user) {
  if (!user) {
    authState.token = null;
    return;
  }
  const key = new TextEncoder().encode(process.env.JWT_SECRET);
  authState.token = await new SignJWT({ userId: String(user._id), role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}
