import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import { getEvents, getOrgEventsHistory } from '@/app/actions';

const flagsByTitle = (res) => Object.fromEntries(res.events.map((e) => [e.title, e.isOwnCompanyEvent]));

describe('getEvents marks the caller company\'s own events (C1)', () => {
  it('for every SPOC and employee of the company, not only the creator', async () => {
    const w = await makeWorld();
    await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id });
    await makeEvent(w.admin, { title: 'Public' });
    for (const who of [w.spocA, w.spocA2, w.memberA]) {
      await actAs(who);
      expect(flagsByTitle(await getEvents())).toEqual({ 'A internal': true, Public: false });
    }
  });
  it('is false for staff, other companies and outsiders', async () => {
    const w = await makeWorld();
    await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id });
    await makeEvent(w.spocB, { title: 'B internal', companyId: w.companyB._id });
    await actAs(w.admin);
    expect(flagsByTitle(await getEvents())).toEqual({ 'A internal': false, 'B internal': false });
    await actAs(w.spocB);
    expect(flagsByTitle(await getEvents())).toEqual({ 'B internal': true });
    for (const who of [w.volunteer, null]) {
      await actAs(who);
      expect(flagsByTitle(await getEvents())).toEqual({});
    }
  });
});

describe('company event history delete flag (C1)', () => {
  async function setup() {
    const w = await makeWorld();
    const internal = await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id });
    const pub = await makeEvent(w.admin, { title: 'Public' });
    for (const ev of [internal, pub]) {
      await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    }
    return w;
  }
  const canDeleteByTitle = (res) => Object.fromEntries(res.history.map((h) => [h.title, h.canDelete]));
  it('lets any SPOC of the company delete its internal events, not public ones', async () => {
    const w = await setup();
    for (const who of [w.spocA, w.spocA2]) {
      await actAs(who);
      expect(canDeleteByTitle(await getOrgEventsHistory(String(w.companyA._id)))).toEqual({ 'A internal': true, Public: false });
    }
  });
  it('never offers delete to an employee', async () => {
    const w = await setup();
    await actAs(w.memberA);
    expect(canDeleteByTitle(await getOrgEventsHistory(String(w.companyA._id)))).toEqual({ 'A internal': false, Public: false });
  });
});
