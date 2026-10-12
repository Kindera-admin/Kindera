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

// Two companies, two SPOCs in A, one employee in each company, plus staff and outsiders.
export async function makeWorld() {
  const companyA = await makeCompany('Acme');
  const companyB = await makeCompany('Beta');
  const admin = await makeUser('admin');
  const employee = await makeUser('employee');
  const spocA = await makeUser('org_spoc', { companyId: companyA._id });
  const spocA2 = await makeUser('org_spoc', { companyId: companyA._id });
  const spocB = await makeUser('org_spoc', { companyId: companyB._id });
  const memberA = await makeUser('org_member', { companyId: companyA._id, spocId: spocA._id });
  const memberB = await makeUser('org_member', { companyId: companyB._id, spocId: spocB._id });
  const volunteer = await makeUser('volunteer');
  const ngo = await makeUser('ngo', { ngoName: 'Green Earth' });
  return { companyA, companyB, admin, employee, spocA, spocA2, memberA, spocB, memberB, volunteer, ngo };
}
