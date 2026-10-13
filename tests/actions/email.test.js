import { describe, it, expect, vi, beforeEach } from 'vitest';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import { getCurrentUser } from '@/lib/auth';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeUser, makeEvent, makeCompany } from '../helpers/factories.js';
import { updateEmail, bulkCreateFromExcel, exportDetailedAttendanceData, registerForEvent } from '@/app/actions';

const raw = (id) => User.collection.findOne({ _id: id });
const INVALID = { success: false, message: 'Enter a valid email address' };
const TAKEN = { success: false, message: 'That email is already used by another account' };
const longEmail = `${'a'.repeat(243)}@example.com`; // 255 characters

// The unique index must really exist for the uniqueness tests to mean anything.
// connectDB first: index builds wait for an open connection and never time out.
beforeEach(async () => {
  await connectDB();
  await User.createIndexes();
});

describe('User.email (R8)', () => {
  it('has a unique index over non-blank strings only (partial, not sparse)', async () => {
    const index = (await User.collection.indexes()).find((i) => i.key?.email === 1);
    expect(index).toMatchObject({ unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } });
    expect(index.sparse).toBeUndefined();
  });
  it('still builds when legacy accounts have a blank email, and still blocks a real duplicate', async () => {
    const emailIndex = (await User.collection.indexes()).find((i) => i.key?.email === 1);
    await User.collection.dropIndex(emailIndex.name); // a database whose index never got built
    try {
      const legacy = (n, extra) => ({ username: `legacy-${n}`, password: 'x', name: `Legacy ${n}`, role: 'volunteer', status: 'approved', ...extra });
      await User.collection.insertOne(legacy(1, { email: '' }));
      await User.collection.insertOne(legacy(2, { email: '' }));
      await User.collection.insertOne(legacy(3, {}));
      await User.collection.insertOne(legacy(4, {}));
      await expect(User.syncIndexes()).resolves.toBeDefined();
      expect((await User.collection.indexes()).find((i) => i.key?.email === 1)).toBeDefined();
      await makeUser('volunteer', { email: 'real@example.com' });
      await expect(makeUser('volunteer', { email: 'REAL@example.com' })).rejects.toThrow(/E11000/);
    } finally {
      await User.deleteMany({});
      await User.syncIndexes(); // leave every index in place for the tests that follow
    }
  });
  it('is stored trimmed and lowercased', async () => {
    const u = await makeUser('volunteer', { email: '  Ann@Example.COM ' });
    expect((await raw(u._id)).email).toBe('ann@example.com');
  });
  it('never stores an empty string', async () => {
    const blank = await makeUser('volunteer', { email: '' });
    const spaces = await makeUser('volunteer', { email: '   ' });
    const none = await makeUser('volunteer');
    for (const u of [blank, spaces, none]) expect(await raw(u._id)).not.toHaveProperty('email');
  });
  it('rejects a malformed or over-long address', async () => {
    for (const email of ['not-an-email', 'a@b', 'a b@c.de', longEmail]) {
      await expect(makeUser('volunteer', { email })).rejects.toThrow(/email/i);
    }
  });
  it('lets any number of accounts have no email, but never two with the same one', async () => {
    await makeUser('volunteer');
    await makeUser('volunteer');
    await makeUser('volunteer', { email: '' });
    await makeUser('volunteer', { email: 'same@example.com' });
    await expect(makeUser('volunteer', { email: 'SAME@example.com' })).rejects.toThrow(/E11000/);
  });
});

describe('getCurrentUser includes the email (R8)', () => {
  it('returns it as a plain string', async () => {
    const u = await makeUser('volunteer', { email: 'me@example.com' });
    await actAs(u);
    expect((await getCurrentUser()).email).toBe('me@example.com');
  });
});

describe('updateEmail (R8)', () => {
  it('sets the email, trimmed and lowercased', async () => {
    const u = await makeUser('org_member', { companyId: (await makeCompany('Acme'))._id });
    await actAs(u);
    expect(await updateEmail('  New.Person@Example.COM ')).toEqual({ success: true, email: 'new.person@example.com' });
    expect((await raw(u._id)).email).toBe('new.person@example.com');
  });
  it('rejects an invalid address and changes nothing', async () => {
    const u = await makeUser('volunteer', { email: 'keep@example.com' });
    await actAs(u);
    for (const bad of ['nope', 'a@b', 'a b@c.de', longEmail, 123, { $ne: null }, null, undefined]) {
      expect(await updateEmail(bad)).toEqual(INVALID);
    }
    expect((await raw(u._id)).email).toBe('keep@example.com');
  });
  it('refuses an email another account uses, without naming it, and leaves both accounts alone', async () => {
    const other = await makeUser('volunteer', { email: 'taken@example.com' });
    const u = await makeUser('volunteer', { email: 'mine@example.com' });
    await actAs(u);
    const res = await updateEmail('Taken@Example.com');
    expect(res).toEqual(TAKEN);
    expect(JSON.stringify(res)).not.toContain(other.username);
    expect((await raw(other._id)).email).toBe('taken@example.com');
    expect((await raw(u._id)).email).toBe('mine@example.com');
  });
  it('treats a legacy mixed-case email as taken too', async () => {
    const legacy = await makeUser('volunteer');
    await User.collection.updateOne({ _id: legacy._id }, { $set: { email: 'Legacy@Example.com' } });
    const u = await makeUser('volunteer');
    await actAs(u);
    expect(await updateEmail('legacy@example.com')).toEqual(TAKEN);
    expect(await raw(u._id)).not.toHaveProperty('email');
  });
  it('lets a user re-save their own email', async () => {
    const u = await makeUser('volunteer', { email: 'mine@example.com' });
    await actAs(u);
    expect(await updateEmail('MINE@example.com')).toEqual({ success: true, email: 'mine@example.com' });
  });
  it('removes the email when given an empty value', async () => {
    const u = await makeUser('volunteer', { email: 'gone@example.com' });
    await actAs(u);
    expect(await updateEmail('   ')).toEqual({ success: true, email: '' });
    expect(await raw(u._id)).not.toHaveProperty('email');
  });
  it('refuses a signed-out caller', async () => {
    expect(await updateEmail('x@example.com')).toEqual({ success: false, message: 'Not authenticated' });
  });
  it('falls back on the unique index when the pre-check misses a race', async () => {
    await makeUser('volunteer', { email: 'race@example.com' });
    const u = await makeUser('volunteer');
    await actAs(u);
    const exists = vi.spyOn(User, 'exists').mockReturnValue({ collation: async () => null });
    try {
      expect(await updateEmail('race@example.com')).toEqual(TAKEN);
    } finally {
      exists.mockRestore();
    }
    expect(await raw(u._id)).not.toHaveProperty('email');
  });
  it('answers a database failure with a safe message', async () => {
    const u = await makeUser('volunteer');
    await actAs(u);
    const spy = vi.spyOn(User, 'updateOne').mockRejectedValue(new Error('internal detail'));
    try {
      expect(await updateEmail('x@example.com')).toEqual({ success: false, message: 'Could not update your email. Please try again.' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('bulk upload stores emails (R8)', () => {
  async function spocOf(name = 'Microsoft') {
    const company = await makeCompany(name);
    await actAs(await makeUser('org_spoc', { companyId: company._id }));
    return company;
  }
  it('stores a valid Email value, lowercased, keeping ID before Email for the login', async () => {
    await spocOf();
    const res = await bulkCreateFromExcel([
      { name: 'Ravi', employeeId: '1001', username: 'Ravi@Example.com', email: 'Ravi@Example.com' },
      { name: 'Meena', username: 'meena@example.com', email: 'meena@example.com' },
    ]);
    expect(res).toEqual(expect.objectContaining({ success: true, created: 2, failed: 0 }));
    expect(res).not.toHaveProperty('message');
    expect((await User.findOne({ username: 'microsoft-1001' })).email).toBe('ravi@example.com');
    expect((await User.findOne({ username: 'meena@example.com' })).email).toBe('meena@example.com');
  });
  it('creates the row without an email when the address is invalid', async () => {
    await spocOf();
    const res = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001', email: 'not-an-email' }]);
    expect(res).toMatchObject({ success: true, created: 1, failed: 0 });
    expect(res.message).toBe('1 email was ignored because it is not a valid address.');
    expect(await User.collection.findOne({ username: 'microsoft-1001' })).not.toHaveProperty('email');
  });
  it('drops an email another account uses, creates the account, warns, and leaves the other account alone', async () => {
    const other = await makeUser('volunteer', { email: 'taken@example.com' });
    await spocOf();
    const res = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001', email: 'Taken@example.com' }]);
    expect(res).toMatchObject({ success: true, created: 1, failed: 0 });
    expect(res.message).toBe('1 email was not saved because another account or an earlier row already uses it.');
    expect(JSON.stringify(res)).not.toMatch(/E11000|taken@example\.com/i);
    expect(await User.collection.findOne({ username: 'microsoft-1001' })).not.toHaveProperty('email');
    expect((await raw(other._id)).email).toBe('taken@example.com');
  });
  it('keeps a repeated email only on its first row', async () => {
    await spocOf();
    const res = await bulkCreateFromExcel([
      { name: 'First', employeeId: '1', email: 'dup@example.com' },
      { name: 'Second', employeeId: '2', email: 'DUP@example.com' },
    ]);
    expect(res).toMatchObject({ success: true, created: 2, failed: 0 });
    expect(res.message).toBe('1 email was not saved because another account or an earlier row already uses it.');
    expect((await User.findOne({ username: 'microsoft-1' })).email).toBe('dup@example.com');
    expect(await User.collection.findOne({ username: 'microsoft-2' })).not.toHaveProperty('email');
  });
  it('saves the account without the email when another account takes it between the check and the insert', async () => {
    await makeUser('volunteer', { email: 'race@example.com' });
    await spocOf();
    const distinct = vi.spyOn(User, 'distinct').mockReturnValue({ collation: async () => [] });
    let res;
    try {
      res = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001', email: 'race@example.com' }, { name: 'Meena', employeeId: '1002' }]);
    } finally {
      distinct.mockRestore();
    }
    expect(res).toMatchObject({ success: true, created: 2, failed: 0 });
    expect(res.message).toBe('1 email was not saved because another account or an earlier row already uses it.');
    expect(await User.collection.findOne({ username: 'microsoft-1001' })).not.toHaveProperty('email');
  });
  it('does not count the email of a row that failed for its username', async () => {
    await spocOf();
    await makeUser('volunteer', { username: 'microsoft-1001' });
    const res = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001', email: 'ravi@example.com' }]);
    expect(res).toMatchObject({ success: false, created: 0, failed: 1 });
    expect(res.message).toBe('Created 0 of 1 accounts. The others were not created because their usernames are already taken.');
    expect(await User.countDocuments({ email: 'ravi@example.com' })).toBe(0);
  });
});

describe('detailed attendance export (R8)', () => {
  it('fills volunteerEmail with the real email or blank, and adds volunteerUsername', async () => {
    const w = await makeWorld();
    await User.updateOne({ _id: w.memberA._id }, { $set: { email: 'member.a@example.com' } });
    const ev = await makeEvent(w.admin);
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true, hoursContributed: 2 });
    await Attendance.create({ eventId: ev._id, userId: w.memberB._id, companyId: w.companyB._id, attended: true, hoursContributed: 1 });
    await actAs(w.admin);
    const res = await exportDetailedAttendanceData();
    expect(res.success).toBe(true);
    const byName = Object.fromEntries(res.data.map((r) => [r.volunteerName, r]));
    expect(byName[w.memberA.name]).toMatchObject({ volunteerEmail: 'member.a@example.com', volunteerUsername: w.memberA.username });
    expect(byName[w.memberB.name]).toMatchObject({ volunteerEmail: '', volunteerUsername: w.memberB.username });
  });
});

describe('guest registration and the new email field (R8)', () => {
  const guestForm = (email) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ username: `guest-${Math.random().toString(36).slice(2)}`, password: 'secret123', name: 'Guest', email })) fd.append(k, v);
    return fd;
  };
  async function publicEvent() {
    const admin = await makeUser('admin');
    return makeEvent(admin);
  }
  it('stores no email field for a blank email', async () => {
    const ev = await publicEvent();
    const fd = guestForm('');
    expect((await registerForEvent(fd, String(ev._id))).success).toBe(true);
    expect(await User.collection.findOne({ username: fd.get('username') })).not.toHaveProperty('email');
  });
  it('stores a valid email lowercased', async () => {
    const ev = await publicEvent();
    const fd = guestForm('Guest@Example.com');
    expect((await registerForEvent(fd, String(ev._id))).success).toBe(true);
    expect((await User.collection.findOne({ username: fd.get('username') })).email).toBe('guest@example.com');
  });
  it('refuses an invalid email with a plain message', async () => {
    const ev = await publicEvent();
    expect(await registerForEvent(guestForm('nope'), String(ev._id))).toEqual(INVALID);
  });
  it('registers without the email when another account takes it between the check and the insert', async () => {
    await makeUser('volunteer', { email: 'race@example.com' });
    const ev = await publicEvent();
    const fd = guestForm('race@example.com');
    const exists = vi.spyOn(User, 'exists').mockReturnValue({ collation: async () => null });
    let res;
    try {
      res = await registerForEvent(fd, String(ev._id));
    } finally {
      exists.mockRestore();
    }
    expect(res).toEqual({ success: true, pending: true });
    expect(await User.collection.findOne({ username: fd.get('username') })).not.toHaveProperty('email');
  });
  it('registers without the email when another account already uses it, revealing nothing', async () => {
    await makeUser('volunteer', { email: 'taken@example.com' });
    const ev = await publicEvent();
    const fd = guestForm('taken@example.com');
    const res = await registerForEvent(fd, String(ev._id));
    expect(res).toEqual({ success: true, pending: true });
    expect(await User.collection.findOne({ username: fd.get('username') })).not.toHaveProperty('email');
  });
});
