import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent, makeUser } from '../helpers/factories.js';
import { getEventRegisteredCount, registerForEventLoggedIn } from '@/app/actions';

const NOT_FOUND = { success: false, message: 'Event not found' };

const registrationsFor = async (eventId) => {
  const users = await User.find({ 'eventRegistrations.eventId': eventId });
  return users.flatMap((u) => u.eventRegistrations.filter((r) => String(r.eventId) === String(eventId)));
};

describe('getEventRegisteredCount (B1)', () => {
  it('gives the count to people who can see the event', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    for (const who of [w.memberA, w.spocA2, w.admin]) {
      await actAs(who);
      expect(await getEventRegisteredCount(String(ev._id))).toMatchObject({ success: true, count: 1 });
    }
  });
  it('answers outsiders of an internal event exactly as for a missing event', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    for (const who of [w.memberB, w.spocB, w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect(await getEventRegisteredCount(String(ev._id))).toEqual(NOT_FOUND);
    }
    await actAs(w.volunteer);
    expect(await getEventRegisteredCount('64b7f0f0f0f0f0f0f0f0f0f0')).toEqual(NOT_FOUND);
  });
  it('refuses malformed ids with the same result', async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    for (const bad of ['not-an-id', '', undefined, { $ne: null }, ['64b7f0f0f0f0f0f0f0f0f0f0']]) {
      expect(await getEventRegisteredCount(bad)).toEqual(NOT_FOUND);
    }
  });
  it('still serves a public event to a logged-out visitor', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(null);
    expect(await getEventRegisteredCount(String(ev._id))).toMatchObject({ success: true, count: 0 });
  });
});

describe('volunteersCount (B2)', () => {
  it('refuses anything but an integer from 1 to 500 and records nothing', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocA);
    for (const bad of [0, -5, 1.5, 'abc', '3x', 501, NaN, Infinity, null, { $gt: 1 }, [2]]) {
      const res = await registerForEventLoggedIn(String(ev._id), '', bad);
      expect(res).toEqual({ success: false, message: 'Choose between 1 and 500 volunteers.' });
    }
    expect(await registrationsFor(ev._id)).toHaveLength(0);
  });
  it('accepts a valid count and records it', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocA);
    expect((await registerForEventLoggedIn(String(ev._id), '', 500)).success).toBe(true);
    expect((await registrationsFor(ev._id))[0].volunteersCount).toBe(500);
  });
  it("refuses more than the event's remaining capacity", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin, { capacity: 10 });
    await User.updateOne({ _id: w.spocB._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved', volunteersCount: 7 } } });
    await actAs(w.spocA);
    const res = await registerForEventLoggedIn(String(ev._id), '', 4);
    expect(res).toEqual({ success: false, message: 'Only 3 spots left. You requested 4.' });
    expect(await registrationsFor(ev._id)).toHaveLength(1);
    expect((await registerForEventLoggedIn(String(ev._id), '', 3)).success).toBe(true);
  });
});

describe('an employee with no company (B6)', () => {
  it('is refused on a public event even when a SPOC has registered it, and nothing is recorded', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await User.updateOne({ _id: w.spocB._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    const stray = await makeUser('org_member', { companyId: w.companyA._id });
    await User.updateOne({ _id: stray._id }, { $unset: { companyId: 1 } });
    await actAs(stray);
    const res = await registerForEventLoggedIn(String(ev._id), '');
    expect(res).toEqual({ success: false, message: 'Your account is not linked to a company. Please contact your SPOC.' });
    expect(await registrationsFor(ev._id)).toHaveLength(1); // only spocB's
  });
});
