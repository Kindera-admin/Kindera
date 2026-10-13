import { describe, it, expect, vi } from 'vitest';
import User from '@/models/User';
import Message from '@/models/Message';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeUser } from '../helpers/factories.js';
import { sendMessage, getMessages } from '@/app/actions';

const msg = (receiverId, content = 'hello') => {
  const fd = new FormData();
  fd.append('receiverId', String(receiverId));
  fd.append('content', content);
  return fd;
};
const REFUSED = { success: false, message: 'You cannot message this person' };

describe('sendMessage only reaches allowed contacts (B5)', () => {
  it('refuses a SPOC messaging another company\'s employee, and sends nothing', async () => {
    const w = await makeWorld();
    await actAs(w.spocB);
    expect(await sendMessage(msg(w.memberA._id))).toEqual(REFUSED);
    expect(await Message.countDocuments()).toBe(0);
  });
  it('refuses a volunteer messaging an admin (volunteers have no contacts)', async () => {
    const w = await makeWorld();
    await actAs(w.volunteer);
    const res = await sendMessage(msg(w.admin._id));
    expect(res.success).toBe(false);
    expect(await Message.countDocuments()).toBe(0);
  });
  it('refuses other pairs outside the contact rules', async () => {
    const w = await makeWorld();
    for (const [from, to] of [
      [w.memberA, w.spocB], [w.memberA, w.admin], [w.memberA, w.memberB],
      [w.ngo, w.spocA], [w.employee, w.memberA], [w.admin, w.volunteer], [w.admin, w.memberA],
    ]) {
      await actAs(from);
      expect(await sendMessage(msg(to._id))).toEqual(REFUSED);
    }
    expect(await Message.countDocuments()).toBe(0);
  });
  it('refuses an employee with no company messaging any SPOC', async () => {
    const w = await makeWorld();
    const stray = await makeUser('org_member', { companyId: w.companyA._id });
    await User.updateOne({ _id: stray._id }, { $unset: { companyId: 1 } });
    await actAs(stray);
    expect(await sendMessage(msg(w.spocA._id))).toEqual(REFUSED);
    expect(await Message.countDocuments()).toBe(0);
  });
  it('refuses malformed and unknown receivers with the same safe message', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    for (const bad of ['not-an-id', 'aaaaaaaaaaaaaaaaaaaaaaaa']) {
      expect(await sendMessage(msg(bad))).toEqual(REFUSED);
    }
    expect(await Message.countDocuments()).toBe(0);
  });
  it('delivers messages between allowed contacts', async () => {
    const w = await makeWorld();
    for (const [from, to] of [
      [w.memberA, w.spocA2], [w.spocA2, w.memberA], [w.spocB, w.admin], [w.admin, w.ngo], [w.ngo, w.admin], [w.employee, w.admin],
    ]) {
      await actAs(from);
      expect((await sendMessage(msg(to._id))).success).toBe(true);
    }
    expect(await Message.countDocuments()).toBe(6);
  });
  it('answers a database failure with a safe message', async () => {
    const w = await makeWorld();
    const spy = vi.spyOn(Message, 'create').mockRejectedValue(new Error('E11000 internal detail'));
    try {
      await actAs(w.admin);
      expect(await sendMessage(msg(w.ngo._id))).toEqual({ success: false, message: 'Could not send your message. Please try again.' });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('getMessages only opens threads with allowed contacts (R6)', () => {
  const CANNOT_VIEW = { success: false, message: 'You cannot view this conversation' };
  it('refuses spocB reading a thread with memberA, returning nothing and marking nothing read', async () => {
    const w = await makeWorld();
    // e.g. written while spocB was still in company A
    await Message.create({ sender: w.memberA._id, receiver: w.spocB._id, content: 'old thread' });
    await actAs(w.spocB);
    expect(await getMessages(String(w.memberA._id))).toEqual(CANNOT_VIEW);
    expect(await Message.countDocuments({ read: true })).toBe(0);
  });
  it('refuses malformed and unknown ids with the same answer and no cast text', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    for (const bad of ['not-an-id', '{"$ne":""}', 'aaaaaaaaaaaaaaaaaaaaaaaa', 12345, { $ne: null }, null]) {
      const res = await getMessages(bad);
      expect(res).toEqual(CANNOT_VIEW);
      expect(JSON.stringify(res)).not.toMatch(/cast|objectid|hex string|BSON/i);
    }
  });
  it('refuses roles without chat', async () => {
    const w = await makeWorld();
    await actAs(w.volunteer);
    expect(await getMessages(String(w.admin._id))).toEqual({ success: false, message: 'Chat not available for your role' });
  });
  it('still opens a thread with an allowed contact and marks it read', async () => {
    const w = await makeWorld();
    await Message.create({ sender: w.memberA._id, receiver: w.spocA._id, content: 'hi' });
    await actAs(w.spocA);
    const res = await getMessages(String(w.memberA._id));
    expect(res.success).toBe(true);
    expect(res.messages.map((m) => m.content)).toEqual(['hi']);
    expect(await Message.countDocuments({ read: true })).toBe(1);
  });
  it('answers a database failure with a safe message', async () => {
    const w = await makeWorld();
    const spy = vi.spyOn(Message, 'find').mockImplementation(() => { throw new Error('E11000 internal detail'); });
    try {
      await actAs(w.admin);
      expect(await getMessages(String(w.ngo._id))).toEqual({ success: false, message: 'Could not load messages. Please try again.' });
    } finally {
      spy.mockRestore();
    }
  });
});
