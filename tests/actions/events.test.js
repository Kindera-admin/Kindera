import { describe, it, expect } from 'vitest';
import Event from '@/models/Event';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import {
  createEvent, getEvents, getHomeEvents, getEventById, updateEvent, deleteEvent,
  getPendingEventRegistrations, updateEventRegistrationStatus,
} from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const titles = (res) => res.events.map((e) => e.title).sort();

async function seedEvents(w) {
  await makeEvent(w.admin, { title: 'Admin public' });
  await makeEvent(w.ngo, { title: 'NGO public' });
  await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id });
  await makeEvent(w.spocB, { title: 'B internal', companyId: w.companyB._id });
  // Created by an NGO login but scoped to company A. It must not leak (guards project 2).
  await makeEvent(w.ngo, { title: 'NGO for A', companyId: w.companyA._id });
}

describe('event lists', () => {
  it('show logged-out visitors, volunteers and NGOs only public events', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    for (const who of [null, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(titles(await getEvents())).toEqual(['Admin public', 'NGO public']);
    }
  });
  it("show every SPOC and employee of a company that company's events", async () => {
    const w = await makeWorld();
    await seedEvents(w);
    for (const who of [w.spocA, w.spocA2, w.memberA]) {
      await actAs(who);
      expect(titles(await getEvents())).toEqual(['A internal', 'Admin public', 'NGO for A', 'NGO public']);
    }
  });
  it("never show a company another company's events", async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.memberB);
    expect(titles(await getEvents())).toEqual(['Admin public', 'B internal', 'NGO public']);
  });
  it('show staff everything', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.employee);
    expect((await getEvents()).events).toHaveLength(5);
  });
  it('apply the same rule on the home page', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.volunteer);
    expect(titles(await getHomeEvents())).toEqual(['Admin public', 'NGO public']);
  });
  it('include companyId on each event', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.spocA);
    const internal = (await getEvents()).events.find((e) => e.title === 'A internal');
    expect(internal.companyId).toBe(String(w.companyA._id));
  });
});

describe('getEventById', () => {
  it('opens a company event for another SPOC of the same company', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await getEventById(String(ev._id));
    expect(res.success).toBe(true);
    expect(res.event).toMatchObject({ companyId: String(w.companyA._id), companyName: 'Acme' });
  });
  it('refuses other companies, volunteers and logged-out visitors', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.spocB, w.memberB, w.volunteer, null]) {
      await actAs(who);
      expect((await getEventById(String(ev._id))).success).toBe(false);
    }
  });
});

describe('createEvent', () => {
  const fields = { title: 'T', description: 'D', date: '2030-01-01T10:00', location: 'L' };
  it("scopes a SPOC's event to their company", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await createEvent(form(fields));
    expect(String((await Event.findById(res.event._id)).companyId)).toBe(String(w.companyA._id));
  });
  it('keeps admin and NGO events public', async () => {
    const w = await makeWorld();
    for (const who of [w.admin, w.ngo]) {
      await actAs(who);
      const res = await createEvent(form(fields));
      expect((await Event.findById(res.event._id)).companyId).toBeNull();
    }
  });
});

describe('update and delete', () => {
  it("let any SPOC of the company edit and delete the company's events", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    expect((await updateEvent(String(ev._id), form({ title: 'Renamed', description: 'D', date: '2030-01-01T10:00', location: 'L', status: 'upcoming' }))).success).toBe(true);
    expect((await deleteEvent(String(ev._id))).success).toBe(true);
  });
  it('refuse employees of the company and other companies', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.memberA, w.spocB]) {
      await actAs(who);
      expect((await deleteEvent(String(ev._id))).success).toBe(false);
    }
    expect(await Event.countDocuments({ _id: ev._id })).toBe(1);
  });
});

describe('registration review', () => {
  it("shows a SPOC the pending registrations for any of their company's events", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'pending' } } });
    await actAs(w.spocA2);
    const { users } = await getPendingEventRegistrations();
    expect(users.map((u) => u._id)).toEqual([String(w.memberA._id)]);
    expect(users[0].companyName).toBe('Acme');
  });
  it("lets any SPOC of the company approve, and refuses another company's SPOC", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'pending' } } });
    await actAs(w.spocB);
    expect((await updateEventRegistrationStatus(form({ userId: String(w.memberA._id), eventId: String(ev._id), status: 'approved' }))).success).toBe(false);
    await actAs(w.spocA2);
    expect((await updateEventRegistrationStatus(form({ userId: String(w.memberA._id), eventId: String(ev._id), status: 'approved' }))).success).toBe(true);
  });
});
