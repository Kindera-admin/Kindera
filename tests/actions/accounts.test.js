import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeCompany } from '../helpers/factories.js';
import { login, registerUser, signup, getAllUsers } from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

describe('login', () => {
  it("returns the user's company id and name", async () => {
    const w = await makeWorld();
    const res = await login(form({ username: w.spocA.username, password: 'password123' }));
    expect(res.user).toMatchObject({ companyId: String(w.companyA._id), companyName: 'Acme' });
    expect(res.user).not.toHaveProperty('organizationName');
  });
});

describe('registerUser (admin)', () => {
  it('creates a SPOC attached to an active company', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await registerUser(form({ username: 'newspoc', password: 'secret123', name: 'New', role: 'org_spoc', companyId: String(w.companyB._id) }));
    expect(res.success).toBe(true);
    expect(String((await User.findOne({ username: 'newspoc' })).companyId)).toBe(String(w.companyB._id));
  });
  it('requires a company for SPOCs and employees', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await registerUser(form({ username: 'x', password: 'secret123', name: 'X', role: 'org_member' }));
    expect(res).toEqual({ success: false, message: 'Choose the company this person belongs to' });
  });
  it('rejects archived or unknown companies', async () => {
    const w = await makeWorld();
    const archived = await makeCompany('Old Co', { status: 'archived' });
    await actAs(w.admin);
    for (const companyId of [String(archived._id), 'aaaaaaaaaaaaaaaaaaaaaaaa', 'not-an-id']) {
      const res = await registerUser(form({ username: `u-${companyId}`, password: 'secret123', name: 'U', role: 'org_spoc', companyId }));
      expect(res.success).toBe(false);
    }
  });
});

describe('signup (public)', () => {
  const base = { name: 'Asha', password: 'secret123', confirmPassword: 'secret123' };
  it('creates a volunteer with an optional employer', async () => {
    const res = await signup(form({ ...base, username: 'asha', role: 'volunteer', employerName: 'Freelance' }));
    expect(res.success).toBe(true);
    expect((await User.findOne({ username: 'asha' })).employerName).toBe('Freelance');
  });
  it('creates an NGO with ngoName as its name', async () => {
    const res = await signup(form({ ...base, username: 'green', role: 'ngo', ngoName: 'Green Earth', ngoId: 'N-1' }));
    expect(res.success).toBe(true);
    const ngo = await User.findOne({ username: 'green' });
    expect(ngo).toMatchObject({ ngoName: 'Green Earth', name: 'Green Earth', status: 'pending' });
  });
  it('requires an NGO name for NGOs', async () => {
    const res = await signup(form({ ...base, username: 'nameless', role: 'ngo', ngoId: 'N-2' }));
    expect(res).toEqual({ success: false, message: 'NGO name is required' });
  });
  it('no longer accepts SPOC, employee or staff self-signup', async () => {
    for (const role of ['org_spoc', 'org_member', 'employee', 'admin']) {
      const res = await signup(form({ ...base, username: `self-${role}`, role }));
      expect(res).toEqual({ success: false, message: 'Invalid role selected' });
    }
    expect(await User.countDocuments({ username: /^self-/ })).toBe(0);
  });
});

describe('getAllUsers', () => {
  it('shows company, NGO and employer names', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const { users } = await getAllUsers();
    const byName = Object.fromEntries(users.map((u) => [u.username, u]));
    expect(byName[w.spocA.username].companyName).toBe('Acme');
    expect(byName[w.ngo.username].ngoName).toBe('Green Earth');
    expect(users.every((u) => !('organizationName' in u))).toBe(true);
  });
});
