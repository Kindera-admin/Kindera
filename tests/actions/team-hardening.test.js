import { describe, it, expect, vi } from 'vitest';
import User from '@/models/User';
import Event from '@/models/Event';
import Attendance from '@/models/Attendance';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent, makeUser, makeCompany } from '../helpers/factories.js';
import { generateTeamLogins, bulkCreateFromExcel, markAttendance } from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

describe('team login usernames (B3)', () => {
  it('continue after the highest index used by any company with the same slug', async () => {
    const w = await makeWorld(); // companyA is "Acme"
    const other = await makeCompany('ACME!'); // different company, same slug "acme"
    await makeUser('org_member', { username: 'acme-001', companyId: other._id });
    await makeUser('org_member', { username: 'acme-007', companyId: other._id });
    await makeUser('volunteer', { username: 'acme-notanumber' });
    await actAs(w.spocA);
    const res = await generateTeamLogins(form({ count: '2' }));
    expect(res.success).toBe(true);
    expect(res.credentials.map((c) => c.username)).toEqual(['acme-008', 'acme-009']);
    expect(await User.countDocuments({ companyId: w.companyA._id, username: { $in: ['acme-008', 'acme-009'] } })).toBe(2);
  });
  it('ignore employee-ID logins with very long numeric suffixes (N4)', async () => {
    const w = await makeWorld(); // companyA is "Acme"
    await actAs(w.spocA);
    // Employee-ID uploads: a long number and a padded one.
    const up = await bulkCreateFromExcel([{ name: 'Long', employeeId: '12345678901234567' }, { name: 'Padded', employeeId: '001' }]);
    expect(up.credentials.map((c) => c.username)).toEqual(['acme-12345678901234567', 'acme-001']);
    await makeUser('org_member', { username: `acme-${'9'.repeat(25)}`, companyId: w.companyA._id });
    const res = await generateTeamLogins(form({ count: '2' }));
    expect(res.success).toBe(true);
    expect(res.credentials.map((c) => c.username)).toEqual(['acme-002', 'acme-003']);
  });
  it("fall back to 'team' when the company name has no ASCII letters", async () => {
    const company = await makeCompany('日本企業');
    const spoc = await makeUser('org_spoc', { companyId: company._id });
    await actAs(spoc);
    const res = await generateTeamLogins(form({ count: '1' }));
    expect(res.success).toBe(true);
    expect(res.credentials[0].username).toMatch(/^team-\d{3}$/);
  });
});

describe('bulk account creation with taken usernames (B3)', () => {
  it('creates the rest, returns credentials only for created rows, and leaks nothing', async () => {
    const w = await makeWorld();
    await makeUser('org_member', { username: 'taken-name', companyId: w.companyB._id });
    await actAs(w.spocA);
    const res = await bulkCreateFromExcel([
      { name: 'One', username: 'taken-name' },
      { name: 'Two', username: 'fresh-two' },
      { name: 'Three', username: 'fresh-two' },
    ]);
    expect(res.success).toBe(true);
    expect(res.created).toBe(1);
    expect(res.failed).toBe(2);
    expect(res.credentials.map((c) => c.username)).toEqual(['fresh-two']);
    expect(res.message).toBe('Created 1 of 3 accounts. The others were not created because their usernames are already taken.');
    const text = JSON.stringify(res);
    expect(text).not.toMatch(/E11000|duplicate key|taken-name/);
    expect(String((await User.findOne({ username: 'fresh-two' })).companyId)).toBe(String(w.companyA._id));
    expect(String((await User.findOne({ username: 'taken-name' })).companyId)).toBe(String(w.companyB._id));
  });
  it('reports failure with no credentials when nothing could be created', async () => {
    const w = await makeWorld();
    await makeUser('org_member', { username: 'taken-name', companyId: w.companyB._id });
    await actAs(w.spocA);
    const res = await bulkCreateFromExcel([{ name: 'One', username: 'taken-name' }]);
    expect(res).toMatchObject({ success: false, created: 0, failed: 1, credentials: [] });
    expect(JSON.stringify(res)).not.toMatch(/E11000|duplicate key|taken-name/);
  });
});

describe('markAttendance payload validation (B4)', () => {
  async function setup() {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA);
    return { w, ev };
  }
  const unchanged = async (w) => {
    expect(await Attendance.countDocuments()).toBe(0);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours || 0).toBe(0);
  };
  it('refuses hours that are not a finite number from 0 to 24', async () => {
    const { w, ev } = await setup();
    for (const hours of [-1, 25, 24.5, NaN, Infinity, '5', { $gt: 0 }, [3]]) {
      const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: hours }]);
      expect(res).toEqual({ success: false, message: 'Hours must be a number from 0 to 24' });
    }
    await unchanged(w);
  });
  it('accepts 0 and 24 hours', async () => {
    const { w, ev } = await setup();
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 24 }])).success).toBe(true);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(24);
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 0 }])).success).toBe(true);
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(0);
  });
  it('refuses the same person twice in one payload', async () => {
    const { w, ev } = await setup();
    const res = await markAttendance(String(ev._id), [
      { userId: String(w.memberA._id), attended: true, hoursContributed: 3 },
      { userId: String(w.memberA._id), attended: true, hoursContributed: 3 },
    ]);
    expect(res).toEqual({ success: false, message: 'Each person can appear only once' });
    await unchanged(w);
  });
  it('refuses an array or object userId', async () => {
    const { w, ev } = await setup();
    for (const userId of [[String(w.memberA._id)], { toString: () => String(w.memberA._id) }]) {
      const res = await markAttendance(String(ev._id), [{ userId, attended: true, hoursContributed: 3 }]);
      expect(res).toEqual({ success: false, message: 'Invalid attendance data' });
    }
    await unchanged(w);
  });
});

describe('Employee ID column in the bulk upload (R7)', () => {
  async function microsoftSpoc() {
    const company = await makeCompany('Microsoft');
    const spoc = await makeUser('org_spoc', { companyId: company._id });
    await actAs(spoc);
    return { company, spoc };
  }
  const TAKEN = 'The others were not created because their usernames are already taken.';

  it('turns an ID into <companySlug>-<ID>', async () => {
    const { company } = await microsoftSpoc();
    const res = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001' }]);
    expect(res).toMatchObject({ success: true, created: 1, failed: 0 });
    expect(res.credentials[0]).toMatchObject({ name: 'Ravi', username: 'microsoft-1001' });
    expect(String((await User.findOne({ username: 'microsoft-1001' })).companyId)).toBe(String(company._id));
  });
  it('uses the same prefix as generated logins', async () => {
    const company = await makeCompany('Tata Consultancy Services!');
    await actAs(await makeUser('org_spoc', { companyId: company._id }));
    const generated = await generateTeamLogins(form({ count: '1' }));
    const bulk = await bulkCreateFromExcel([{ name: 'Ravi', employeeId: '1001' }]);
    expect(generated.credentials[0].username).toBe('tata-consultancy-services-001');
    expect(bulk.credentials[0].username).toBe('tata-consultancy-services-1001');
  });
  it('lets the ID win over Email, and falls back to Email, then a generated name', async () => {
    await microsoftSpoc();
    const res = await bulkCreateFromExcel([
      { name: 'Ravi', employeeId: '1002', username: 'ravi@example.com' },
      { name: 'Meena', username: 'meena@example.com' },
      { name: 'Arun', employeeId: '###' },
    ]);
    expect(res.credentials.map((c) => c.username).slice(0, 2)).toEqual(['microsoft-1002', 'meena@example.com']);
    expect(res.credentials[2].username).toMatch(/^microsoft-emp-\d+-2$/);
  });
  it('creates one row and reports the other when an ID appears twice in one sheet', async () => {
    await microsoftSpoc();
    const res = await bulkCreateFromExcel([{ name: 'First', employeeId: '1003' }, { name: 'Second', employeeId: ' 1003 ' }]);
    expect(res).toMatchObject({ success: true, created: 1, failed: 1, message: `Created 1 of 2 accounts. ${TAKEN}` });
    expect(res.credentials.map((c) => c.name)).toEqual(['First']);
    expect(await User.countDocuments({ username: 'microsoft-1003' })).toBe(1);
  });
  it('reports an ID whose login is already taken, creates the rest, and leaks nothing', async () => {
    const { company } = await microsoftSpoc();
    const other = await makeCompany('MICROSOFT!');
    await makeUser('org_member', { username: 'microsoft-1004', companyId: other._id });
    const res = await bulkCreateFromExcel([{ name: 'Taken', employeeId: '1004' }, { name: 'Free', employeeId: '1005' }]);
    expect(res).toMatchObject({ success: true, created: 1, failed: 1, message: `Created 1 of 2 accounts. ${TAKEN}` });
    expect(res.credentials.map((c) => c.username)).toEqual(['microsoft-1005']);
    expect(JSON.stringify(res)).not.toMatch(/E11000|duplicate key|1004/);
    expect(String((await User.findOne({ username: 'microsoft-1004' })).companyId)).toBe(String(other._id));
    expect(String((await User.findOne({ username: 'microsoft-1005' })).companyId)).toBe(String(company._id));
  });
  it('sanitises odd characters in the ID', async () => {
    await microsoftSpoc();
    const res = await bulkCreateFromExcel([{ name: 'Odd', employeeId: '  EMP/10 05#  ' }, { name: 'Dots', employeeId: 'A_b.C' }]);
    expect(res.credentials.map((c) => c.username)).toEqual(['microsoft-emp-10-05', 'microsoft-a_b.c']);
  });
});

describe('markAttendance takes attended as a real boolean (R5)', () => {
  // memberA attended the event for 3 hours.
  async function attendedFor3h() {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA);
    const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 3 }]);
    expect(res.success).toBe(true);
    return { w, ev };
  }
  const hoursOf = async (user) => (await User.findById(user._id)).totalVolunteerHours;

  it('"false" posted twice takes the 3 hours off once and never adds them back', async () => {
    const { w, ev } = await attendedFor3h();
    expect(await hoursOf(w.memberA)).toBe(3);
    const entry = [{ userId: String(w.memberA._id), attended: 'false', hoursContributed: 3 }];
    expect(await markAttendance(String(ev._id), entry)).toEqual({ success: true });
    expect(await hoursOf(w.memberA)).toBe(0);
    expect(await markAttendance(String(ev._id), entry)).toEqual({ success: true });
    expect(await hoursOf(w.memberA)).toBe(0);
    expect((await Attendance.findOne({ eventId: ev._id, userId: w.memberA._id })).attended).toBe(false);
  });
  it('"true" counts as attended', async () => {
    const { w, ev } = await attendedFor3h();
    const other = await makeUser('org_member', { companyId: w.companyA._id });
    expect(await markAttendance(String(ev._id), [{ userId: String(other._id), attended: 'true', hoursContributed: 2 }])).toEqual({ success: true });
    expect(await hoursOf(other)).toBe(2);
    expect((await Attendance.findOne({ eventId: ev._id, userId: other._id })).attended).toBe(true);
  });
  it('refuses the whole batch for any other attended value, before any database call', async () => {
    const { w, ev } = await attendedFor3h();
    const other = await makeUser('org_member', { companyId: w.companyA._id });
    const eventLookup = vi.spyOn(Event, 'findById');
    try {
      for (const attended of [undefined, null, 'yes', 'TRUE', ' false', '', 1, 0, {}, ['true']]) {
        const res = await markAttendance(String(ev._id), [
          { userId: String(w.memberA._id), attended: false, hoursContributed: 0 },
          { userId: String(other._id), attended, hoursContributed: 2 },
        ]);
        expect(res).toEqual({ success: false, message: 'Attended must be true or false' });
      }
      expect(eventLookup).not.toHaveBeenCalled();
    } finally {
      eventLookup.mockRestore();
    }
    expect(await hoursOf(w.memberA)).toBe(3);
    expect(await hoursOf(other)).toBe(0);
    expect(await Attendance.countDocuments()).toBe(1);
  });
  it('answers a database failure with a safe message', async () => {
    const { w, ev } = await attendedFor3h();
    const spy = vi.spyOn(Attendance, 'bulkWrite').mockRejectedValue(new Error('E11000 internal detail'));
    try {
      const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: false, hoursContributed: 0 }]);
      expect(res).toEqual({ success: false, message: 'Could not save attendance. Please try again.' });
    } finally {
      spy.mockRestore();
    }
  });
});
