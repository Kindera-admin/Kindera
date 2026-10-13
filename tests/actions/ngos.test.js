import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import NGOPartner from '@/models/NGOPartner';
import User from '@/models/User';
import Event from '@/models/Event';
import Company from '@/models/Company';
import { ngoEventCompanies } from '@/lib/ngo';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makePartner, makeUser, makeEvent, makeCompany } from '../helpers/factories.js';
import {
  login, registerUser, getAllNGOPartners, getMyNGOs, createNGOPartner, updateNGOPartner,
  deleteNGOPartner, importNGOPartners, generateNGOLogin, deleteUser, getImpactStats, getAdminImpactStats,
} from '@/app/actions';

const STAFF_ONLY = { success: false, message: 'Only admins and employees can manage NGO partners' };
const ACTIVE_ONLY = { success: false, message: 'Choose active companies only' };
const NOT_FOUND = { success: false, message: 'NGO partner not found' };
const NOT_AUTHENTICATED = { success: false, message: 'Not authenticated' };
const DAY = 24 * 60 * 60 * 1000;

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  return fd;
};
const idList = (...companies) => JSON.stringify(companies.map((c) => String(c._id)));
const names = (res) => res.partners.map((p) => p.name).sort();
const partnerForm = (extra = {}) => form({ name: 'Green Earth', description: 'Plants trees', ...extra });

// Everything an action could change, so a refused call can prove it changed nothing.
const dbState = async () => ({
  partners: await NGOPartner.find().sort({ _id: 1 }).lean(),
  users: await User.find().sort({ _id: 1 }).lean(),
  events: await Event.find().sort({ _id: 1 }).lean(),
});

async function seedPartners(w) {
  await makePartner({ name: 'Public' });
  await makePartner({ name: 'OnlyA', companyIds: [w.companyA._id] });
  await makePartner({ name: 'AandB', companyIds: [w.companyA._id, w.companyB._id] });
  await makePartner({ name: 'OnlyB', companyIds: [w.companyB._id] });
}

// A card with a linked NGO login, built directly so a test does not depend on generateNGOLogin.
async function makeLinkedPartner(fields = {}) {
  const card = await makePartner(fields);
  const user = await makeUser('ngo', { ngoPartnerId: card._id, ngoName: card.name });
  await NGOPartner.updateOne({ _id: card._id }, { loginUserId: user._id });
  return { card, user };
}

beforeAll(async () => {
  // The unique username/ngoId indexes must exist before the collision tests rely on them.
  await connectDB();
  await Promise.all([User.init(), NGOPartner.init(), Company.init()]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getAllNGOPartners', () => {
  it('shows staff every card', async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.admin, w.employee]) {
      await actAs(who);
      expect(names(await getAllNGOPartners())).toEqual(['AandB', 'OnlyA', 'OnlyB', 'Public']);
    }
  });
  it("shows a company's SPOCs and employees public cards plus their own company's cards", async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.spocA, w.spocA2, w.memberA]) {
      await actAs(who);
      expect(names(await getAllNGOPartners())).toEqual(['AandB', 'OnlyA', 'Public']);
    }
  });
  it("never shows a company another company's cards", async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.spocB, w.memberB]) {
      await actAs(who);
      expect(names(await getAllNGOPartners())).toEqual(['AandB', 'OnlyB', 'Public']);
    }
  });
  it('shows volunteers, NGOs and logged-out visitors public cards only', async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect(names(await getAllNGOPartners())).toEqual(['Public']);
    }
  });
  it('keeps the existing card fields and adds companyIds and companyNames', async () => {
    const w = await makeWorld();
    await makePartner({
      name: 'Rich', description: 'd', logoUrl: 'https://x/logo.png', focusAreas: 'Trees', programs: ['a', 'b'],
      impact: 'big', registeredOffice: 'Pune', location: 'Goa', website: 'https://rich.org',
      companyIds: [w.companyA._id, w.companyB._id],
    });
    await actAs(w.admin);
    const [p] = (await getAllNGOPartners()).partners;
    expect(p).toMatchObject({
      name: 'Rich', description: 'd', logoUrl: 'https://x/logo.png', focusAreas: 'Trees', programs: ['a', 'b'],
      impact: 'big', registeredOffice: 'Pune', location: 'Goa', website: 'https://rich.org',
      companyIds: [String(w.companyA._id), String(w.companyB._id)],
      companyNames: ['Acme', 'Beta'],
    });
    expect(typeof p._id).toBe('string');
    expect(typeof p.createdAt).toBe('string');
  });
  it('gives a public card empty companyIds and companyNames', async () => {
    const w = await makeWorld();
    await makePartner({ name: 'Public' });
    await actAs(null);
    const [p] = (await getAllNGOPartners()).partners;
    expect(p).toMatchObject({ name: 'Public', companyIds: [], companyNames: [] });
  });
  it('keeps an archived company on an existing card', async () => {
    const w = await makeWorld();
    await makePartner({ name: 'AandB', companyIds: [w.companyA._id, w.companyB._id] });
    await Company.updateOne({ _id: w.companyB._id }, { status: 'archived' });
    await actAs(w.admin);
    const [p] = (await getAllNGOPartners()).partners;
    expect(p.companyIds).toEqual([String(w.companyA._id), String(w.companyB._id)]);
    expect(p.companyNames).toEqual(['Acme', 'Beta']);
  });
  it("does not tell a company which other companies share a card", async () => {
    const w = await makeWorld();
    await makePartner({ name: 'AandB', companyIds: [w.companyA._id, w.companyB._id] });
    await actAs(w.spocA);
    const [p] = (await getAllNGOPartners()).partners;
    expect(p.companyIds).toEqual([String(w.companyA._id)]);
    expect(p.companyNames).toEqual(['Acme']);
    expect(JSON.stringify(p)).not.toContain(String(w.companyB._id));
    expect(JSON.stringify(p)).not.toContain('Beta');
  });
  it('gives staff loginUsername and nobody else', async () => {
    const w = await makeWorld();
    const { user } = await makeLinkedPartner({ name: 'Linked' });
    await makePartner({ name: 'Unlinked' });
    await actAs(w.admin);
    const staffView = Object.fromEntries((await getAllNGOPartners()).partners.map((p) => [p.name, p]));
    expect(staffView.Linked.loginUsername).toBe(user.username);
    expect(staffView.Unlinked.loginUsername).toBeNull();
    for (const who of [w.spocA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      for (const p of (await getAllNGOPartners()).partners) {
        expect(p).not.toHaveProperty('loginUsername');
        expect(p).not.toHaveProperty('loginUserId');
      }
    }
  });
});

describe('getMyNGOs', () => {
  it('gives every SPOC and employee of a company the same list, with only that company cards', async () => {
    const w = await makeWorld();
    await seedPartners(w);
    await actAs(w.spocA);
    const first = await getMyNGOs();
    expect(first.success).toBe(true);
    expect(names(first)).toEqual(['AandB', 'OnlyA']);
    for (const who of [w.spocA2, w.memberA]) {
      await actAs(who);
      expect(await getMyNGOs()).toEqual(first);
    }
  });
  it("never shows a company another company's cards, but shows a card both share", async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.spocB, w.memberB]) {
      await actAs(who);
      expect(names(await getMyNGOs())).toEqual(['AandB', 'OnlyB']);
    }
  });
  it('leaves out public cards', async () => {
    const w = await makeWorld();
    await makePartner({ name: 'Public' });
    await actAs(w.spocA);
    expect((await getMyNGOs()).partners).toEqual([]);
  });
  it('has the card fields without the login, and the upcoming count', async () => {
    const w = await makeWorld();
    const { user } = await makeLinkedPartner({ name: 'Mine', focusAreas: 'Trees', companyIds: [w.companyA._id] });
    await actAs(w.spocA);
    const [p] = (await getMyNGOs()).partners;
    expect(p).toMatchObject({
      name: 'Mine', description: 'desc', focusAreas: 'Trees', programs: [], logoUrl: '',
      companyIds: [String(w.companyA._id)], companyNames: ['Acme'], upcomingEvents: 0,
    });
    expect(p).not.toHaveProperty('loginUsername');
    expect(JSON.stringify(p)).not.toContain(user.username);
  });
  it('refuses volunteers, NGOs and staff', async () => {
    const w = await makeWorld();
    await seedPartners(w);
    for (const who of [w.volunteer, w.ngo, w.admin, w.employee]) {
      await actAs(who);
      const res = await getMyNGOs();
      expect(res).toEqual({ success: false, message: 'Not authorized' });
    }
  });
  it('refuses a logged-out caller', async () => {
    const w = await makeWorld();
    await seedPartners(w);
    await actAs(null);
    expect(await getMyNGOs()).toEqual(NOT_AUTHENTICATED);
  });
  it("counts only upcoming events the card's login made for the caller's company", async () => {
    const w = await makeWorld();
    const { user } = await makeLinkedPartner({ name: 'Shared', companyIds: [w.companyA._id, w.companyB._id] });
    await makePartner({ name: 'NoLogin', companyIds: [w.companyA._id] });
    const otherNgo = await makeUser('ngo');
    await makeEvent(user, { companyId: w.companyA._id });
    await makeEvent(user, { companyId: w.companyA._id, date: new Date(Date.now() + DAY) });
    await makeEvent(user, { companyId: w.companyA._id, date: new Date(Date.now() - DAY) }); // already past
    await makeEvent(user, { companyId: w.companyB._id });
    await makeEvent(user, { companyId: null }); // public events are not company events
    await makeEvent(user, { companyId: w.companyA._id, status: 'cancelled' });
    await makeEvent(user, { companyId: w.companyA._id, status: 'completed' });
    await makeEvent(user, { companyId: w.companyB._id, status: 'cancelled' });
    await makeEvent(otherNgo, { companyId: w.companyA._id }); // another login
    await makeEvent(w.spocA, { companyId: w.companyA._id }); // not the card's login
    const countFor = async (who, name) => {
      await actAs(who);
      return (await getMyNGOs()).partners.find((p) => p.name === name).upcomingEvents;
    };
    expect(await countFor(w.spocA, 'Shared')).toBe(2);
    expect(await countFor(w.spocA2, 'Shared')).toBe(2);
    expect(await countFor(w.memberA, 'Shared')).toBe(2);
    expect(await countFor(w.spocB, 'Shared')).toBe(1);
    expect(await countFor(w.spocA, 'NoLogin')).toBe(0);
  });
});

describe('card order', () => {
  it('lists newest first and breaks ties by id, the same for every caller', async () => {
    const w = await makeWorld();
    const same = new Date('2026-01-01T00:00:00Z');
    const rows = [['Oldest', new Date('2025-01-01T00:00:00Z')], ['Tie 1', same], ['Tie 2', same], ['Tie 3', same]];
    for (const [name, createdAt] of rows) await makePartner({ name, companyIds: [w.companyA._id], createdAt });
    expect((await NGOPartner.find({ name: /^Tie/ }).lean()).map((p) => String(p.createdAt))).toEqual([String(same), String(same), String(same)]);
    const expected = ['Tie 3', 'Tie 2', 'Tie 1', 'Oldest'];
    for (const who of [w.spocA, w.spocA2, w.memberA]) {
      await actAs(who);
      expect((await getMyNGOs()).partners.map((p) => p.name)).toEqual(expected);
      expect((await getAllNGOPartners()).partners.map((p) => p.name)).toEqual(expected);
    }
    await actAs(w.admin);
    expect((await getAllNGOPartners()).partners.map((p) => p.name)).toEqual(expected);
  });
});

describe('homepage and admin NGO counts', () => {
  it('counts only public partners for the public homepage stats, and every partner for the admin', async () => {
    const w = await makeWorld();
    await makePartner({ name: 'Public' });
    await NGOPartner.collection.insertOne({ name: 'Legacy', description: 'no companyIds field' });
    await makePartner({ name: 'OnlyA', companyIds: [w.companyA._id] });
    await makePartner({ name: 'AandB', companyIds: [w.companyA._id, w.companyB._id] });
    expect(await NGOPartner.countDocuments()).toBe(4);
    for (const who of [null, w.volunteer, w.spocA, w.admin]) {
      await actAs(who);
      expect((await getImpactStats()).stats.ngoPartners).toBe(2);
    }
    await actAs(w.admin);
    expect((await getAdminImpactStats()).stats.totalNGOs).toBe(4);
  });
});

describe('createNGOPartner', () => {
  it('lets staff create a company NGO', async () => {
    const w = await makeWorld();
    for (const who of [w.admin, w.employee]) {
      await actAs(who);
      const res = await createNGOPartner(partnerForm({ name: `By ${who.role}`, companyIds: idList(w.companyA, w.companyB) }));
      expect(res.success).toBe(true);
      expect(res.partner).toMatchObject({
        name: `By ${who.role}`, companyIds: [String(w.companyA._id), String(w.companyB._id)], companyNames: ['Acme', 'Beta'],
      });
      const stored = await NGOPartner.findById(res.partner._id).lean();
      expect(stored.companyIds.map(String)).toEqual([String(w.companyA._id), String(w.companyB._id)]);
      expect(stored.loginUserId).toBeNull();
    }
  });
  it('makes a public partner when no companies are sent, or an empty list', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    for (const companyIds of [undefined, '', '[]']) {
      const res = await createNGOPartner(partnerForm({ companyIds }));
      expect(res.success).toBe(true);
      expect(res.partner).toMatchObject({ companyIds: [], companyNames: [] });
      expect((await NGOPartner.findById(res.partner._id).lean()).companyIds).toEqual([]);
    }
  });
  it('stores a repeated company once', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await createNGOPartner(partnerForm({ companyIds: idList(w.companyA, w.companyA) }));
    expect(res.success).toBe(true);
    expect(res.partner.companyIds).toEqual([String(w.companyA._id)]);
  });
  it('still requires a name and description', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect(await createNGOPartner(form({ name: 'x' }))).toEqual({ success: false, message: 'Name and description are required' });
    expect(await NGOPartner.countDocuments()).toBe(0);
  });
  it('refuses spocs, members, volunteers and NGOs and creates nothing', async () => {
    const w = await makeWorld();
    const before = await dbState();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(await createNGOPartner(partnerForm({ companyIds: idList(w.companyA) }))).toEqual(STAFF_ONLY);
    }
    await actAs(null);
    expect(await createNGOPartner(partnerForm())).toEqual(NOT_AUTHENTICATED);
    expect(await dbState()).toEqual(before);
  });
  it('refuses invalid, unknown and archived company ids and creates nothing', async () => {
    const w = await makeWorld();
    const archived = await makeCompany('Old', { status: 'archived' });
    const unknown = new mongoose.Types.ObjectId();
    const A = String(w.companyA._id);
    const bad = [
      'not json', '{"a":1}', '"abc"', 'null', '42', 'true',
      JSON.stringify(['not-an-id']), JSON.stringify([123]), JSON.stringify([null]), JSON.stringify([{ $ne: null }]),
      JSON.stringify([[A]]), JSON.stringify(['abcdefghijkl']), JSON.stringify([`${A} `]),
      JSON.stringify([String(unknown)]),
      JSON.stringify([String(archived._id)]),
      JSON.stringify([A, String(archived._id)]),
      JSON.stringify([A, String(unknown)]),
      JSON.stringify([A, 'not-an-id']),
    ];
    await actAs(w.admin);
    for (const companyIds of bad) {
      expect(await createNGOPartner(partnerForm({ companyIds }))).toEqual(ACTIVE_ONLY);
    }
    expect(await NGOPartner.countDocuments()).toBe(0);
    // The same form with a good list is accepted, so only the companies can have caused the refusals.
    expect((await createNGOPartner(partnerForm({ companyIds: JSON.stringify([A]) }))).success).toBe(true);
  });
});

describe('updateNGOPartner', () => {
  it('lets staff change the name and companies and leaves the login link alone', async () => {
    const w = await makeWorld();
    const { card, user } = await makeLinkedPartner({ name: 'Old name', companyIds: [w.companyA._id] });
    for (const who of [w.admin, w.employee]) {
      await actAs(who);
      const res = await updateNGOPartner(String(card._id), partnerForm({ name: `New by ${who.role}`, companyIds: idList(w.companyB) }));
      expect(res.success).toBe(true);
      expect(res.partner).toMatchObject({ name: `New by ${who.role}`, companyIds: [String(w.companyB._id)], companyNames: ['Beta'], loginUsername: user.username });
      const stored = await NGOPartner.findById(card._id).lean();
      expect(stored.name).toBe(`New by ${who.role}`);
      expect(stored.companyIds.map(String)).toEqual([String(w.companyB._id)]);
      expect(String(stored.loginUserId)).toBe(String(user._id));
    }
  });
  it('makes a company NGO public with an empty list', async () => {
    const w = await makeWorld();
    const card = await makePartner({ companyIds: [w.companyA._id] });
    await actAs(w.admin);
    expect((await updateNGOPartner(String(card._id), partnerForm({ companyIds: '[]' }))).success).toBe(true);
    expect((await NGOPartner.findById(card._id).lean()).companyIds).toEqual([]);
  });
  it('leaves the companies unchanged when the companyIds field is absent', async () => {
    const w = await makeWorld();
    const company = await makePartner({ name: 'Company card', companyIds: [w.companyA._id] });
    const publicCard = await makePartner({ name: 'Public card' });
    await actAs(w.admin);
    const res = await updateNGOPartner(String(company._id), partnerForm({ name: 'Renamed' }));
    expect(res).toMatchObject({
      success: true,
      partner: { name: 'Renamed', companyIds: [String(w.companyA._id)], companyNames: ['Acme'] },
    });
    const stored = await NGOPartner.findById(company._id).lean();
    expect(stored.name).toBe('Renamed');
    expect(stored.companyIds.map(String)).toEqual([String(w.companyA._id)]);
    expect((await updateNGOPartner(String(publicCard._id), partnerForm({ name: 'Still public' }))).success).toBe(true);
    expect((await NGOPartner.findById(publicCard._id).lean()).companyIds).toEqual([]);
  });
  it('does not make a card public when companyIds is sent empty or blank', async () => {
    const w = await makeWorld();
    const card = await makePartner({ companyIds: [w.companyA._id] });
    await actAs(w.admin);
    for (const blank of ['', ' ', '   ', '\n\t ']) {
      const res = await updateNGOPartner(String(card._id), partnerForm({ name: `Blank ${JSON.stringify(blank)}`, companyIds: blank }));
      expect(res).toMatchObject({ success: true, partner: { companyIds: [String(w.companyA._id)] } });
      const stored = await NGOPartner.findById(card._id).lean();
      expect(stored.name).toBe(`Blank ${JSON.stringify(blank)}`);
      expect(stored.companyIds.map(String)).toEqual([String(w.companyA._id)]);
    }
    // Only a real list changes the companies; "[]" is a real list, and malformed text is refused.
    expect(await updateNGOPartner(String(card._id), partnerForm({ companyIds: '[ ]' }))).toMatchObject({ success: true, partner: { companyIds: [] } });
    await NGOPartner.updateOne({ _id: card._id }, { companyIds: [w.companyA._id] });
    expect(await updateNGOPartner(String(card._id), partnerForm({ companyIds: '[' }))).toEqual(ACTIVE_ONLY);
    expect((await NGOPartner.findById(card._id).lean()).companyIds.map(String)).toEqual([String(w.companyA._id)]);
  });
  it('lets an archived company stay on a card but never be added to one', async () => {
    const w = await makeWorld();
    const old = await makeCompany('Old', { status: 'archived' });
    const other = await makeCompany('Other', { status: 'archived' });
    const card = await makePartner({ companyIds: [w.companyA._id, old._id] });
    await makePartner({ name: 'Elsewhere', companyIds: [other._id] }); // archived there, but not on this card
    const A = String(w.companyA._id);
    const O = String(old._id);
    const stored = async () => (await NGOPartner.findById(card._id).lean()).companyIds.map(String);
    await actAs(w.admin);

    // New archived companies are refused, even next to the kept one, and nothing changes.
    const before = await dbState();
    for (const companyIds of [JSON.stringify([A, O, String(other._id)]), JSON.stringify([String(other._id)])]) {
      expect(await updateNGOPartner(String(card._id), partnerForm({ name: 'Changed', companyIds }))).toEqual(ACTIVE_ONLY);
    }
    expect(await dbState()).toEqual(before);

    // The same list is accepted: the archived company stays and still shows its name.
    const same = await updateNGOPartner(String(card._id), partnerForm({ name: 'Edited', companyIds: JSON.stringify([A, O]) }));
    expect(same).toMatchObject({ success: true, partner: { name: 'Edited', companyIds: [A, O], companyNames: ['Acme', 'Old'] } });
    // Dropping the active company while the archived one stays is accepted too.
    expect((await updateNGOPartner(String(card._id), partnerForm({ companyIds: JSON.stringify([O]) }))).success).toBe(true);
    expect(await stored()).toEqual([O]);

    // Once removed it is just an archived company again: it cannot be put back.
    expect((await updateNGOPartner(String(card._id), partnerForm({ companyIds: JSON.stringify([A]) }))).success).toBe(true);
    expect(await updateNGOPartner(String(card._id), partnerForm({ companyIds: JSON.stringify([A, O]) }))).toEqual(ACTIVE_ONLY);
    expect(await stored()).toEqual([A]);
  });
  it('refuses spocs, members, volunteers and NGOs and changes nothing', async () => {
    const w = await makeWorld();
    const card = await makePartner({ companyIds: [w.companyA._id] });
    const before = await dbState();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(await updateNGOPartner(String(card._id), partnerForm({ name: 'Hijacked', companyIds: '[]' }))).toEqual(STAFF_ONLY);
    }
    await actAs(null);
    expect(await updateNGOPartner(String(card._id), partnerForm({ name: 'Hijacked' }))).toEqual(NOT_AUTHENTICATED);
    expect(await dbState()).toEqual(before);
  });
  it('refuses a malformed or unknown partner id and changes nothing', async () => {
    const w = await makeWorld();
    await makePartner({ companyIds: [w.companyA._id] });
    const before = await dbState();
    await actAs(w.admin);
    for (const bad of ['not-an-id', '', undefined, null, 123, { $ne: null }, ['64b7f0f0f0f0f0f0f0f0f0f0'], 'abcdefghijkl', String(new mongoose.Types.ObjectId())]) {
      expect(await updateNGOPartner(bad, partnerForm({ name: 'Changed', companyIds: '[]' }))).toEqual(NOT_FOUND);
    }
    expect(await dbState()).toEqual(before);
  });
  it('refuses invalid, unknown and archived company ids and changes nothing', async () => {
    const w = await makeWorld();
    const card = await makePartner({ companyIds: [w.companyA._id] });
    const archived = await makeCompany('Old', { status: 'archived' });
    const A = String(w.companyA._id);
    const before = await dbState();
    await actAs(w.admin);
    for (const companyIds of [
      'not json', '{"a":1}', JSON.stringify(['not-an-id']), JSON.stringify([{ $ne: null }]),
      JSON.stringify([String(new mongoose.Types.ObjectId())]),
      JSON.stringify([String(archived._id)]),
      JSON.stringify([A, String(archived._id)]),
    ]) {
      expect(await updateNGOPartner(String(card._id), partnerForm({ name: 'Changed', companyIds }))).toEqual(ACTIVE_ONLY);
    }
    expect(await dbState()).toEqual(before);
    // A good list on the same card is accepted, so only the companies caused the refusals.
    expect((await updateNGOPartner(String(card._id), partnerForm({ name: 'Changed', companyIds: JSON.stringify([A]) }))).success).toBe(true);
  });
});

const sheetRow = (i, extra = {}) => ({
  name: `NGO ${i}`, description: `About ${i}`, focusAreas: 'Trees', programs: 'a', impact: '', registeredOffice: '', location: 'Goa', website: '', ...extra,
});

describe('importNGOPartners', () => {
  it('creates the valid rows for the chosen companies and reports the bad ones', async () => {
    const w = await makeWorld();
    await actAs(w.employee);
    const rows = [
      sheetRow(1),
      sheetRow(2, { description: '' }),
      sheetRow(3, { name: '   ' }),
      sheetRow(4, { name: '', description: '' }),
      sheetRow(5, { name: '  Padded  ', description: '  Padded desc  ', location: '  Pune ', website: ' https://p.org ' }),
      null,
      sheetRow(7),
    ];
    const res = await importNGOPartners(rows, idList(w.companyA, w.companyB));
    expect(res).toEqual({
      success: true,
      created: 3,
      skipped: [
        { row: 2, reason: 'Missing description' },
        { row: 3, reason: 'Missing name' },
        { row: 4, reason: 'Missing name and description' },
        { row: 6, reason: 'Not a valid row' },
      ],
    });
    const stored = await NGOPartner.find().sort({ name: 1 }).lean();
    expect(stored.map((p) => p.name)).toEqual(['NGO 1', 'NGO 7', 'Padded']);
    for (const p of stored) {
      expect(p.companyIds.map(String)).toEqual([String(w.companyA._id), String(w.companyB._id)]);
      expect(p.loginUserId).toBeNull();
    }
    const padded = stored.find((p) => p.name === 'Padded');
    expect(padded).toMatchObject({ description: 'Padded desc', location: 'Pune', website: 'https://p.org' });
  });
  it('reports success with nothing created when every row is skipped', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await importNGOPartners([sheetRow(1, { name: '' }), 'text'], '[]');
    expect(res).toEqual({
      success: true,
      created: 0,
      skipped: [{ row: 1, reason: 'Missing name' }, { row: 2, reason: 'Not a valid row' }],
    });
    expect(await NGOPartner.countDocuments()).toBe(0);
  });
  it('splits programs on new lines or semicolons and drops blanks', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await importNGOPartners([
      sheetRow(1, { programs: 'Tree drive; Beach clean\nFood bank;;  \r\n Library ' }),
      sheetRow(2, { programs: '' }),
      sheetRow(3, { programs: undefined }),
    ], '[]');
    expect(res).toMatchObject({ success: true, created: 3, skipped: [] });
    const byName = Object.fromEntries((await NGOPartner.find().lean()).map((p) => [p.name, p]));
    expect(byName['NGO 1'].programs).toEqual(['Tree drive', 'Beach clean', 'Food bank', 'Library']);
    expect(byName['NGO 2'].programs).toEqual([]);
    expect(byName['NGO 3'].programs).toEqual([]);
  });
  it('makes public partners when no companies are sent and reads numeric cells as text', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await importNGOPartners([sheetRow(1, { registeredOffice: 12345 })], undefined);
    expect(res).toMatchObject({ success: true, created: 1 });
    const [p] = await NGOPartner.find().lean();
    expect(p.companyIds).toEqual([]);
    expect(p.registeredOffice).toBe('12345');
  });
  it('refuses spocs, members, volunteers and NGOs and creates nothing', async () => {
    const w = await makeWorld();
    const before = await dbState();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(await importNGOPartners([sheetRow(1)], idList(w.companyA))).toEqual(STAFF_ONLY);
    }
    await actAs(null);
    expect(await importNGOPartners([sheetRow(1)], '[]')).toEqual(NOT_AUTHENTICATED);
    expect(await dbState()).toEqual(before);
  });
  it('accepts 1 to 500 rows and refuses anything else', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const refusal = { success: false, message: 'Import between 1 and 500 rows at a time' };
    for (const bad of [[], null, undefined, 'rows', 7, { length: 3, 0: sheetRow(1) }]) {
      expect(await importNGOPartners(bad, '[]')).toEqual(refusal);
    }
    const tooMany = Array.from({ length: 501 }, (_, i) => sheetRow(i));
    expect(await importNGOPartners(tooMany, '[]')).toEqual(refusal);
    expect(await NGOPartner.countDocuments()).toBe(0);
    const max = Array.from({ length: 500 }, (_, i) => sheetRow(i));
    expect(await importNGOPartners(max, '[]')).toMatchObject({ success: true, created: 500, skipped: [] });
    expect(await NGOPartner.countDocuments()).toBe(500);
  });
  it('refuses invalid, unknown and archived company ids and creates nothing', async () => {
    const w = await makeWorld();
    const archived = await makeCompany('Old', { status: 'archived' });
    const A = String(w.companyA._id);
    await actAs(w.admin);
    for (const companyIds of [
      'not json', '{"a":1}', JSON.stringify(['not-an-id']), JSON.stringify([{ $ne: null }]),
      JSON.stringify([String(new mongoose.Types.ObjectId())]),
      JSON.stringify([String(archived._id)]),
      JSON.stringify([A, String(archived._id)]),
      [A], // an array, not the JSON string the action reads
    ]) {
      expect(await importNGOPartners([sheetRow(1)], companyIds)).toEqual(ACTIVE_ONLY);
    }
    expect(await NGOPartner.countDocuments()).toBe(0);
    expect((await importNGOPartners([sheetRow(1)], JSON.stringify([A]))).created).toBe(1);
  });
  it('reports rows the database could not save without driver text', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const realInsertMany = NGOPartner.insertMany.bind(NGOPartner);
    vi.spyOn(console, 'error').mockImplementation(() => {}); // the action logs the driver error for operators
    vi.spyOn(NGOPartner, 'insertMany').mockImplementationOnce(async (docs, options) => {
      expect(options).toMatchObject({ ordered: false });
      await realInsertMany(docs.slice(0, 2), options); // the first two are saved, then the batch fails
      throw Object.assign(new Error('E11000 duplicate key error collection: kindera_test.ngopartners index: secret_1'), { code: 11000 });
    });
    const res = await importNGOPartners([sheetRow(1), sheetRow(2, { name: '' }), sheetRow(3), sheetRow(4), sheetRow(5)], '[]');
    expect(res.success).toBe(true);
    expect(res.created).toBe(2);
    expect(res.skipped).toEqual([
      { row: 2, reason: 'Missing name' },
      { row: 4, reason: 'Could not be saved' },
      { row: 5, reason: 'Could not be saved' },
    ]);
    expect(JSON.stringify(res)).not.toMatch(/E11000|kindera_test|secret|duplicate/i);
    expect((await NGOPartner.find().lean()).map((p) => p.name).sort()).toEqual(['NGO 1', 'NGO 3']);
  });
  it('fails with a generic message when nothing could be saved', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(NGOPartner, 'insertMany').mockRejectedValueOnce(new Error('connection to 10.0.0.5:27017 refused'));
    const res = await importNGOPartners([sheetRow(1)], '[]');
    expect(res).toMatchObject({ success: false, message: 'Could not import the NGOs. Please try again.', created: 0 });
    expect(JSON.stringify(res)).not.toMatch(/10\.0\.0\.5|refused/);
    expect(await NGOPartner.countDocuments()).toBe(0);
  });
});

describe('generateNGOLogin', () => {
  it('creates a linked NGO login and returns its username and password', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth', companyIds: [w.companyA._id] });
    await actAs(w.employee);
    const res = await generateNGOLogin(String(card._id));
    expect(res.success).toBe(true);
    expect(Object.keys(res).sort()).toEqual(['password', 'success', 'username']);
    expect(res.username).toMatch(/^green-earth-\d{4}$/);
    expect(res.password).toMatch(/^[A-Za-z0-9_-]{10}$/);

    const user = await User.findOne({ username: res.username });
    expect(user).toMatchObject({ role: 'ngo', status: 'approved', name: 'Green Earth', ngoName: 'Green Earth' });
    expect(user.ngoId).toMatch(/^NGO-[0-9A-F]{8}$/);
    expect(String(user.ngoPartnerId)).toBe(String(card._id));
    expect(user.password).not.toBe(res.password);
    expect(await user.comparePassword(res.password)).toBe(true);
    const stored = await NGOPartner.findById(card._id).lean();
    expect(String(stored.loginUserId)).toBe(String(user._id));
  });
  it('makes a password that works with login()', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    await actAs(w.admin);
    const { username, password } = await generateNGOLogin(String(card._id));
    await actAs(null);
    expect(await login(form({ username, password }))).toMatchObject({
      success: true, user: { role: 'ngo', username, name: 'Green Earth' },
    });
    expect(await login(form({ username, password: `${password}x` }))).toEqual({ success: false, message: 'Invalid username or password' });
  });
  it('shows staff the new login on the card', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    await actAs(w.admin);
    const { username } = await generateNGOLogin(String(card._id));
    expect((await getAllNGOPartners()).partners[0].loginUsername).toBe(username);
  });
  it('refuses a second login for the same card and keeps the first working', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    await actAs(w.admin);
    const first = await generateNGOLogin(String(card._id));
    const before = await dbState();
    expect(await generateNGOLogin(String(card._id))).toEqual({ success: false, message: 'This NGO already has a login' });
    expect(await dbState()).toEqual(before);
    const user = await User.findOne({ username: first.username });
    expect(await user.comparePassword(first.password)).toBe(true);
  });
  it('lets only one of several simultaneous requests create the login', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    await actAs(w.admin);
    const results = await Promise.all(Array.from({ length: 4 }, () => generateNGOLogin(String(card._id))));
    const wins = results.filter((r) => r.success);
    expect(wins).toHaveLength(1);
    for (const r of results.filter((x) => !x.success)) expect(r.message).toEqual(expect.any(String));
    // No leftover login from a request that lost the race.
    const logins = await User.find({ ngoPartnerId: card._id }).lean();
    expect(logins).toHaveLength(1);
    expect(logins[0].username).toBe(wins[0].username);
    expect(String((await NGOPartner.findById(card._id).lean()).loginUserId)).toBe(String(logins[0]._id));
  });
  it('refuses spocs, members, volunteers and NGOs and creates nothing', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth', companyIds: [w.companyA._id] });
    const before = await dbState();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(await generateNGOLogin(String(card._id))).toEqual(STAFF_ONLY);
    }
    await actAs(null);
    expect(await generateNGOLogin(String(card._id))).toEqual(NOT_AUTHENTICATED);
    expect(await dbState()).toEqual(before);
  });
  it('refuses a malformed or unknown card id and creates nothing', async () => {
    const w = await makeWorld();
    await makePartner({ name: 'Green Earth' });
    const before = await dbState();
    await actAs(w.admin);
    for (const bad of ['not-an-id', '', undefined, null, 123, { $ne: null }, ['64b7f0f0f0f0f0f0f0f0f0f0'], 'abcdefghijkl', String(new mongoose.Types.ObjectId())]) {
      expect(await generateNGOLogin(bad)).toEqual(NOT_FOUND);
    }
    expect(await dbState()).toEqual(before);
  });
  it('builds the username from at most 20 characters of the name, with a fallback', async () => {
    const w = await makeWorld();
    const long = await makePartner({ name: 'The Very Long Named Foundation For Everything' });
    const odd = await makePartner({ name: '  ಸೇವಾ ಸಂಸ್ಥೆ !! ' });
    await actAs(w.admin);
    const a = await generateNGOLogin(String(long._id));
    const b = await generateNGOLogin(String(odd._id));
    // The name part is cut at 20 characters ("the-very-long-named-") and the dangling hyphen dropped.
    expect(a.username).toMatch(/^the-very-long-named-\d{4}$/);
    expect(b.username).toMatch(/^ngo-\d{4}$/);
  });
  it('tries another username when the first is taken', async () => {
    const w = await makeWorld();
    await makeUser('ngo', { username: 'green-earth-1234' });
    const card = await makePartner({ name: 'Green Earth' });
    const realRandomInt = crypto.randomInt.bind(crypto);
    const queue = [1234, 1234, 5678];
    vi.spyOn(crypto, 'randomInt').mockImplementation((...args) =>
      (args[0] === 0 && args[1] === 10000 && queue.length ? queue.shift() : realRandomInt(...args)));
    await actAs(w.admin);
    const res = await generateNGOLogin(String(card._id));
    expect(res).toMatchObject({ success: true, username: 'green-earth-5678' });
    expect(queue).toEqual([]); // both taken suffixes were drawn and skipped
  });
  it('tries another username when it is taken between the check and the save', async () => {
    const w = await makeWorld();
    await makeUser('ngo', { username: 'green-earth-1234' });
    const card = await makePartner({ name: 'Green Earth' });
    vi.spyOn(User, 'exists').mockResolvedValue(null); // the pre-check misses it; the unique index catches it
    const realRandomInt = crypto.randomInt.bind(crypto);
    const queue = [1234, 5678];
    vi.spyOn(crypto, 'randomInt').mockImplementation((...args) =>
      (args[0] === 0 && args[1] === 10000 && queue.length ? queue.shift() : realRandomInt(...args)));
    await actAs(w.admin);
    const res = await generateNGOLogin(String(card._id));
    expect(res).toMatchObject({ success: true, username: 'green-earth-5678' });
    expect(queue).toEqual([]);
    expect(await User.countDocuments({ ngoPartnerId: card._id })).toBe(1);
  });
  it('removes the login it created when linking the card fails', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let loginsWhenLinkFailed = null;
    const link = vi.spyOn(NGOPartner, 'updateOne').mockImplementationOnce(async () => {
      loginsWhenLinkFailed = await User.countDocuments({ ngoPartnerId: card._id });
      throw new Error('connection to 10.0.0.5:27017 lost');
    });
    await actAs(w.admin);
    const usersBefore = await User.countDocuments();
    const res = await generateNGOLogin(String(card._id));
    expect(res).toEqual({ success: false, message: 'Could not generate a login. Please try again.' });
    expect(link).toHaveBeenCalledTimes(1);
    expect(loginsWhenLinkFailed).toBe(1); // the login existed when linking failed, so it was removed afterwards
    expect(await User.countDocuments()).toBe(usersBefore);
    expect(await User.countDocuments({ ngoPartnerId: card._id })).toBe(0);
    expect((await NGOPartner.findById(card._id).lean()).loginUserId).toBeNull();
    // The card can still get a login.
    expect((await generateNGOLogin(String(card._id))).success).toBe(true);
  });
  it('gives up after 5 taken usernames without creating anything', async () => {
    const w = await makeWorld();
    await makeUser('ngo', { username: 'green-earth-1234' });
    const card = await makePartner({ name: 'Green Earth' });
    const realRandomInt = crypto.randomInt.bind(crypto);
    const spy = vi.spyOn(crypto, 'randomInt').mockImplementation((...args) =>
      (args[0] === 0 && args[1] === 10000 ? 1234 : realRandomInt(...args)));
    await actAs(w.admin);
    const before = await dbState();
    const res = await generateNGOLogin(String(card._id));
    expect(res).toEqual({ success: false, message: 'Could not generate a login. Please try again.' });
    expect(spy.mock.calls.filter((c) => c[1] === 10000)).toHaveLength(5);
    expect(await dbState()).toEqual(before);
  });
  it('gives each card its own password and ngoId', async () => {
    const w = await makeWorld();
    const cards = [await makePartner({ name: 'Same Name' }), await makePartner({ name: 'Same Name' }), await makePartner({ name: 'Same Name' })];
    await actAs(w.admin);
    const results = [];
    for (const c of cards) results.push(await generateNGOLogin(String(c._id)));
    expect(new Set(results.map((r) => r.password)).size).toBe(3);
    expect(new Set(results.map((r) => r.username)).size).toBe(3);
    const ids = (await User.find({ username: { $in: results.map((r) => r.username) } }).lean()).map((u) => u.ngoId);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('deleteNGOPartner', () => {
  it('deletes the card and rejects its login', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth', companyIds: [w.companyA._id] });
    await actAs(w.admin);
    const { username, password } = await generateNGOLogin(String(card._id));
    const other = await makeLinkedPartner({ name: 'Other' });
    await actAs(w.employee);
    expect(await deleteNGOPartner(String(card._id))).toEqual({ success: true });
    expect(await NGOPartner.findById(card._id)).toBeNull();
    const gone = await User.findOne({ username }).lean();
    // It keeps pointing at the deleted card, so it may create nothing (a login with no card could create public events).
    expect(gone).toMatchObject({ status: 'rejected', ngoPartnerId: card._id, role: 'ngo' });
    expect(ngoEventCompanies(gone, await NGOPartner.findById(card._id))).toEqual([]);
    // The rejected login can no longer sign in.
    await actAs(null);
    expect((await login(form({ username, password }))).success).toBe(false);
    // Another card and its login are untouched.
    expect(await NGOPartner.findById(other.card._id)).not.toBeNull();
    expect(await User.findById(other.user._id).lean()).toMatchObject({ status: 'approved', ngoPartnerId: other.card._id });
  });
  it('rejects every NGO login pointing at the card, but never a non-NGO account', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    const stray = await makeUser('ngo', { ngoPartnerId: card._id }); // points at the card but is not the linked login
    await NGOPartner.updateOne({ _id: card._id }, { loginUserId: w.volunteer._id }); // corrupted link to a non-NGO
    await actAs(w.admin);
    expect((await deleteNGOPartner(String(card._id))).success).toBe(true);
    expect(await User.findById(stray._id).lean()).toMatchObject({ status: 'rejected', ngoPartnerId: card._id });
    expect(await User.findById(w.volunteer._id).lean()).toMatchObject({ status: 'approved', role: 'volunteer' });
  });
  it('deletes a card that has no login without touching any user', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Plain' });
    const before = (await dbState()).users;
    await actAs(w.admin);
    expect(await deleteNGOPartner(String(card._id))).toEqual({ success: true });
    expect(await NGOPartner.countDocuments()).toBe(0);
    expect((await dbState()).users).toEqual(before);
  });
  it('refuses spocs, members, volunteers and NGOs and changes nothing', async () => {
    const w = await makeWorld();
    const { card } = await makeLinkedPartner({ companyIds: [w.companyA._id] });
    const before = await dbState();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(await deleteNGOPartner(String(card._id))).toEqual(STAFF_ONLY);
    }
    await actAs(null);
    expect(await deleteNGOPartner(String(card._id))).toEqual(NOT_AUTHENTICATED);
    expect(await dbState()).toEqual(before);
  });
  it('refuses a malformed or unknown card id and changes nothing', async () => {
    const w = await makeWorld();
    await makeLinkedPartner();
    const before = await dbState();
    await actAs(w.admin);
    for (const bad of ['not-an-id', '', undefined, null, 123, { $ne: null }, ['64b7f0f0f0f0f0f0f0f0f0f0'], 'abcdefghijkl', String(new mongoose.Types.ObjectId())]) {
      expect(await deleteNGOPartner(bad)).toEqual(NOT_FOUND);
    }
    expect(await dbState()).toEqual(before);
  });
});

describe('deleteUser for an NGO login', () => {
  const userForm = (user) => form({ userId: String(user._id) });

  it('frees the card so a new login can be generated', async () => {
    const w = await makeWorld();
    const card = await makePartner({ name: 'Green Earth' });
    const other = await makeLinkedPartner({ name: 'Other' });
    await actAs(w.admin);
    const first = await generateNGOLogin(String(card._id));
    const firstUser = await User.findOne({ username: first.username });
    expect(await deleteUser(userForm(firstUser))).toMatchObject({ success: true });
    expect(await User.findById(firstUser._id)).toBeNull();
    expect((await NGOPartner.findById(card._id).lean()).loginUserId).toBeNull();
    // Another card keeps its login.
    expect(String((await NGOPartner.findById(other.card._id).lean()).loginUserId)).toBe(String(other.user._id));

    const second = await generateNGOLogin(String(card._id));
    expect(second.success).toBe(true);
    const logins = await User.find({ ngoPartnerId: card._id }).lean();
    expect(logins).toHaveLength(1);
    expect(logins[0].username).toBe(second.username);
    expect(String((await NGOPartner.findById(card._id).lean()).loginUserId)).toBe(String(logins[0]._id));
  });
  it('clears every card whose loginUserId is the deleted user, even if the user does not point back', async () => {
    const w = await makeWorld();
    const unlinkedNgo = await makeUser('ngo'); // no ngoPartnerId
    const card = await makePartner({ name: 'Points at it' });
    const bystander = await makeLinkedPartner({ name: 'Bystander' });
    await NGOPartner.updateOne({ _id: card._id }, { loginUserId: unlinkedNgo._id });
    await actAs(w.admin);
    expect((await deleteUser(userForm(unlinkedNgo))).success).toBe(true);
    expect((await NGOPartner.findById(card._id).lean()).loginUserId).toBeNull();
    expect(String((await NGOPartner.findById(bystander.card._id).lean()).loginUserId)).toBe(String(bystander.user._id));
  });
  it('leaves every card alone when the deleted user has no card', async () => {
    const w = await makeWorld();
    await makeLinkedPartner({ name: 'Linked' });
    await makePartner({ name: 'Plain', companyIds: [w.companyA._id] });
    const before = (await dbState()).partners;
    await actAs(w.admin);
    expect((await deleteUser(userForm(w.volunteer))).success).toBe(true);
    expect(await User.findById(w.volunteer._id)).toBeNull();
    expect((await dbState()).partners).toEqual(before);
  });
  it('is still admin only, and a refused call keeps the card linked', async () => {
    const w = await makeWorld();
    const { card, user } = await makeLinkedPartner({ name: 'Linked' });
    const before = await dbState();
    for (const who of [w.employee, w.spocA, w.volunteer]) {
      await actAs(who);
      expect(await deleteUser(userForm(user))).toEqual({ success: false, message: 'Only admin can delete users' });
    }
    expect(await dbState()).toEqual(before);
    expect(String((await NGOPartner.findById(card._id).lean()).loginUserId)).toBe(String(user._id));
  });
});

describe('registerUser for an NGO', () => {
  it('stores the NGO name when an admin or employee registers an NGO login', async () => {
    const w = await makeWorld();
    let n = 0;
    for (const who of [w.admin, w.employee]) {
      await actAs(who);
      n += 1;
      const res = await registerUser(form({ username: `new-ngo-${n}`, password: 'secret123', role: 'ngo', ngoId: `NGO-NEW${n}`, name: `Helping Hands ${n}` }));
      expect(res.success).toBe(true);
      const user = await User.findById(res.userId).lean();
      expect(user).toMatchObject({ role: 'ngo', name: `Helping Hands ${n}`, ngoName: `Helping Hands ${n}`, ngoId: `NGO-NEW${n}` });
    }
  });
});
