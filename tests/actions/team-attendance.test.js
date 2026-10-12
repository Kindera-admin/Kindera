import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent, makeCompany } from '../helpers/factories.js';
import {
  generateTeamLogins, bulkCreateFromExcel, getOrgMembers, markAttendance, getEventAttendance, logMyHoursAndFeedback,
} from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

const usersIn = (company) => User.countDocuments({ companyId: company._id });
const UNKNOWN_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const MALFORMED = ['not-an-id', '{"$ne":""}', '12'];
const noCastText = (res) => expect(String(res.message || '')).not.toMatch(/cast|objectid|validation/i);

describe('team logins', () => {
  it("put a SPOC's generated logins in the SPOC's company, ignoring any other company sent", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await generateTeamLogins(form({ count: '2', companyId: String(w.companyB._id) }));
    expect(res.success).toBe(true);
    const created = await User.find({ username: { $in: res.credentials.map((c) => c.username) } });
    expect(created).toHaveLength(2);
    expect(created.every((u) => String(u.companyId) === String(w.companyA._id))).toBe(true);
    expect(created.every((u) => String(u.spocId) === String(w.spocA2._id))).toBe(true);
  });
  it("never put a SPOC's logins into another company", async () => {
    const w = await makeWorld();
    const before = await usersIn(w.companyA);
    await actAs(w.spocB);
    const res = await generateTeamLogins(form({ count: '3', companyId: String(w.companyA._id) }));
    expect(res.success).toBe(true);
    expect(await usersIn(w.companyA)).toBe(before);
    expect(await usersIn(w.companyB)).toBe(2 + 3); // spocB, memberB + 3 new
  });
  it('make admins choose an active company', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect((await generateTeamLogins(form({ count: '1' }))).success).toBe(false);
    const res = await generateTeamLogins(form({ count: '1', companyId: String(w.companyB._id) }));
    expect(String((await User.findOne({ username: res.credentials[0].username })).companyId)).toBe(String(w.companyB._id));
  });
  it('refuse an admin naming an unknown, archived or malformed company, creating nothing', async () => {
    const w = await makeWorld();
    const archived = await makeCompany('Old Co', { status: 'archived' });
    const before = await User.countDocuments();
    await actAs(w.admin);
    for (const companyId of [UNKNOWN_ID, String(archived._id), ...MALFORMED]) {
      const res = await generateTeamLogins(form({ count: '1', companyId }));
      expect(res.success).toBe(false);
      expect(res.message).toBe('Choose a company and a count (1–500)');
      const bulk = await bulkCreateFromExcel([{ name: 'Ravi' }], companyId);
      expect(bulk.success).toBe(false);
      expect(bulk.message).toBe('Rows and a company are required');
    }
    expect(await User.countDocuments()).toBe(before);
  });
  it('refuse a SPOC whose company is archived', async () => {
    const w = await makeWorld();
    w.companyA.status = 'archived';
    await w.companyA.save();
    const before = await User.countDocuments();
    await actAs(w.spocA);
    expect((await generateTeamLogins(form({ count: '1' }))).success).toBe(false);
    expect((await bulkCreateFromExcel([{ name: 'Ravi' }], null)).success).toBe(false);
    expect(await User.countDocuments()).toBe(before);
  });
  it('refuse an out-of-range count', async () => {
    const w = await makeWorld();
    const before = await User.countDocuments();
    await actAs(w.spocA);
    for (const count of ['0', '501', 'abc', '']) {
      expect((await generateTeamLogins(form({ count }))).success).toBe(false);
    }
    expect(await User.countDocuments()).toBe(before);
  });
  it('create Excel rows in the right company', async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    const res = await bulkCreateFromExcel([{ name: 'Ravi' }], String(w.companyB._id));
    const created = await User.findOne({ username: res.credentials[0].username });
    expect(String(created.companyId)).toBe(String(w.companyA._id));
    expect(String(created.spocId)).toBe(String(w.spocA._id));
  });
  it("never put a SPOC's Excel rows into another company", async () => {
    const w = await makeWorld();
    const before = await usersIn(w.companyA);
    await actAs(w.spocB);
    const res = await bulkCreateFromExcel([{ name: 'Ravi' }, { name: 'Meena' }], String(w.companyA._id));
    expect(res.success).toBe(true);
    expect(await usersIn(w.companyA)).toBe(before);
  });
  it('record no SPOC when an admin creates the accounts, whatever the client claims', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await bulkCreateFromExcel([{ name: 'Ravi' }], String(w.companyA._id), String(w.spocB._id));
    expect(res.success).toBe(true);
    expect((await User.findOne({ username: res.credentials[0].username })).spocId).toBeNull();
  });
  it('refuse empty or non-array rows', async () => {
    const w = await makeWorld();
    const before = await User.countDocuments();
    await actAs(w.admin);
    for (const rows of [[], null, 'abc', { length: 2 }]) {
      expect((await bulkCreateFromExcel(rows, String(w.companyA._id))).success).toBe(false);
    }
    expect(await User.countDocuments()).toBe(before);
  });
  it('refuse employees, volunteers, NGOs, staff employees and signed-out callers', async () => {
    const w = await makeWorld();
    const before = await User.countDocuments();
    for (const who of [w.memberA, w.volunteer, w.ngo, w.employee, null]) {
      await actAs(who);
      expect((await generateTeamLogins(form({ count: '1', companyId: String(w.companyA._id) }))).success).toBe(false);
      expect((await bulkCreateFromExcel([{ name: 'Ravi' }], String(w.companyA._id))).success).toBe(false);
    }
    expect(await User.countDocuments()).toBe(before);
  });
});

describe('getOrgMembers', () => {
  it('list every employee of the company to every SPOC', async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await getOrgMembers(String(w.companyA._id));
    expect(res.members.map((m) => m._id)).toEqual([String(w.memberA._id)]);
  });
  it("refuse another company's list", async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    const res = await getOrgMembers(String(w.companyB._id));
    expect(res).toEqual({ success: false, message: 'Not authorized for this company' });
  });
  it("show a SPOC their own company's list when they name none, and never another company's", async () => {
    const w = await makeWorld();
    await actAs(w.spocB);
    const res = await getOrgMembers(null);
    expect(res.members.map((m) => m._id)).toEqual([String(w.memberB._id)]);
  });
  it('let admins read any company and show nothing without one', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect((await getOrgMembers(String(w.companyB._id))).members.map((m) => m._id)).toEqual([String(w.memberB._id)]);
    expect((await getOrgMembers(null)).members).toEqual([]);
    expect((await getOrgMembers(UNKNOWN_ID)).members).toEqual([]);
  });
  it('refuse employees, volunteers and signed-out callers', async () => {
    const w = await makeWorld();
    for (const who of [w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect((await getOrgMembers(String(w.companyA._id))).success).toBe(false);
    }
  });
  it('answer malformed ids with a safe message', async () => {
    const w = await makeWorld();
    for (const who of [w.admin, w.spocA]) {
      await actAs(who);
      for (const id of MALFORMED) {
        const res = await getOrgMembers(id);
        expect(res.success).toBe(false);
        noCastText(res);
      }
    }
  });
});

describe('attendance', () => {
  it("let any SPOC of the company mark its employees and record the employee's company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 3 }]);
    expect(res.success).toBe(true);
    const att = await Attendance.findOne({ eventId: ev._id, userId: w.memberA._id });
    expect(String(att.companyId)).toBe(String(w.companyA._id));
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(3);
  });
  it("let a SPOC mark their employees on a public event and an admin mark anyone's", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocA);
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 2 }])).success).toBe(true);
    await actAs(w.admin);
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberB._id), attended: true, hoursContributed: 1 }])).success).toBe(true);
    expect(String((await Attendance.findOne({ userId: w.memberB._id })).companyId)).toBe(String(w.companyB._id));
  });
  it("refuse a SPOC marking another company's employees", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocB);
    const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 3 }]);
    expect(res).toEqual({ success: false, message: 'You can only mark attendance for your own company' });
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it('refuse the whole batch when any one person is outside the SPOC company', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocA);
    const res = await markAttendance(String(ev._id), [
      { userId: String(w.memberA._id), attended: true, hoursContributed: 2 },
      { userId: String(w.memberB._id), attended: true, hoursContributed: 2 },
      { userId: String(w.volunteer._id), attended: true, hoursContributed: 2 },
    ]);
    expect(res).toEqual({ success: false, message: 'You can only mark attendance for your own company' });
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it("refuse a SPOC marking attendance on another company's internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocB, { companyId: w.companyB._id });
    await actAs(w.spocA);
    const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 1 }]);
    expect(res).toEqual({ success: false, message: 'Event not found' }); // same answer as a missing event
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it('refuse everyone who is not an admin or SPOC, leaving records and hours untouched', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    for (const who of [w.memberA, w.memberB, w.volunteer, w.ngo, w.employee, null]) {
      await actAs(who);
      const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 5 }]);
      expect(res.success).toBe(false);
    }
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it('refuse unknown people, unknown events and malformed ids, changing nothing', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    const entry = (userId) => [{ userId, attended: true, hoursContributed: 4 }];
    for (const who of [w.admin, w.spocA]) {
      await actAs(who);
      const cases = [
        [String(ev._id), entry(UNKNOWN_ID)],
        [UNKNOWN_ID, entry(String(w.memberA._id))],
        ...MALFORMED.map((id) => [id, entry(String(w.memberA._id))]),
        ...MALFORMED.map((id) => [String(ev._id), entry(id)]),
        [String(ev._id), 'not-a-list'],
        [String(ev._id), [null]],
      ];
      for (const [eventId, list] of cases) {
        const res = await markAttendance(eventId, list);
        expect(res.success).toBe(false);
        noCastText(res);
      }
    }
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it("pin a SPOC's attendance view to their own company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true });
    await Attendance.create({ eventId: ev._id, userId: w.memberB._id, companyId: w.companyB._id, attended: true });
    await actAs(w.spocA);
    const res = await getEventAttendance(String(ev._id), null);
    expect(res.records.map((r) => r.userId)).toEqual([String(w.memberA._id)]);
    expect((await getEventAttendance(String(ev._id), String(w.companyB._id))).success).toBe(false);
  });
  it('show admins every company, or one when asked', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true });
    await Attendance.create({ eventId: ev._id, userId: w.memberB._id, companyId: w.companyB._id, attended: true });
    await actAs(w.admin);
    expect((await getEventAttendance(String(ev._id), null)).records).toHaveLength(2);
    expect((await getEventAttendance(String(ev._id), String(w.companyB._id))).records.map((r) => r.userId)).toEqual([String(w.memberB._id)]);
  });
  it("refuse another company's SPOC the attendance of an internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true, hoursContributed: 2 });
    await actAs(w.spocB);
    for (const companyId of [null, String(w.companyA._id), String(w.companyB._id)]) {
      const res = await getEventAttendance(String(ev._id), companyId);
      expect(res.success).toBe(false);
      expect(res.records).toBeUndefined();
    }
  });
  it('refuse attendance reads to employees, volunteers and signed-out callers, and malformed ids to everyone', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true });
    for (const who of [w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect((await getEventAttendance(String(ev._id), null)).success).toBe(false);
    }
    for (const who of [w.admin, w.spocA]) {
      await actAs(who);
      for (const id of MALFORMED) {
        const a = await getEventAttendance(id, null);
        const b = await getEventAttendance(String(ev._id), id);
        for (const res of [a, b]) {
          expect(res.success).toBe(false);
          noCastText(res);
        }
      }
    }
  });
  it("record the employee's company when they log their own hours", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin, { date: new Date(Date.now() - 86400000) });
    await actAs(w.memberA);
    expect((await logMyHoursAndFeedback(String(ev._id), 2, 5)).success).toBe(true);
    expect(String((await Attendance.findOne({ userId: w.memberA._id })).companyId)).toBe(String(w.companyA._id));
  });
  it("refuse an employee logging hours on another company's internal event, or with a malformed id", async () => {
    const w = await makeWorld();
    const past = new Date(Date.now() - 86400000);
    const ev = await makeEvent(w.spocB, { companyId: w.companyB._id, date: past });
    await actAs(w.memberA);
    expect((await logMyHoursAndFeedback(String(ev._id), 2, 5)).success).toBe(false);
    for (const id of MALFORMED) {
      const res = await logMyHoursAndFeedback(id, 2, 5);
      expect(res.success).toBe(false);
      noCastText(res);
    }
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
});
