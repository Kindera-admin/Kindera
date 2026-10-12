import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeUser } from '../helpers/factories.js';
import { getChatContacts } from '@/app/actions';

const ids = (res) => res.contacts.map((c) => c._id).sort();

describe('chat contacts', () => {
  it("let a SPOC message admins and every employee of their company, but not other companies", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await getChatContacts();
    expect(ids(res)).toEqual([String(w.admin._id), String(w.memberA._id)].sort());
    expect(res.contacts.find((c) => c._id === String(w.memberA._id)).companyName).toBe('Acme');
  });
  it("let an employee message every SPOC of their company", async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    expect(ids(await getChatContacts())).toEqual([String(w.spocA._id), String(w.spocA2._id)].sort());
  });
  it('label NGO contacts with their NGO name', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const ngo = (await getChatContacts()).contacts.find((c) => c._id === String(w.ngo._id));
    expect(ngo.ngoName).toBe('Green Earth');
  });

  it("give a SPOC of another company only that company's people", async () => {
    const w = await makeWorld();
    await actAs(w.spocB);
    const res = await getChatContacts();
    expect(ids(res)).toEqual([String(w.admin._id), String(w.memberB._id)].sort());
    const companyA = [w.spocA, w.spocA2, w.memberA].map((u) => String(u._id));
    expect(res.contacts.filter((c) => companyA.includes(c._id))).toEqual([]);
  });

  it('never show a member of company B any company A user', async () => {
    const w = await makeWorld();
    await actAs(w.memberB);
    const res = await getChatContacts();
    expect(ids(res)).toEqual([String(w.spocB._id)]);
    expect(res.contacts[0].companyName).toBe('Beta');
  });

  it('shape each contact as _id, name, role, companyName, ngoName, ngoId and unread only', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await getChatContacts();
    for (const c of res.contacts) {
      expect(Object.keys(c).sort()).toEqual(['_id', 'companyName', 'name', 'ngoId', 'ngoName', 'role', 'unread']);
    }
    const spoc = res.contacts.find((c) => c._id === String(w.spocB._id));
    expect(spoc.companyName).toBe('Beta');
    expect(spoc.ngoName).toBeNull();
    const ngo = res.contacts.find((c) => c._id === String(w.ngo._id));
    expect(ngo.companyName).toBeNull();
  });

  it('let admins message NGOs, SPOCs and employees only', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await getChatContacts();
    expect(ids(res)).toEqual(
      [w.ngo, w.spocA, w.spocA2, w.spocB, w.employee].map((u) => String(u._id)).sort()
    );
  });

  it('let NGOs and employees message admins only', async () => {
    const w = await makeWorld();
    for (const who of [w.ngo, w.employee]) {
      await actAs(who);
      expect(ids(await getChatContacts())).toEqual([String(w.admin._id)]);
    }
  });

  it('refuse volunteers and logged-out callers', async () => {
    const w = await makeWorld();
    await actAs(w.volunteer);
    expect(await getChatContacts()).toEqual({ success: false, message: 'Chat not available for your role' });
    await actAs(null);
    expect(await getChatContacts()).toEqual({ success: false, message: 'Not authenticated' });
  });

  it('fail closed for a SPOC or member with no company', async () => {
    const w = await makeWorld();
    // companyId is required on create, so strip it the way a legacy or half-migrated record would look.
    const strayMember = await makeUser('org_member', { companyId: w.companyA._id, spocId: w.spocA._id });
    const straySpoc = await makeUser('org_spoc', { companyId: w.companyA._id });
    await User.updateMany({ _id: { $in: [strayMember._id, straySpoc._id] } }, { $unset: { companyId: 1 } });
    await actAs(straySpoc);
    expect(ids(await getChatContacts())).toEqual([String(w.admin._id)]);
    await actAs(strayMember);
    expect(ids(await getChatContacts())).toEqual([]);
  });

  it('count unread messages per contact', async () => {
    const Message = (await import('@/models/Message')).default;
    const w = await makeWorld();
    await Message.create({ sender: w.memberA._id, receiver: w.spocA._id, content: 'hi', read: false });
    await actAs(w.spocA);
    const res = await getChatContacts();
    expect(res.contacts.find((c) => c._id === String(w.memberA._id)).unread).toBe(1);
  });
});
