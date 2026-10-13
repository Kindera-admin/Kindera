import { describe, it, expect } from 'vitest';
import NGOPartner from '@/models/NGOPartner';
import User from '@/models/User';
import Event from '@/models/Event';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makePartner, makeUser } from '../helpers/factories.js';
import { createEvent, getEvents, deleteNGOPartner } from '@/app/actions';

const CHOOSE = { success: false, message: 'Choose which company this event is for' };
const INACTIVE = { success: false, message: 'Your NGO account is no longer active' };

const eventForm = (extra = {}) => {
  const fd = new FormData();
  const fields = {
    title: 'Beach clean-up',
    description: 'Bring gloves',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    location: 'Juhu',
    durationHours: '2',
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.append(k, v);
  return fd;
};

async function linkedNgo(companyIds) {
  const card = await makePartner({ name: 'Green Earth', companyIds });
  const user = await makeUser('ngo', { ngoPartnerId: card._id, ngoName: card.name });
  await NGOPartner.updateOne({ _id: card._id }, { loginUserId: user._id });
  return { card, user };
}

const titlesFor = async (who) => {
  await actAs(who);
  return (await getEvents()).events.map((e) => e.title);
};

describe('NGO events for a company', () => {
  it('stamps the chosen company, visible only to that company', async () => {
    const w = await makeWorld();
    const { user } = await linkedNgo([w.companyA._id, w.companyB._id]);
    await actAs(user);
    const res = await createEvent(eventForm({ companyId: String(w.companyA._id) }));
    expect(res.success).toBe(true);
    const ev = await Event.findOne({ title: 'Beach clean-up' }).lean();
    expect(String(ev.companyId)).toBe(String(w.companyA._id));

    expect(await titlesFor(w.memberA)).toContain('Beach clean-up');
    expect(await titlesFor(w.spocA2)).toContain('Beach clean-up');
    expect(await titlesFor(w.memberB)).not.toContain('Beach clean-up');
    expect(await titlesFor(w.volunteer)).not.toContain('Beach clean-up');
    expect(await titlesFor(null)).not.toContain('Beach clean-up');
  });

  it('refuses a missing, foreign or malformed company and creates nothing', async () => {
    const w = await makeWorld();
    const { user } = await linkedNgo([w.companyA._id]);
    await actAs(user);
    for (const companyId of [undefined, '', String(w.companyB._id), 'not-an-id', '{"$ne":null}']) {
      expect(await createEvent(eventForm({ companyId }))).toEqual(CHOOSE);
    }
    expect(await Event.countDocuments()).toBe(0);
  });

  it('keeps unlinked NGOs and NGOs on a public card creating public events, ignoring any company sent', async () => {
    const w = await makeWorld();
    const { user: publicCardNgo } = await linkedNgo([]);
    for (const who of [w.ngo, publicCardNgo]) {
      await actAs(who);
      const res = await createEvent(eventForm({ title: `Open ${who._id}`, companyId: String(w.companyA._id) }));
      expect(res.success).toBe(true);
    }
    const events = await Event.find().lean();
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.companyId === null)).toBe(true);
  });

  it('refuses a login whose card was deleted, creating nothing', async () => {
    const w = await makeWorld();
    const { card, user } = await linkedNgo([w.companyA._id]);
    await actAs(w.admin);
    expect((await deleteNGOPartner(String(card._id))).success).toBe(true);

    // Even with a still-live cookie and the status check bypassed, the dangling card refuses.
    await User.updateOne({ _id: user._id }, { status: 'approved' });
    await actAs(user);
    expect(await createEvent(eventForm({ companyId: String(w.companyA._id) }))).toEqual(INACTIVE);
    expect(await createEvent(eventForm())).toEqual(INACTIVE);
    expect(await Event.countDocuments()).toBe(0);
  });

  it('refuses accounts that are not approved, whatever their role', async () => {
    const w = await makeWorld();
    const { user } = await linkedNgo([w.companyA._id]);
    for (const who of [user, w.ngo, w.spocA]) {
      await User.updateOne({ _id: who._id }, { status: 'rejected' });
      await actAs(who);
      expect(await createEvent(eventForm({ companyId: String(w.companyA._id) })))
        .toEqual({ success: false, message: 'Your account is not active' });
    }
    expect(await Event.countDocuments()).toBe(0);
  });
});
