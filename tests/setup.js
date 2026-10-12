import { vi, beforeEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { authState } from './helpers/auth.js';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('kindera_test');
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

afterAll(async () => {
  await mongoose.disconnect();
  // src/lib/db.js caches its connection on globalThis; drop it so the next test file reconnects to its own mongod.
  delete globalThis.mongoose;
  await mongod.stop();
});
