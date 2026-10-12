import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Event from '@/models/Event';
import Attendance from '@/models/Attendance';
import { makeCompany, makeUser, makeEvent } from '../helpers/factories.js';

describe('company fields', () => {
  it('no model keeps organizationName or organizationLogo', () => {
    expect(User.schema.path('organizationName')).toBeUndefined();
    expect(User.schema.path('organizationLogo')).toBeUndefined();
    expect(Event.schema.path('organizationName')).toBeUndefined();
    expect(Attendance.schema.path('organizationName')).toBeUndefined();
  });
  it('requires companyId for SPOCs and employees', async () => {
    await expect(makeUser('org_spoc')).rejects.toThrow(/companyId/);
    await expect(makeUser('org_member')).rejects.toThrow(/companyId/);
  });
  it('accepts SPOCs and employees with a company', async () => {
    const c = await makeCompany('Acme');
    const spoc = await makeUser('org_spoc', { companyId: c._id });
    expect(String(spoc.companyId)).toBe(String(c._id));
  });
  it('does not require a company for NGOs and volunteers, and stores their own fields', async () => {
    const ngo = await makeUser('ngo', { ngoName: 'Green Earth' });
    const vol = await makeUser('volunteer', { employerName: 'Freelance' });
    expect(ngo.companyId).toBeNull();
    expect(ngo.ngoName).toBe('Green Earth');
    expect(vol.employerName).toBe('Freelance');
  });
  it('makes events public unless a company is set', async () => {
    const admin = await makeUser('admin');
    expect((await makeEvent(admin)).companyId).toBeNull();
  });
  it('allows attendance without a company (individual volunteers)', async () => {
    const admin = await makeUser('admin');
    const vol = await makeUser('volunteer');
    const event = await makeEvent(admin);
    const att = await Attendance.create({ eventId: event._id, userId: vol._id, attended: true });
    expect(att.companyId).toBeNull();
  });
});
