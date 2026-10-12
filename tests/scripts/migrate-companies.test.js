import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import {
  parseArgs, planMigration, applyMigration, cleanupMigration, rollbackMigration, readBackup,
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
  it('restores every changed document exactly and deletes the created companies', async () => {
    const { spocId } = await seedLegacy();
    const before = await db.collection('users').findOne({ _id: spocId });
    const file = tmp();
    await applyMigration(db, { now, backupFile: file });
    await rollbackMigration(db, readBackup(file));
    expect(await db.collection('users').findOne({ _id: spocId })).toEqual(before);
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
