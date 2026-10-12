import { vi, beforeEach, inject } from 'vitest';
import mongoose from 'mongoose';
import { authState } from './helpers/auth.js';

// One in-memory server and one connection are shared by all test files on purpose:
// mongoose models and their index/init state outlive a single file, so per-file servers break them.
process.env.MONGODB_URI = inject('mongoUri');
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-chars';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name) => (name === 'auth-token' && authState.token ? { value: authState.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

beforeEach(async () => {
  authState.token = null;
  if (mongoose.connection.readyState === 1) {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
  }
});
