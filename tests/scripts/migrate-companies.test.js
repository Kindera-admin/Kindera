import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import {
  parseArgs, planMigration, applyMigration, cleanupMigration, rollbackMigration, readBackup, main,
  backfillLegacy, formatPlan,
} from '../../scripts/migrate-companies.mjs';

let db;
const now = new Date('2026-10-01T00:00:00Z');
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-')), 'backup.json');

async function seedLegacy() {
  const spocId = new mongoose.Types.ObjectId();
  const memberId = new mongoose.Types.ObjectId();
  const eventId = new mongoose.Types.ObjectId();
  await db.collection('users').insertMany([
    { _id: spocId, username: 'spoc', role: 'org_spoc', name: 'S', organizationName: 'Acme Corp', organizationLogo: 'https://logo/acme.png', updatedAt: now },
    { _id: memberId, username: 'mem', role: 'org_member', name: 'M', organizationName: 'acme  corp ', spocId },
    { username: 'ngo', role: 'ngo', name: 'Green Earth', organizationName: 'Green Earth', ngoId: 'N1' },
    { username: 'vol', role: 'volunteer', name: 'V', organizationName: 'Freelance' },
  ]);
  await db.collection('events').insertMany([
    { _id: eventId, title: 'Internal', organizationName: 'Acme Corp', createdBy: spocId, createdByRole: 'org_spoc' },
    { title: 'Orphan internal', organizationName: 'Ghost Ltd', createdBy: spocId, createdByRole: 'org_spoc' },
    { title: 'Public', organizationName: null, createdBy: spocId, createdByRole: 'admin' },
  ]);
  await db.collection('attendances').insertMany([
    { eventId, userId: memberId, organizationName: 'ACME CORP', attended: true, hoursContributed: 3 },
    { eventId, userId: new mongoose.Types.ObjectId(), organizationName: 'All Organizations', attended: true },
  ]);
  return { spocId, memberId, eventId };
}

beforeEach(async () => {
  await connectDB();
  db = mongoose.connection.db;
  // tests/setup.js only clears collections mongoose has registered; these tests use raw collections.
  for (const name of ['users', 'events', 'attendances', 'companies']) await db.collection(name).deleteMany({});
});

describe('parseArgs', () => {
  it('defaults to a dry run on .env.local', () => {
    expect(parseArgs([])).toEqual({ env: '.env.local', mode: 'plan', yes: false, rollbackFile: null });
  });
  it('reads modes and flags', () => {
    expect(parseArgs(['--env', '.env.prod', '--apply', '--yes'])).toMatchObject({ env: '.env.prod', mode: 'apply', yes: true });
    expect(parseArgs(['--rollback', 'b.json'])).toMatchObject({ mode: 'rollback', rollbackFile: 'b.json' });
  });
  it('rejects unknown arguments', () => {
    expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
  });
});

describe('planMigration (dry run)', () => {
  it('groups name variants into one proposed company and writes nothing', async () => {
    await seedLegacy();
    const plan = await planMigration(db);
    const acme = plan.groups.find((g) => g.key === 'acme corp');
    expect(acme.name).toBe('Acme Corp');
    expect(acme.users).toBe(2);
    expect(acme.events).toBe(1);
    expect(acme.attendance).toBe(1);
    expect(plan.groups.map((g) => g.key)).toContain('ghost ltd');
    expect(plan.unmatched).toEqual([{ name: 'All Organizations', count: 1 }]);
    expect(plan.ngoUsers).toBe(1);
    expect(plan.volunteerUsers).toBe(1);
    expect(await db.collection('companies').countDocuments()).toBe(0);
    expect(await db.collection('users').countDocuments({ companyId: { $exists: true } })).toBe(0);
  });
});

describe('applyMigration (expand)', () => {
  it('creates one company per group', async () => {
    await seedLegacy();
    const res = await applyMigration(db, { now });
    expect(res.companiesCreated).toBe(2);
    expect(await db.collection('companies').countDocuments({ nameKey: 'acme corp' })).toBe(1);
  });
  it('links the SPOC', async () => {
    const { spocId } = await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    expect(String((await db.collection('users').findOne({ _id: spocId })).companyId)).toBe(String(acme._id));
  });
  it('links the employee whose name differs only by case and spacing', async () => {
    const { memberId } = await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    expect(String((await db.collection('users').findOne({ _id: memberId })).companyId)).toBe(String(acme._id));
  });
  it('links the private event', async () => {
    const { eventId } = await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    expect(String((await db.collection('events').findOne({ _id: eventId })).companyId)).toBe(String(acme._id));
  });
  it('keeps a private event private even when no user has its company name', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const ghost = await db.collection('companies').findOne({ nameKey: 'ghost ltd' });
    const orphan = await db.collection('events').findOne({ title: 'Orphan internal' });
    expect(String(orphan.companyId)).toBe(String(ghost._id));
  });
  it('leaves public events public', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    expect((await db.collection('events').findOne({ title: 'Public' })).companyId ?? null).toBeNull();
  });
  it('links matching attendance and leaves unmatched attendance unassigned', async () => {
    const { memberId } = await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    expect(String((await db.collection('attendances').findOne({ userId: memberId })).companyId)).toBe(String(acme._id));
    expect((await db.collection('attendances').findOne({ organizationName: 'All Organizations' })).companyId ?? null).toBeNull();
  });
  it("moves the SPOC's logo onto the company", async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    expect((await db.collection('companies').findOne({ nameKey: 'acme corp' })).logoUrl).toBe('https://logo/acme.png');
  });
  it("copies the NGO's organisation name to ngoName", async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    expect((await db.collection('users').findOne({ username: 'ngo' })).ngoName).toBe('Green Earth');
  });
  it("copies the volunteer's organisation to employerName", async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    expect((await db.collection('users').findOne({ username: 'vol' })).employerName).toBe('Freelance');
  });
  it('keeps organizationName in place so the old deployment still works', async () => {
    const { spocId } = await seedLegacy();
    await applyMigration(db, { now });
    expect((await db.collection('users').findOne({ _id: spocId })).organizationName).toBe('Acme Corp');
  });
  it('is safe to run twice', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const second = await applyMigration(db, { now });
    expect(second).toMatchObject({ companiesCreated: 0, companiesReused: 2, users: 0, events: 0, attendances: 0, ngoNames: 0, employerNames: 0 });
    expect(await db.collection('companies').countDocuments()).toBe(2);
  });
  it('writes a backup containing every changed document and the created companies', async () => {
    const { spocId } = await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const backup = readBackup(file);
    expect(backup.users.map((u) => String(u._id))).toContain(String(spocId));
    expect(backup.createdCompanyIds).toHaveLength(2);
  });
});

describe('cleanupMigration (contract)', () => {
  it('refuses while a SPOC or employee has no company', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('users').insertOne({ username: 'late', role: 'org_member', name: 'L', organizationName: 'Nope' });
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup/);
    expect(await db.collection('users').countDocuments({ organizationName: { $exists: true } })).toBeGreaterThan(0);
  });
  it('refuses while a private event has no company (it would become public)', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('events').insertOne({ title: 'New internal', organizationName: 'Acme Corp', createdByRole: 'org_spoc' });
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/private events/);
  });
  it('removes the old fields once every record is linked', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const res = await cleanupMigration(db, { now });
    expect(res.users).toBeGreaterThan(0);
    for (const name of ['users', 'events', 'attendances']) {
      expect(await db.collection(name).countDocuments({ organizationName: { $exists: true } })).toBe(0);
    }
    expect(await db.collection('users').countDocuments({ organizationLogo: { $exists: true } })).toBe(0);
  });
});

describe('rollbackMigration', () => {
  it('removes companyId, restores the migration fields and deletes the created companies', async () => {
    const { spocId } = await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    await rollbackMigration(db, readBackup(file));
    const spoc = await db.collection('users').findOne({ _id: spocId });
    expect(spoc).not.toHaveProperty('companyId');
    expect(spoc.organizationName).toBe('Acme Corp');
    expect(await db.collection('companies').countDocuments()).toBe(0);
  });
  it('restores fields removed by cleanup from the cleanup backup', async () => {
    const { spocId } = await seedLegacy();
    await applyMigration(db, { now });
    const linked = await db.collection('users').findOne({ _id: spocId });
    const file = tmp();
    await cleanupMigration(db, { now, backupFile: file });
    await rollbackMigration(db, readBackup(file));
    expect(await db.collection('users').findOne({ _id: spocId })).toEqual(linked);
  });
});

// ---- Fix round 1: data-safety hardening ----

const countOld = async () => ({
  users: await db.collection('users').countDocuments({ organizationName: { $exists: true } }),
  events: await db.collection('events').countDocuments({ organizationName: { $exists: true } }),
  attendances: await db.collection('attendances').countDocuments({ organizationName: { $exists: true } }),
});

// Wraps `db` so companies.insertOne can be observed or made to fail.
function dbWithInsertHook(hook) {
  const real = db.collection('companies');
  const fake = new Proxy(real, {
    get(t, p) {
      if (p === 'insertOne') return (...a) => { hook(); return t.insertOne(...a); };
      const v = t[p];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  return { collection: (n) => (n === 'companies' ? fake : db.collection(n)) };
}

describe('planMigration is read-only for NGO and volunteer names', () => {
  it('leaves ngoName and employerName unset', async () => {
    await seedLegacy();
    await planMigration(db);
    expect(await db.collection('users').countDocuments({ ngoName: { $exists: true } })).toBe(0);
    expect(await db.collection('users').countDocuments({ employerName: { $exists: true } })).toBe(0);
  });
});

describe('group naming', () => {
  it('uses the most-used spelling, not the first one seen', async () => {
    await db.collection('users').insertMany([
      { username: 'z1', role: 'org_spoc', name: 'Z1', organizationName: 'ZETA inc' },
      { username: 'z2', role: 'org_member', name: 'Z2', organizationName: 'Zeta Inc' },
      { username: 'z3', role: 'org_member', name: 'Z3', organizationName: 'Zeta Inc' },
    ]);
    const plan = await planMigration(db);
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0].name).toBe('Zeta Inc');
    await applyMigration(db, { now });
    expect((await db.collection('companies').findOne({ nameKey: 'zeta inc' })).name).toBe('Zeta Inc');
  });
  it('takes the logo of the most recently updated SPOC', async () => {
    // Older SPOC inserted first, so an unsorted query (natural order) would pick the wrong logo.
    await db.collection('users').insertMany([
      { username: 'old', role: 'org_spoc', name: 'O', organizationName: 'beta llc', organizationLogo: 'https://logo/old.png', updatedAt: new Date('2026-01-01T00:00:00Z') },
      { username: 'new', role: 'org_spoc', name: 'N', organizationName: 'Beta LLC', organizationLogo: 'https://logo/new.png', updatedAt: new Date('2026-09-01T00:00:00Z') },
    ]);
    await applyMigration(db, { now });
    expect((await db.collection('companies').findOne({ nameKey: 'beta llc' })).logoUrl).toBe('https://logo/new.png');
  });
});

describe('backup and rollback cover every changed document type', () => {
  it('backs up the private event, matched attendance, NGO user and volunteer user', async () => {
    const { eventId, memberId } = await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const backup = readBackup(file);
    const ngo = await db.collection('users').findOne({ username: 'ngo' });
    const vol = await db.collection('users').findOne({ username: 'vol' });
    const att = await db.collection('attendances').findOne({ userId: memberId });
    const ids = (docs) => docs.map((d) => String(d._id));
    expect(ids(backup.events)).toContain(String(eventId));
    expect(ids(backup.attendances)).toContain(String(att._id));
    expect(ids(backup.users)).toContain(String(ngo._id));
    expect(ids(backup.users)).toContain(String(vol._id));
    // the unmatched attendance and the public event are not changed, so they are not backed up
    expect(backup.attendances).toHaveLength(1);
    expect(backup.events).toHaveLength(2);
  });
  it('restores the events, attendance, NGO, volunteer and employee exactly', async () => {
    const { eventId, memberId } = await seedLegacy();
    const snap = async () => ({
      event: await db.collection('events').findOne({ _id: eventId }),
      orphan: await db.collection('events').findOne({ title: 'Orphan internal' }),
      attendance: await db.collection('attendances').findOne({ userId: memberId }),
      ngo: await db.collection('users').findOne({ username: 'ngo' }),
      vol: await db.collection('users').findOne({ username: 'vol' }),
      member: await db.collection('users').findOne({ _id: memberId }),
    });
    const before = await snap();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    expect(await snap()).not.toEqual(before);
    await rollbackMigration(db, readBackup(file));
    expect(await snap()).toEqual(before);
  });
});

describe('applyMigration backup ordering', () => {
  it('has written the backup file before the first company is inserted', async () => {
    await seedLegacy();
    const file = tmp();
    let existedAtFirstInsert = null;
    const wrapped = dbWithInsertHook(() => {
      if (existedAtFirstInsert === null) existedAtFirstInsert = fs.existsSync(file);
    });
    await applyMigration(wrapped, { now, backupFile: file });
    expect(existedAtFirstInsert).toBe(true);
  });
  it('leaves a backup listing the companies created before a failure', async () => {
    await seedLegacy();
    const file = tmp();
    let calls = 0;
    const wrapped = dbWithInsertHook(() => {
      calls += 1;
      if (calls === 2) throw new Error('boom');
    });
    await expect(applyMigration(wrapped, { now, backupFile: file })).rejects.toThrow('boom');
    expect(fs.existsSync(file)).toBe(true);
    const backup = readBackup(file);
    const created = await db.collection('companies').find({}).toArray();
    expect(created).toHaveLength(1);
    expect(backup.createdCompanyIds.map(String)).toEqual([String(created[0]._id)]);
    expect(backup.users.length).toBeGreaterThan(0);
  });
});

describe('cleanupMigration guards for records written after --apply', () => {
  it('refuses while an NGO has an organizationName but no ngoName, and unsets nothing', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('users').insertOne({ username: 'ngo2', role: 'ngo', name: 'N2', organizationName: 'Late NGO' });
    const before = await countOld();
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup.*NGO.*Run --apply again first/);
    expect(await countOld()).toEqual(before);
  });
  it('refuses while a volunteer has an organizationName but no employerName, and unsets nothing', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('users').insertOne({ username: 'vol2', role: 'volunteer', name: 'V2', organizationName: 'Late Employer' });
    const before = await countOld();
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup.*volunteer.*Run --apply again first/);
    expect(await countOld()).toEqual(before);
  });
  it('refuses while attendance matching a company has no companyId, and unsets nothing', async () => {
    const { eventId } = await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('attendances').insertOne({ eventId, userId: new mongoose.Types.ObjectId(), organizationName: 'acme corp', attended: true });
    const before = await countOld();
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup.*attendance.*Run --apply again first/);
    expect(await countOld()).toEqual(before);
  });
  it('is not blocked by attendance matching a company that apply could never link', async () => {
    const { eventId } = await seedLegacy();
    await applyMigration(db, { now });
    // A company created directly (e.g. in the admin UI): no user or event carries this name.
    await db.collection('companies').insertOne({ name: 'Created Later', nameKey: 'created later', logoUrl: '', status: 'active', createdBy: null, createdAt: now, updatedAt: now });
    await db.collection('attendances').insertOne({ eventId, userId: new mongoose.Types.ObjectId(), organizationName: 'Created Later', attended: true });
    await expect(cleanupMigration(db, { now })).resolves.toBeDefined();
    expect(await countOld()).toEqual({ users: 0, events: 0, attendances: 0 });
  });
  it('succeeds after the late records are re-applied', async () => {
    const { eventId } = await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('users').insertMany([
      { username: 'ngo2', role: 'ngo', name: 'N2', organizationName: 'Late NGO' },
      { username: 'vol2', role: 'volunteer', name: 'V2', organizationName: 'Late Employer' },
    ]);
    await db.collection('attendances').insertOne({ eventId, userId: new mongoose.Types.ObjectId(), organizationName: 'acme corp', attended: true });
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup/);
    const again = await applyMigration(db, { now });
    expect(again).toMatchObject({ ngoNames: 1, employerNames: 1, attendances: 1 });
    await cleanupMigration(db, { now });
    expect(await countOld()).toEqual({ users: 0, events: 0, attendances: 0 });
    expect((await db.collection('users').findOne({ username: 'ngo2' })).ngoName).toBe('Late NGO');
    expect((await db.collection('users').findOne({ username: 'vol2' })).employerName).toBe('Late Employer');
  });
});

describe('main (CLI)', () => {
  const neverEnv = () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-env-')), '.env.test');
    fs.writeFileSync(file, 'MONGODB_URI=mongodb://127.0.0.1:1/never\n');
    return file;
  };
  it('rejects --apply without --yes before connecting, and --env overrides the shell MONGODB_URI', async () => {
    const envFile = neverEnv();
    const saved = process.env.MONGODB_URI;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main(['--env', envFile, '--apply'])).rejects.toThrow(/--yes/);
      expect(log).toHaveBeenCalledWith(`Target database: 127.0.0.1:1/never (from ${envFile})`);
      expect(process.env.MONGODB_URI).toBe('mongodb://127.0.0.1:1/never');
      expect(mongoose.connection.readyState).toBe(1);
      expect(mongoose.connection.db.databaseName).not.toBe('never');
    } finally {
      log.mockRestore();
      process.env.MONGODB_URI = saved;
    }
  });
  it('requires --yes for cleanup and rollback too', async () => {
    const envFile = neverEnv();
    const saved = process.env.MONGODB_URI;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main(['--env', envFile, '--cleanup'])).rejects.toThrow(/--yes/);
      await expect(main(['--env', envFile, '--rollback', 'x.json'])).rejects.toThrow(/--yes/);
    } finally {
      log.mockRestore();
      process.env.MONGODB_URI = saved;
    }
  });
});

// ---- Final review A1: rollback only touches the fields the migration changed ----

describe('rollbackMigration is field-scoped', () => {
  it('apply rollback keeps changes made after the backup', async () => {
    const { spocId, eventId } = await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    await db.collection('users').updateOne({ _id: spocId }, {
      $set: { totalVolunteerHours: 42 },
      $push: { eventRegistrations: { eventId, status: 'approved' } },
    });
    await db.collection('users').updateOne({ username: 'ngo' }, { $set: { totalVolunteerHours: 7 } });
    await db.collection('events').updateOne({ _id: eventId }, { $set: { title: 'Renamed after backup' } });
    await rollbackMigration(db, readBackup(file));
    const spoc = await db.collection('users').findOne({ _id: spocId });
    expect(spoc.totalVolunteerHours).toBe(42);
    expect(spoc.eventRegistrations).toHaveLength(1);
    expect((await db.collection('users').findOne({ username: 'ngo' })).totalVolunteerHours).toBe(7);
    expect((await db.collection('events').findOne({ _id: eventId })).title).toBe('Renamed after backup');
  });
  it('apply rollback restores companyId, ngoName and employerName to their backed-up state', async () => {
    const { spocId, memberId, eventId } = await seedLegacy();
    // An NGO that already had an (empty) ngoName gets it back; one that had none loses the copied value.
    await db.collection('users').insertOne({ username: 'ngo-blank', role: 'ngo', name: 'NB', organizationName: 'Blue Sky', ngoName: '' });
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    expect((await db.collection('users').findOne({ username: 'ngo-blank' })).ngoName).toBe('Blue Sky');
    await rollbackMigration(db, readBackup(file));
    for (const id of [spocId, memberId]) {
      expect(await db.collection('users').findOne({ _id: id })).not.toHaveProperty('companyId');
    }
    expect(await db.collection('events').findOne({ _id: eventId })).not.toHaveProperty('companyId');
    expect(await db.collection('attendances').findOne({ userId: memberId })).not.toHaveProperty('companyId');
    expect(await db.collection('users').findOne({ username: 'ngo' })).not.toHaveProperty('ngoName');
    expect((await db.collection('users').findOne({ username: 'ngo-blank' })).ngoName).toBe('');
    expect(await db.collection('users').findOne({ username: 'vol' })).not.toHaveProperty('employerName');
    expect(await db.collection('companies').countDocuments()).toBe(0);
  });
  it('cleanup rollback restores organizationName and organizationLogo and keeps later changes', async () => {
    const { spocId, eventId, memberId } = await seedLegacy();
    await applyMigration(db, { now });
    const linked = await db.collection('users').findOne({ _id: spocId });
    const file = tmp();
    await cleanupMigration(db, { now, backupFile: file });
    await db.collection('users').updateOne({ _id: spocId }, { $set: { totalVolunteerHours: 9 } });
    await db.collection('events').updateOne({ _id: eventId }, { $set: { title: 'Edited after cleanup' } });
    await rollbackMigration(db, readBackup(file));
    const spoc = await db.collection('users').findOne({ _id: spocId });
    expect(spoc.organizationName).toBe('Acme Corp');
    expect(spoc.organizationLogo).toBe('https://logo/acme.png');
    expect(String(spoc.companyId)).toBe(String(linked.companyId));
    expect(spoc.totalVolunteerHours).toBe(9);
    const event = await db.collection('events').findOne({ _id: eventId });
    expect(event.organizationName).toBe('Acme Corp');
    expect(event.title).toBe('Edited after cleanup');
    expect((await db.collection('attendances').findOne({ userId: memberId })).organizationName).toBe('ACME CORP');
  });
  it('cleanup rollback only sets fields; it never unsets one the backup lacked', async () => {
    const { memberId } = await seedLegacy();
    await applyMigration(db, { now });
    const file = tmp();
    await cleanupMigration(db, { now, backupFile: file });
    // The member had no organizationLogo when cleanup ran; one written later must survive.
    await db.collection('users').updateOne({ _id: memberId }, { $set: { organizationLogo: 'https://logo/later.png' } });
    await rollbackMigration(db, readBackup(file));
    const member = await db.collection('users').findOne({ _id: memberId });
    expect(member.organizationLogo).toBe('https://logo/later.png');
    expect(member.organizationName).toBe('acme  corp ');
  });
  it('never replaces whole documents', async () => {
    await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const spy = vi.spyOn(db.collection('users').constructor.prototype, 'replaceOne');
    try {
      await rollbackMigration(db, readBackup(file));
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it('refuses a backup of an unknown kind and changes nothing', async () => {
    const { spocId } = await seedLegacy();
    await applyMigration(db, { now });
    const before = await db.collection('users').findOne({ _id: spocId });
    await expect(rollbackMigration(db, { kind: 'mystery', users: [{ _id: spocId }], events: [], attendances: [] }))
      .rejects.toThrow(/Unknown backup kind/);
    expect(await db.collection('users').findOne({ _id: spocId })).toEqual(before);
  });
});

// ---- Final review A2: --backfill-legacy writes the old fields back for old code ----

// The previous deployment's public-event filter matched organizationName null or missing.
const oldPublicFilter = { $or: [{ organizationName: null }, { organizationName: { $exists: false } }] };

async function seedNewStyle() {
  const companyId = new mongoose.Types.ObjectId();
  await db.collection('companies').insertOne({ _id: companyId, name: 'Acme Global', nameKey: 'acme global', logoUrl: 'https://logo/global.png', status: 'active', createdAt: now, updatedAt: now });
  const spocId = new mongoose.Types.ObjectId();
  await db.collection('users').insertMany([
    { _id: spocId, username: 'nspoc', role: 'org_spoc', name: 'NS', companyId },
    { username: 'nmem', role: 'org_member', name: 'NM', companyId, organizationName: '  ' },
    { username: 'kept', role: 'org_spoc', name: 'K', companyId, organizationName: 'Legacy Spelling', organizationLogo: 'https://logo/own.png' },
    { username: 'nvol', role: 'volunteer', name: 'NV', employerName: 'Somewhere' },
  ]);
  const { insertedId: eventId } = await db.collection('events').insertOne({ title: 'New internal', companyId, createdBy: spocId, createdByRole: 'org_spoc' });
  await db.collection('events').insertOne({ title: 'New public', createdBy: spocId, createdByRole: 'admin' });
  await db.collection('attendances').insertOne({ eventId, userId: spocId, companyId, attended: true });
  return { companyId, spocId, eventId };
}

describe('backfillLegacy (--backfill-legacy)', () => {
  it('parses --backfill-legacy', () => {
    expect(parseArgs(['--backfill-legacy', '--yes'])).toMatchObject({ mode: 'backfill', yes: true });
  });
  it('makes an internal event created with only companyId private again for the old filter', async () => {
    const { eventId } = await seedNewStyle();
    expect(await db.collection('events').countDocuments({ _id: eventId, ...oldPublicFilter })).toBe(1);
    await backfillLegacy(db, { now });
    expect((await db.collection('events').findOne({ _id: eventId })).organizationName).toBe('Acme Global');
    expect(await db.collection('events').countDocuments({ _id: eventId, ...oldPublicFilter })).toBe(0);
    // a public event stays public
    expect(await db.collection('events').countDocuments({ title: 'New public', ...oldPublicFilter })).toBe(1);
  });
  it('fills organizationName on corporate users and attendance, keeping non-blank names', async () => {
    const { spocId } = await seedNewStyle();
    const res = await backfillLegacy(db, { now });
    expect((await db.collection('users').findOne({ _id: spocId })).organizationName).toBe('Acme Global');
    expect((await db.collection('users').findOne({ username: 'nmem' })).organizationName).toBe('Acme Global');
    expect((await db.collection('users').findOne({ username: 'kept' })).organizationName).toBe('Legacy Spelling');
    expect(await db.collection('users').findOne({ username: 'nvol' })).not.toHaveProperty('organizationName');
    expect((await db.collection('attendances').findOne({ userId: spocId })).organizationName).toBe('Acme Global');
    expect(res).toMatchObject({ users: 2, events: 1, attendances: 1, logos: 1 });
  });
  it("gives SPOCs without a logo the company's logo, and leaves employees and existing logos alone", async () => {
    const { spocId } = await seedNewStyle();
    await backfillLegacy(db, { now });
    expect((await db.collection('users').findOne({ _id: spocId })).organizationLogo).toBe('https://logo/global.png');
    expect((await db.collection('users').findOne({ username: 'kept' })).organizationLogo).toBe('https://logo/own.png');
    expect(await db.collection('users').findOne({ username: 'nmem' })).not.toHaveProperty('organizationLogo');
  });
  it('writes a backup first that rolls the backfill back', async () => {
    const { spocId, eventId } = await seedNewStyle();
    const file = tmp();
    await backfillLegacy(db, { now, backupFile: file });
    const backup = readBackup(file);
    expect(backup.kind).toBe('backfill');
    expect(backup.users.map((u) => String(u._id))).toContain(String(spocId));
    await rollbackMigration(db, backup);
    expect(await db.collection('events').findOne({ _id: eventId })).not.toHaveProperty('organizationName');
    expect(await db.collection('users').findOne({ _id: spocId })).not.toHaveProperty('organizationLogo');
    expect((await db.collection('users').findOne({ username: 'nmem' })).organizationName).toBe('  ');
  });
  it('is safe to run twice', async () => {
    await seedNewStyle();
    await backfillLegacy(db, { now });
    expect(await backfillLegacy(db, { now })).toMatchObject({ users: 0, events: 0, attendances: 0, logos: 0 });
  });
  it('requires --yes for backfill', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-env-')), '.env.test');
    fs.writeFileSync(file, 'MONGODB_URI=mongodb://127.0.0.1:1/never\n');
    const saved = process.env.MONGODB_URI;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await expect(main(['--env', file, '--backfill-legacy'])).rejects.toThrow(/--yes/);
    } finally {
      log.mockRestore();
      process.env.MONGODB_URI = saved;
    }
  });
});

// ---- Final review A3: re-apply after a company rename ----

describe('applyMigration after a company rename', () => {
  it('links a late legacy user with the old name to the original company', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await db.collection('companies').updateOne({ _id: acme._id }, { $set: { name: 'Acme Global', nameKey: 'acme global' } });
    const { insertedId } = await db.collection('users').insertOne({ username: 'late', role: 'org_member', name: 'L', organizationName: 'Acme Corp' });
    const res = await applyMigration(db, { now });
    expect(res.companiesCreated).toBe(0);
    expect(await db.collection('companies').countDocuments()).toBe(2);
    expect(String((await db.collection('users').findOne({ _id: insertedId })).companyId)).toBe(String(acme._id));
  });
  it('links nothing for a name already linked to two different companies', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await db.collection('companies').updateOne({ _id: acme._id }, { $set: { name: 'Acme Global', nameKey: 'acme global' } });
    const { insertedId: otherId } = await db.collection('companies').insertOne({ name: 'Acme Corp', nameKey: 'acme corp', logoUrl: '', status: 'active', createdAt: now, updatedAt: now });
    await db.collection('users').insertOne({ username: 'other-spoc', role: 'org_spoc', name: 'O', companyId: otherId, organizationName: 'Acme Corp' });
    const { insertedId } = await db.collection('users').insertOne({ username: 'late', role: 'org_member', name: 'L', organizationName: 'acme corp' });
    const res = await applyMigration(db, { now });
    expect(res.ambiguous).toEqual([expect.objectContaining({ key: 'acme corp' })]);
    expect(await db.collection('users').findOne({ _id: insertedId })).not.toHaveProperty('companyId');
    expect(await db.collection('companies').countDocuments()).toBe(3);
  });
});

// ---- Final review A4: attendance linked through the attendee ----

describe('attendance linked through the attendee', () => {
  const allOrgs = () => db.collection('attendances').findOne({ organizationName: 'All Organizations' });
  it("gives an 'All Organizations' row the company of its linked corporate attendee", async () => {
    const { memberId } = await seedLegacy();
    // Another event: the Attendance model's unique (eventId, userId) index exists once any
    // test file has registered the model, so the member's existing row must not be duplicated.
    await db.collection('attendances').updateOne({ organizationName: 'All Organizations' }, { $set: { userId: memberId, eventId: new mongoose.Types.ObjectId() } });
    const file = tmp();
    const res = await applyMigration(db, { now, backupFile: file });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    expect(String((await allOrgs()).companyId)).toBe(String(acme._id));
    expect(res.attendances).toBe(2);
    const row = await allOrgs();
    expect(readBackup(file).attendances.map((a) => String(a._id))).toContain(String(row._id));
    await rollbackMigration(db, readBackup(file));
    expect(await allOrgs()).not.toHaveProperty('companyId');
  });
  it('leaves the row of an attendee who is not a corporate user unassigned', async () => {
    const { eventId } = await seedLegacy();
    const vol = await db.collection('users').findOne({ username: 'vol' });
    await db.collection('attendances').insertOne({ eventId, userId: vol._id, organizationName: 'All Organizations', attended: true });
    await applyMigration(db, { now });
    expect(await db.collection('attendances').countDocuments({ userId: vol._id, companyId: { $ne: null } })).toBe(0);
  });
  it('blocks cleanup while such a row is still unlinked, and unsets nothing', async () => {
    const { memberId } = await seedLegacy();
    await applyMigration(db, { now });
    await db.collection('attendances').insertOne({ eventId: new mongoose.Types.ObjectId(), userId: memberId, organizationName: 'All Organizations', attended: true });
    const before = await countOld();
    await expect(cleanupMigration(db, { now })).rejects.toThrow(/Refusing cleanup: 1 attendance records belong to a linked SPOC\/employee/);
    expect(await countOld()).toEqual(before);
    await applyMigration(db, { now });
    await expect(cleanupMigration(db, { now })).resolves.toBeDefined();
  });
});

// ---- Final review A5: unlinkable data is reported, not silently skipped ----

async function seedUnlinkable() {
  const ids = await seedLegacy();
  const { insertedIds } = await db.collection('users').insertMany([
    { username: 'noname', role: 'org_member', name: 'NN' },
    { username: 'blankname', role: 'org_spoc', name: 'BN', organizationName: '   ', status: 'pending' },
  ]);
  const { insertedId: blankEvent } = await db.collection('events').insertOne({ title: 'Blank org event', organizationName: '  ', createdByRole: 'org_spoc' });
  return { ...ids, noname: insertedIds[0], blankname: insertedIds[1], blankEvent };
}

describe('unlinkable data', () => {
  it('the dry run lists corporate users with no usable name and events with a blank name', async () => {
    const { noname, blankname, blankEvent } = await seedUnlinkable();
    const plan = await planMigration(db);
    expect(plan.unlinkable.users.map((u) => [String(u._id), u.username]).sort()).toEqual(
      [[String(noname), 'noname'], [String(blankname), 'blankname']].sort(),
    );
    expect(plan.unlinkable.events.map((e) => [String(e._id), e.title])).toEqual([[String(blankEvent), 'Blank org event']]);
    const out = formatPlan(plan).join('\n');
    expect(out).toContain(`${noname} noname`);
    expect(out).toContain(`${blankEvent} "Blank org event"`);
  });
  it("the dry run shows the status of each proposed company's SPOCs", async () => {
    await seedLegacy();
    await db.collection('users').updateOne({ username: 'spoc' }, { $set: { status: 'approved' } });
    await db.collection('users').insertMany([
      { username: 'spoc2', role: 'org_spoc', name: 'S2', organizationName: 'ACME Corp', status: 'pending' },
      { username: 'spoc3', role: 'org_spoc', name: 'S3', organizationName: 'acme corp', status: 'rejected' },
      { username: 'spoc4', role: 'org_spoc', name: 'S4', organizationName: 'Acme Corp', status: 'pending' },
    ]);
    const plan = await planMigration(db);
    const acme = plan.groups.find((g) => g.key === 'acme corp');
    expect(acme.spocStatus).toEqual({ approved: 1, pending: 2, rejected: 1 });
    expect(plan.groups.find((g) => g.key === 'ghost ltd').spocStatus).toEqual({ approved: 0, pending: 0, rejected: 0 });
    expect(formatPlan(plan).join('\n')).toContain('SPOCs: 1 approved, 2 pending, 1 rejected');
  });
  it('cleanup refuses with the ids of corporate users it cannot link and says how to fix them', async () => {
    const { noname } = await seedUnlinkable();
    await db.collection('events').deleteMany({ title: 'Blank org event' });
    await applyMigration(db, { now });
    const before = await countOld();
    const err = await cleanupMigration(db, { now }).catch((e) => e);
    expect(err.message).toMatch(/Refusing cleanup: 2 SPOC\/employee accounts have no company name and no companyId/);
    expect(err.message).toContain(`${noname} (noname)`);
    expect(err.message).toMatch(/assign a company or change the role/);
    expect(await countOld()).toEqual(before);
  });
  it('cleanup refuses while an event has a blank organizationName, listing it, and unsets nothing', async () => {
    const { blankEvent } = await seedUnlinkable();
    await db.collection('users').deleteMany({ username: { $in: ['noname', 'blankname'] } });
    await applyMigration(db, { now });
    const before = await countOld();
    const err = await cleanupMigration(db, { now }).catch((e) => e);
    expect(err.message).toMatch(/Refusing cleanup: 1 events have a blank organizationName/);
    expect(err.message).toContain(`${blankEvent} (Blank org event)`);
    expect(await countOld()).toEqual(before);
  });
  it('apply does not copy a whitespace-only NGO or volunteer name', async () => {
    await db.collection('users').insertMany([
      { username: 'ngo-ws', role: 'ngo', name: 'N', organizationName: '   ' },
      { username: 'vol-ws', role: 'volunteer', name: 'V', organizationName: '  ' },
    ]);
    await applyMigration(db, { now });
    expect(await db.collection('users').findOne({ username: 'ngo-ws' })).not.toHaveProperty('ngoName');
    expect(await db.collection('users').findOne({ username: 'vol-ws' })).not.toHaveProperty('employerName');
    await expect(cleanupMigration(db, { now })).resolves.toBeDefined();
  });
});

// ---- Residual round R1-R3: dangling company references ----

// Runs the CLI against the test database: connect/disconnect are stubbed so the
// shared connection survives, and backups land in a temporary working directory.
async function runMain(args) {
  const envFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-env-')), '.env.test');
  fs.writeFileSync(envFile, `MONGODB_URI=${process.env.MONGODB_URI}\n`);
  const savedUri = process.env.MONGODB_URI;
  const cwd = process.cwd();
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'mig-cwd-')));
  const logs = [];
  const log = vi.spyOn(console, 'log').mockImplementation((...a) => { logs.push(a.map(String).join(' ')); });
  const connect = vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
  const disconnect = vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
  try {
    const error = await main(['--env', envFile, ...args]).then(() => null, (e) => e);
    return { logs, error };
  } finally {
    log.mockRestore();
    connect.mockRestore();
    disconnect.mockRestore();
    process.chdir(cwd);
    process.env.MONGODB_URI = savedUri;
  }
}

// Records the new code writes after deploy: companyId only, no organizationName.
async function addNewCodeRecords(companyId) {
  const { insertedId: userId } = await db.collection('users').insertOne({ username: 'new-emp', role: 'org_member', name: 'NE', companyId });
  const { insertedId: eventId } = await db.collection('events').insertOne({ title: 'New-code internal', companyId, createdByRole: 'org_spoc' });
  return { userId, eventId };
}

describe('apply rollback keeps companies that are still referenced (R1)', () => {
  it('keeps a created company that records outside the backup still use, and deletes the rest', async () => {
    await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    const ghost = await db.collection('companies').findOne({ nameKey: 'ghost ltd' });
    const { userId, eventId } = await addNewCodeRecords(acme._id);
    await backfillLegacy(db, { now });
    const res = await rollbackMigration(db, readBackup(file));
    expect(await db.collection('companies').countDocuments({ _id: acme._id })).toBe(1);
    expect(await db.collection('companies').countDocuments({ _id: ghost._id })).toBe(0);
    for (const [name, id] of [['users', userId], ['events', eventId]]) {
      const doc = await db.collection(name).findOne({ _id: id });
      expect(String(doc.companyId)).toBe(String(acme._id));
      expect(await db.collection('companies').countDocuments({ _id: doc.companyId })).toBe(1);
    }
    expect(res.deleted).toBe(1);
    expect(res.kept).toEqual([{ _id: acme._id, name: 'Acme Corp', references: 2 }]);
  });
  it('counts an NGO partner card that lists the company as a reference', async () => {
    await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const ghost = await db.collection('companies').findOne({ nameKey: 'ghost ltd' });
    await db.collection('ngopartners').insertOne({ name: 'Card', description: 'd', companyIds: [ghost._id] });
    try {
      const res = await rollbackMigration(db, readBackup(file));
      expect(res.kept).toEqual([{ _id: ghost._id, name: 'Ghost Ltd', references: 1 }]);
      expect(await db.collection('companies').countDocuments({ _id: ghost._id })).toBe(1);
    } finally {
      await db.collection('ngopartners').deleteMany({});
    }
  });
  it('the CLI reports each kept company with its reference count', async () => {
    await seedLegacy();
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await addNewCodeRecords(acme._id);
    const { logs, error } = await runMain(['--rollback', file, '--yes']);
    expect(error).toBeNull();
    expect(logs).toContain(`Company "Acme Corp" (${acme._id}) kept (still referenced by 2 records)`);
    expect(logs).toContain('Deleted 1 created companies.');
  });
});

describe('re-apply and cleanup never trust a dangling companyId (R2)', () => {
  it('ignores a linked key whose company no longer exists, and links to a real company', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await db.collection('companies').deleteOne({ _id: acme._id });
    const { insertedId } = await db.collection('users').insertOne({ username: 'late', role: 'org_member', name: 'L', organizationName: 'Acme Corp' });
    const res = await applyMigration(db, { now });
    const late = await db.collection('users').findOne({ _id: insertedId });
    expect(late.companyId).toBeTruthy();
    expect(String(late.companyId)).not.toBe(String(acme._id));
    expect(await db.collection('companies').countDocuments({ _id: late.companyId })).toBe(1);
    expect(res.companiesCreated).toBe(1);
    expect(res.ambiguous).toEqual([]);
  });
  it('a key linked to one dangling and one real company links to the real one', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await db.collection('companies').updateOne({ _id: acme._id }, { $set: { name: 'Acme Global', nameKey: 'acme global' } });
    const { insertedId: otherId } = await db.collection('companies').insertOne({ name: 'Acme Two', nameKey: 'acme two', logoUrl: '', status: 'active', createdAt: now, updatedAt: now });
    await db.collection('users').insertOne({ username: 'other-spoc', role: 'org_spoc', name: 'O', companyId: otherId, organizationName: 'Acme Corp' });
    await db.collection('companies').deleteOne({ _id: acme._id });
    const { insertedId } = await db.collection('users').insertOne({ username: 'late', role: 'org_member', name: 'L', organizationName: 'acme corp' });
    const res = await applyMigration(db, { now });
    expect(res.ambiguous).toEqual([]);
    expect(String((await db.collection('users').findOne({ _id: insertedId })).companyId)).toBe(String(otherId));
  });
  it('cleanup refuses while a record points at a missing company, lists it, and unsets nothing', async () => {
    await seedLegacy();
    await applyMigration(db, { now });
    const ghost = await db.collection('companies').findOne({ nameKey: 'ghost ltd' });
    await db.collection('companies').deleteOne({ _id: ghost._id });
    const before = await countOld();
    const err = await cleanupMigration(db, { now }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/^Refusing cleanup: 1 records point at companies that no longer exist/);
    expect(err.message).toContain(`${ghost._id} (1 records)`);
    expect(err.message).toMatch(/restore those companies or re-link the records/);
    expect(await countOld()).toEqual(before);
    // The dangling reference was the only blocker: re-linking it lets cleanup run.
    const acme = await db.collection('companies').findOne({ nameKey: 'acme corp' });
    await db.collection('events').updateMany({ companyId: ghost._id }, { $set: { companyId: acme._id } });
    await expect(cleanupMigration(db, { now })).resolves.toBeDefined();
  });
});

describe('backfillLegacy fails closed on a missing company (R3)', () => {
  async function seedDangling() {
    const ids = await seedNewStyle();
    const missingId = new mongoose.Types.ObjectId();
    const { insertedId: danglingEvent } = await db.collection('events').insertOne({ title: 'Dangling internal', companyId: missingId, createdByRole: 'org_spoc' });
    const { insertedId: danglingUser } = await db.collection('users').insertOne({ username: 'dang', role: 'org_member', name: 'D', companyId: missingId });
    await db.collection('attendances').insertOne({ eventId: danglingEvent, userId: danglingUser, companyId: missingId, attended: true });
    return { ...ids, missingId, danglingEvent, danglingUser };
  }
  it('gives an internal event with a dangling companyId a placeholder name so the old code keeps it private', async () => {
    const { missingId, danglingEvent } = await seedDangling();
    expect(await db.collection('events').countDocuments({ _id: danglingEvent, ...oldPublicFilter })).toBe(1);
    const res = await backfillLegacy(db, { now });
    expect((await db.collection('events').findOne({ _id: danglingEvent })).organizationName).toBe(`Unknown company (${missingId})`);
    expect(await db.collection('events').countDocuments({ _id: danglingEvent, ...oldPublicFilter })).toBe(0);
    // Totals include the placeholder writes (one each on top of seedNewStyle's).
    expect(res).toMatchObject({ users: 3, events: 2, attendances: 2, placeholders: 3, missingCompanies: 1 });
  });
  it('gives the user and attendance a placeholder too, one per missing company', async () => {
    const { missingId, danglingUser } = await seedDangling();
    const otherMissing = new mongoose.Types.ObjectId();
    await db.collection('events').insertOne({ title: 'Other dangling', companyId: otherMissing, createdByRole: 'org_spoc' });
    await backfillLegacy(db, { now });
    expect((await db.collection('users').findOne({ _id: danglingUser })).organizationName).toBe(`Unknown company (${missingId})`);
    expect((await db.collection('attendances').findOne({ userId: danglingUser })).organizationName).toBe(`Unknown company (${missingId})`);
    expect((await db.collection('events').findOne({ title: 'Other dangling' })).organizationName).toBe(`Unknown company (${otherMissing})`);
  });
  it('rolls the placeholders back with the backfill backup', async () => {
    const { danglingEvent } = await seedDangling();
    const file = tmp();
    await backfillLegacy(db, { now, backupFile: file });
    await rollbackMigration(db, readBackup(file));
    expect(await db.collection('events').findOne({ _id: danglingEvent })).not.toHaveProperty('organizationName');
  });
  it('the CLI writes the placeholders, reports them and exits non-zero, also on a re-run', async () => {
    const { missingId, danglingEvent } = await seedDangling();
    const first = await runMain(['--backfill-legacy', '--yes']);
    expect((await db.collection('events').findOne({ _id: danglingEvent })).organizationName).toBe(`Unknown company (${missingId})`);
    expect(first.error).toBeInstanceOf(Error);
    expect(first.error.message).toMatch(/3 records point at 1 missing company/);
    expect(first.error.message).toContain(String(missingId));
    expect(first.logs.some((l) => l.startsWith('Backup: '))).toBe(true);
    const second = await runMain(['--backfill-legacy', '--yes']);
    expect(second.error?.message).toMatch(/3 records point at 1 missing company/);
  });
  it('the CLI exits cleanly when every company exists', async () => {
    await seedNewStyle();
    const { error } = await runMain(['--backfill-legacy', '--yes']);
    expect(error).toBeNull();
  });
});
