import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Company from '@/models/Company';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent, makeUser } from '../helpers/factories.js';
import {
  getOrgStats, getAllCorporateStats, getAdminImpactStats, getAllEventsHistory, getAdminEventDetails,
  getOrgEventsHistory, getMyImpact, exportDetailedAttendanceData, getImpactStats, getDetailedDirectoryStats,
} from '@/app/actions';

const MALFORMED = ['not-an-id', '{"$ne":""}', '12'];
const noCastText = (res) => expect(String(res.message || '')).not.toMatch(/cast|objectid|validation/i);
const DAY = 86400000;

// The schema requires a company for corporate roles, so build the legacy shape around it.
async function makeCompanylessUser(role) {
  const company = (await Company.create({ name: `Temp ${Math.random()}` }));
  const user = await makeUser(role, { companyId: company._id });
  await User.updateOne({ _id: user._id }, { $unset: { companyId: 1 } });
  await Company.deleteOne({ _id: company._id });
  return User.findById(user._id);
}

async function seedAttendance(w) {
  const pub = await makeEvent(w.admin, { title: 'Public', date: new Date(Date.now() - DAY) });
  const internalA = await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id, date: new Date(Date.now() - DAY) });
  await Attendance.create({ eventId: pub._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true, hoursContributed: 4, markedAt: new Date() });
  await Attendance.create({ eventId: internalA._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true, hoursContributed: 2, markedAt: new Date() });
  await Attendance.create({ eventId: pub._id, userId: w.memberB._id, companyId: w.companyB._id, attended: true, hoursContributed: 9, markedAt: new Date() });
  for (const [u, ev] of [[w.memberA, pub], [w.memberA, internalA], [w.memberB, pub]]) {
    await User.updateOne({ _id: u._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
  }
  return { pub, internalA };
}

describe('getOrgStats', () => {
  it("sums only the company's attendance (string ids are cast for aggregation)", async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.spocA2);
    const res = await getOrgStats(String(w.companyA._id));
    expect(res.stats.volunteerHours).toBe(6);
    expect(res.stats.eventsAttended).toBe(2);
    expect(res.stats.totalVolunteers).toBe(1);
    expect(res.eventsList.find((e) => e.title === 'A internal').isCorporate).toBe(true);
    expect(res.eventsList.find((e) => e.title === 'Public').isCorporate).toBe(false);
  });
  it("refuses another company's stats", async () => {
    const w = await makeWorld();
    await actAs(w.spocB);
    expect((await getOrgStats(String(w.companyA._id))).success).toBe(false);
  });
  it('gives every SPOC of a company the same dashboard data', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.spocA);
    const first = await getOrgStats(String(w.companyA._id));
    await actAs(w.spocA2);
    const second = await getOrgStats(String(w.companyA._id));
    const own = await getOrgStats(null);
    expect(first.success).toBe(true);
    expect(second).toEqual(first);
    expect(own).toEqual(first);
  });
  it("refuses a company's SPOC and member another company's stats, leaking nothing", async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    for (const caller of [w.spocB, w.memberB]) {
      await actAs(caller);
      const res = await getOrgStats(String(w.companyA._id));
      expect(res).toEqual({ success: false, message: 'Not authorized for this company' });
    }
  });
  it('lets staff read any company and a member read their own', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    for (const caller of [w.admin, w.employee]) {
      await actAs(caller);
      expect((await getOrgStats(String(w.companyB._id))).stats.volunteerHours).toBe(9);
    }
    await actAs(w.memberA);
    expect((await getOrgStats(null)).stats.volunteerHours).toBe(6);
  });
  it('refuses volunteers, NGOs and logged-out callers', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    for (const caller of [w.volunteer, w.ngo]) {
      await actAs(caller);
      expect(await getOrgStats(String(w.companyA._id))).toEqual({ success: false, message: 'Not authorized' });
    }
    await actAs(null);
    expect(await getOrgStats(String(w.companyA._id))).toEqual({ success: false, message: 'Not authenticated' });
  });
  it('requires a company for staff and refuses a SPOC without one', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect(await getOrgStats(null)).toEqual({ success: false, message: 'Company is required' });
    const orphan = await makeCompanylessUser('org_spoc');
    await actAs(orphan);
    expect((await getOrgStats(null)).success).toBe(false);
  });
  it('answers malformed ids with a plain message, not a cast error', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    for (const caller of [w.admin, w.spocA]) {
      await actAs(caller);
      for (const id of MALFORMED) {
        const res = await getOrgStats(id);
        expect(res.success).toBe(false);
        expect(res.stats).toBeUndefined();
        noCastText(res);
      }
    }
  });
});

describe('admin overviews', () => {
  it('lists one row per company even with two SPOCs', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.admin);
    const { orgs } = await getAllCorporateStats();
    const acme = orgs.filter((o) => o.name === 'Acme');
    expect(acme).toHaveLength(1);
    expect(acme[0]).toMatchObject({ companyId: String(w.companyA._id), memberCount: 1, volunteerHours: 6 });
    expect(acme[0].spocNames).toHaveLength(2);
  });
  it('names top companies and counts active companies', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await Company.updateOne({ _id: w.companyB._id }, { status: 'archived' });
    await actAs(w.admin);
    const { stats } = await getAdminImpactStats();
    expect(stats.topOrgs[0]).toMatchObject({ name: 'Beta', hours: 9 });
    expect(stats.totalOrgs).toBe(1);
    expect((await getImpactStats()).stats.organisations).toBe(1);
  });
  it('labels events and corporate breakdowns with company names', async () => {
    const w = await makeWorld();
    const { internalA, pub } = await seedAttendance(w);
    await actAs(w.admin);
    const { history } = await getAllEventsHistory();
    const internal = history.find((h) => h._id === String(internalA._id));
    expect(internal).toMatchObject({ companyId: String(w.companyA._id), companyName: 'Acme' });
    expect(internal.createdBy.companyName).toBe('Acme');
    const publicRow = history.find((h) => h._id === String(pub._id));
    expect(publicRow.companyId).toBeNull();
    expect(publicRow.corporateDetails.map((c) => c.orgName).sort()).toEqual(['Acme', 'Beta']);
  });
  it('exports attendance rows with company names, filtered by company', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.admin);
    const { data } = await exportDetailedAttendanceData(String(w.companyB._id));
    expect(data.map((r) => r.companyName)).toEqual(['Beta']);
    const all = await exportDetailedAttendanceData();
    expect(all.data.map((r) => r.companyName).sort()).toEqual(['Acme', 'Acme', 'Beta']);
  });
  it('refuses a malformed export filter instead of exporting everything', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.admin);
    for (const id of MALFORMED) {
      const res = await exportDetailedAttendanceData(id);
      expect(res.success).toBe(false);
      expect(res.data).toBeUndefined();
      noCastText(res);
    }
  });
  it('lists directory SPOCs with their company and only that company\'s numbers', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.employee);
    const { spocs } = await getDetailedDirectoryStats();
    const row = spocs.find((s) => s._id === String(w.spocB._id));
    expect(row).toMatchObject({ companyId: String(w.companyB._id), companyName: 'Beta', memberCount: 1, volunteerHours: 9, eventsAttended: 1 });
    const rowA = spocs.find((s) => s._id === String(w.spocA2._id));
    expect(rowA).toMatchObject({ companyName: 'Acme', memberCount: 1, volunteerHours: 6, eventsAttended: 2 });
  });
  it('gives a SPOC without a company no members or hours, not every individual\'s', async () => {
    const w = await makeWorld();
    const orphan = await makeCompanylessUser('org_spoc');
    const pub = await makeEvent(w.admin, { date: new Date(Date.now() - DAY) });
    await Attendance.create({ eventId: pub._id, userId: w.volunteer._id, attended: true, hoursContributed: 5, markedAt: new Date() });
    await makeCompanylessUser('org_member');
    await actAs(w.admin);
    const { spocs } = await getDetailedDirectoryStats();
    expect(spocs.find((s) => s._id === String(orphan._id))).toMatchObject({ companyId: null, companyName: '', memberCount: 0, volunteerHours: 0, eventsAttended: 0 });
  });
});

describe('who may use the admin and staff tools', () => {
  it('refuses everyone but the right staff', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    const cases = [
      [() => getAllCorporateStats(), [w.employee, w.spocA, w.memberA, w.volunteer, w.ngo], 'Admin only'],
      [() => getAdminImpactStats(), [w.employee, w.spocA, w.memberA, w.volunteer, w.ngo], 'Admin access required'],
      [() => getDetailedDirectoryStats(), [w.spocA, w.memberA, w.volunteer, w.ngo], 'Admin/Employee only'],
      [() => getAllEventsHistory(), [w.spocA, w.memberA, w.volunteer, w.ngo], 'Unauthorized'],
      [() => exportDetailedAttendanceData(String(w.companyA._id)), [w.spocA, w.spocB, w.memberA, w.volunteer, w.ngo], 'Admin/Employee only'],
    ];
    for (const [call, callers, message] of cases) {
      for (const caller of callers) {
        await actAs(caller);
        expect(await call()).toEqual({ success: false, message });
      }
      await actAs(null);
      expect(await call()).toEqual({ success: false, message: 'Not authenticated' });
    }
  });
});

describe('event details for SPOCs', () => {
  it("show a SPOC only their company's participants", async () => {
    const w = await makeWorld();
    const { pub } = await seedAttendance(w);
    await actAs(w.spocA2);
    const res = await getAdminEventDetails(String(pub._id));
    expect(res.participants.map((p) => p._id)).toEqual([String(w.memberA._id)]);
    expect(res.participants[0].companyName).toBe('Acme');
  });
  it("never show a SPOC another company's participants of a public event", async () => {
    const w = await makeWorld();
    const { pub } = await seedAttendance(w);
    await actAs(w.spocB);
    const res = await getAdminEventDetails(String(pub._id));
    expect(res.participants.map((p) => p._id)).toEqual([String(w.memberB._id)]);
  });
  it('show staff everyone, with company names on the event and its creator', async () => {
    const w = await makeWorld();
    const { internalA, pub } = await seedAttendance(w);
    await actAs(w.admin);
    const res = await getAdminEventDetails(String(pub._id));
    expect(res.participants.map((p) => p.companyName).sort()).toEqual(['Acme', 'Beta']);
    expect(res.event.companyName).toBeNull();
    const internal = await getAdminEventDetails(String(internalA._id));
    expect(internal.event.companyName).toBe('Acme');
    expect(internal.event.createdBy.companyName).toBe('Acme');
  });
  it("refuse a SPOC details of another company's internal event", async () => {
    const w = await makeWorld();
    const { internalA } = await seedAttendance(w);
    await actAs(w.spocB);
    expect((await getAdminEventDetails(String(internalA._id))).success).toBe(false);
  });
  it("show a SPOC their own company's internal event", async () => {
    const w = await makeWorld();
    const { internalA } = await seedAttendance(w);
    await actAs(w.spocA2);
    const res = await getAdminEventDetails(String(internalA._id));
    expect(res.success).toBe(true);
    expect(res.event.companyName).toBe('Acme');
  });
  it('refuse a SPOC without a company, members, volunteers, NGOs and logged-out callers', async () => {
    const w = await makeWorld();
    const { pub } = await seedAttendance(w);
    const orphan = await makeCompanylessUser('org_spoc');
    for (const caller of [orphan, w.memberA, w.volunteer, w.ngo]) {
      await actAs(caller);
      const res = await getAdminEventDetails(String(pub._id));
      expect(res).toEqual({ success: false, message: 'Unauthorized' });
    }
    await actAs(null);
    expect(await getAdminEventDetails(String(pub._id))).toEqual({ success: false, message: 'Not authenticated' });
  });
  it('answer malformed or unknown event ids with a plain message', async () => {
    const w = await makeWorld();
    for (const caller of [w.admin, w.spocA]) {
      await actAs(caller);
      for (const id of [...MALFORMED, 'aaaaaaaaaaaaaaaaaaaaaaaa']) {
        const res = await getAdminEventDetails(id);
        expect(res).toEqual({ success: false, message: 'Event not found' });
      }
    }
  });
});

describe('company history and personal impact', () => {
  it('mark internal vs global events in company history', async () => {
    const w = await makeWorld();
    const { internalA, pub } = await seedAttendance(w);
    await actAs(w.spocA);
    const { history } = await getOrgEventsHistory(String(w.companyA._id));
    expect(history.find((h) => h._id === String(internalA._id)).type).toBe('internal');
    expect(history.find((h) => h._id === String(pub._id)).type).toBe('global');
  });
  it("shows only the caller's company in the history, the same to every SPOC", async () => {
    const w = await makeWorld();
    const { pub } = await seedAttendance(w);
    await actAs(w.spocA);
    const first = await getOrgEventsHistory(String(w.companyA._id));
    await actAs(w.spocA2);
    const second = await getOrgEventsHistory(String(w.companyA._id));
    expect(second).toEqual(first);
    const publicRow = second.history.find((h) => h._id === String(pub._id));
    expect(publicRow.volunteers.map((v) => v.id)).toEqual([String(w.memberA._id)]);
  });
  it("refuses another company's history and leaks nothing", async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    for (const caller of [w.spocB, w.memberB]) {
      await actAs(caller);
      expect(await getOrgEventsHistory(String(w.companyA._id))).toEqual({ success: false, message: 'Not authorized for this company' });
    }
  });
  it('refuses volunteers, NGOs, logged-out callers and a staff request without a company', async () => {
    const w = await makeWorld();
    for (const caller of [w.volunteer, w.ngo]) {
      await actAs(caller);
      expect(await getOrgEventsHistory(String(w.companyA._id))).toEqual({ success: false, message: 'Not authorized' });
    }
    await actAs(null);
    expect(await getOrgEventsHistory(String(w.companyA._id))).toEqual({ success: false, message: 'Not authenticated' });
    await actAs(w.admin);
    expect(await getOrgEventsHistory(null)).toEqual({ success: false, message: 'Company is required' });
  });
  it('answers malformed company ids with a plain message', async () => {
    const w = await makeWorld();
    for (const caller of [w.admin, w.spocA]) {
      await actAs(caller);
      for (const id of MALFORMED) {
        const res = await getOrgEventsHistory(id);
        expect(res.success).toBe(false);
        expect(res.history).toBeUndefined();
        noCastText(res);
      }
    }
  });
  it("show an employee their company's name and logo", async () => {
    const w = await makeWorld();
    await Company.updateOne({ _id: w.companyA._id }, { logoUrl: 'https://x/acme.png' });
    await seedAttendance(w);
    await actAs(w.memberA);
    const { stats, events } = await getMyImpact();
    expect(stats).toMatchObject({ companyName: 'Acme', companyLogo: 'https://x/acme.png' });
    expect(events.find((e) => e.title === 'A internal').companyName).toBe('Acme');
    expect(events.find((e) => e.title === 'Public').companyName).toBeNull();
  });
  it('shows a volunteer no company', async () => {
    const w = await makeWorld();
    await actAs(w.volunteer);
    const { stats } = await getMyImpact();
    expect(stats).toMatchObject({ companyName: null, companyLogo: null });
  });
});
