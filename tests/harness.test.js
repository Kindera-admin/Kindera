import { describe, it, expect } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { actAs } from './helpers/auth.js';
import { makeUser } from './helpers/factories.js';

describe('test harness', () => {
  it('signs a test user in through the auth cookie', async () => {
    const volunteer = await makeUser('volunteer');
    await actAs(volunteer);
    const me = await getCurrentUser();
    expect(String(me._id)).toBe(String(volunteer._id));
  });

  it('treats a request without a cookie as logged out', async () => {
    await actAs(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it('starts every test with an empty database', async () => {
    const User = (await import('@/models/User')).default;
    expect(await User.countDocuments()).toBe(0);
  });
});
