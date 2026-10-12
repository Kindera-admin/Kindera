import connectDB from '@/lib/db';
import User from '@/models/User';
import Event from '@/models/Event';
import Company from '@/models/Company';

let seq = 0;
export const next = () => ++seq;

export async function makeUser(role, overrides = {}) {
  await connectDB();
  const i = next();
  return User.create({
    username: `${role}-${i}`,
    password: 'password123',
    name: `${role} ${i}`,
    role,
    status: 'approved',
    ...(role === 'ngo' ? { ngoId: `NGO-${i}` } : {}),
    ...overrides,
  });
}

export async function makeEvent(creator, overrides = {}) {
  await connectDB();
  return Event.create({
    title: `Event ${next()}`,
    description: 'Test event',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: 'Bengaluru',
    createdBy: creator._id,
    createdByRole: creator.role,
    ...overrides,
  });
}

export async function makeCompany(name = `Company ${next()}`, overrides = {}) {
  await connectDB();
  return Company.create({ name, ...overrides });
}
