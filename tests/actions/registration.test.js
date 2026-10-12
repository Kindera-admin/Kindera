import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import { registerForEvent, registerForEventLoggedIn } from '@/app/actions';

const guestForm = () => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ username: 'guest1', password: 'secret123', name: 'Guest' })) fd.append(k, v);
  return fd;
};

// Registrations recorded against an event, across every user.
const registrationsFor = async (eventId) => {
  const users = await User.find({ 'eventRegistrations.eventId': eventId });
  return users.flatMap((u) => u.eventRegistrations.filter((r) => String(r.eventId) === String(eventId)));
};

describe('internal company events', () => {
  it("let an employee join an event created by any SPOC of their company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA2, { companyId: w.companyA._id });
    await actAs(w.memberA); // memberA's spocId is spocA, not spocA2
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(true);
    const regs = await registrationsFor(ev._id);
    expect(regs).toHaveLength(1);
    expect(regs[0].status).toBe('approved');
  });
  it('refuse everyone outside the company and record nothing', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.memberB, w.spocB, w.volunteer, w.ngo, null]) {
      await actAs(who);
      const res = await registerForEventLoggedIn(String(ev._id), '');
      expect(res.success).toBe(false);
    }
    expect(await registrationsFor(ev._id)).toHaveLength(0);
  });
  it("answer an outsider exactly as for a missing event, so internal events can't be probed", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.volunteer);
    const hidden = await registerForEventLoggedIn(String(ev._id), '');
    const missing = await registerForEventLoggedIn('64b7f0f0f0f0f0f0f0f0f0f0', '');
    expect(hidden).toEqual(missing);
    expect(hidden.message).toBe('Event not found');
  });
  it("don't let a SPOC register themselves for their own company's internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await registerForEventLoggedIn(String(ev._id), '');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/internal event/);
    expect(await registrationsFor(ev._id)).toHaveLength(0);
  });
  it("don't let staff register for an internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.admin, w.employee]) {
      await actAs(who);
      expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    }
    expect(await registrationsFor(ev._id)).toHaveLength(0);
  });
  it('refuse guest registration and create no account', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    const before = await User.countDocuments();
    expect((await registerForEvent(guestForm(), String(ev._id))).success).toBe(false);
    expect(await User.countDocuments()).toBe(before);
    expect(await User.findOne({ username: 'guest1' })).toBeNull();
  });
  it('refuse an event scoped to a company even when an NGO created it', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.ngo, { companyId: w.companyA._id });
    await actAs(w.volunteer);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    expect(await registrationsFor(ev._id)).toHaveLength(0);
  });
});

describe('malformed event ids', () => {
  it('get a safe message, not a cast error', async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    for (const bad of ['not-an-id', '', undefined, { $ne: null }]) {
      const res = await registerForEventLoggedIn(bad, '');
      expect(res).toEqual({ success: false, message: 'Event not found' });
      const guest = await registerForEvent(guestForm(), bad);
      expect(guest).toEqual({ success: false, message: 'Event not found' });
    }
    expect(await User.findOne({ username: 'guest1' })).toBeNull();
  });
});

describe('public events', () => {
  it('let a volunteer and a guest register', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.volunteer);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(true);
    expect((await registerForEvent(guestForm(), String(ev._id))).success).toBe(true);
    expect(await registrationsFor(ev._id)).toHaveLength(2);
  });
  it('make an employee wait until any SPOC of their company has registered', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.memberA);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    expect(await registrationsFor(ev._id)).toHaveLength(0);
    await User.updateOne({ _id: w.spocA2._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved', volunteersCount: 5 } } });
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(true);
    expect(await registrationsFor(ev._id)).toHaveLength(2);
  });
  it("don't count another company's SPOC registration", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await User.updateOne({ _id: w.spocB._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    await actAs(w.memberA);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    expect(await registrationsFor(ev._id)).toHaveLength(1); // only spocB's
  });
});
