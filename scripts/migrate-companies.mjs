#!/usr/bin/env node
// Moves company identity from the free-text `organizationName` field to Company records.
//
//   node scripts/migrate-companies.mjs [--env <file>]              dry run (default, writes nothing)
//   node scripts/migrate-companies.mjs [--env <file>] --apply --yes    expand: add companyId etc., keep old fields
//   node scripts/migrate-companies.mjs [--env <file>] --cleanup --yes  contract: remove organizationName / organizationLogo
//   node scripts/migrate-companies.mjs [--env <file>] --rollback <backup.json> --yes
//
// Works on raw collections so it never depends on the app's current schemas.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { toNameKey } from '../src/lib/companyName.mjs';

const CORPORATE = ['org_spoc', 'org_member'];
const { EJSON } = mongoose.mongo.BSON;
const hasText = (v) => typeof v === 'string' && v.trim() !== '';

export function parseArgs(argv) {
  const args = { env: '.env.local', mode: 'plan', yes: false, rollbackFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') args.env = argv[++i];
    else if (a === '--apply') args.mode = 'apply';
    else if (a === '--cleanup') args.mode = 'cleanup';
    else if (a === '--rollback') { args.mode = 'rollback'; args.rollbackFile = argv[++i]; }
    else if (a === '--yes') args.yes = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

// Companies come from SPOC/employee names and from private events (so an event
// whose SPOC was deleted stays private). Attendance only joins existing groups.
export async function planMigration(db) {
  const users = await db.collection('users').find({ organizationName: { $exists: true } })
    .project({ role: 1, organizationName: 1 }).toArray();
  const events = await db.collection('events').find({ organizationName: { $exists: true } })
    .project({ organizationName: 1 }).toArray();
  const attendances = await db.collection('attendances').find({ organizationName: { $exists: true } })
    .project({ organizationName: 1 }).toArray();

  const groups = new Map();
  const add = (name, field) => {
    const key = toNameKey(name);
    if (!groups.has(key)) groups.set(key, { key, variants: new Map(), users: 0, events: 0, attendance: 0 });
    const g = groups.get(key);
    g[field] += 1;
    g.variants.set(name, (g.variants.get(name) || 0) + 1);
  };

  let ngoUsers = 0;
  let volunteerUsers = 0;
  for (const u of users) {
    if (!hasText(u.organizationName)) continue;
    if (CORPORATE.includes(u.role)) add(u.organizationName, 'users');
    else if (u.role === 'ngo') ngoUsers += 1;
    else if (u.role === 'volunteer') volunteerUsers += 1;
  }
  for (const e of events) if (hasText(e.organizationName)) add(e.organizationName, 'events');

  const unmatched = new Map();
  for (const a of attendances) {
    if (!hasText(a.organizationName)) continue;
    const g = groups.get(toNameKey(a.organizationName));
    if (g) g.attendance += 1;
    else unmatched.set(a.organizationName, (unmatched.get(a.organizationName) || 0) + 1);
  }

  return {
    groups: [...groups.values()].map((g) => {
      const variants = [...g.variants.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
      return { key: g.key, name: variants[0].name.trim(), variants, users: g.users, events: g.events, attendance: g.attendance };
    }).sort((x, y) => x.name.localeCompare(y.name)),
    unmatched: [...unmatched.entries()].map(([name, count]) => ({ name, count })),
    ngoUsers,
    volunteerUsers,
  };
}

// Distinct organizationName values in `col` that belong to a planned company.
async function matchedNames(col, keys, extraFilter = {}) {
  const names = await col.distinct('organizationName', extraFilter);
  return names.filter((n) => hasText(n) && keys.has(toNameKey(n)));
}

function writeBackup(file, backup) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, EJSON.stringify(backup, { relaxed: false }, 2));
}

export function readBackup(file) {
  return EJSON.parse(fs.readFileSync(file, 'utf8'), { relaxed: false });
}

export async function applyMigration(db, { backupFile = null, now = new Date() } = {}) {
  const plan = await planMigration(db);
  const keys = new Set(plan.groups.map((g) => g.key));
  const users = db.collection('users');
  const events = db.collection('events');
  const attendances = db.collection('attendances');
  const companies = db.collection('companies');
  await companies.createIndex({ nameKey: 1 }, { unique: true });

  const userNames = await matchedNames(users, keys, { role: { $in: CORPORATE } });
  const eventNames = await matchedNames(events, keys);
  const attendanceNames = await matchedNames(attendances, keys);
  const ngoFilter = { role: 'ngo', organizationName: { $exists: true, $nin: [null, ''] }, ngoName: { $in: [null, ''] } };
  const volunteerFilter = { role: 'volunteer', organizationName: { $exists: true, $nin: [null, ''] }, employerName: { $in: [null, ''] } };

  // 1. Back up every document this run will change (before changing anything).
  const backup = {
    kind: 'apply',
    createdAt: now.toISOString(),
    users: await users.find({ $or: [
      { role: { $in: CORPORATE }, organizationName: { $in: userNames }, companyId: null },
      ngoFilter,
      volunteerFilter,
    ] }).toArray(),
    events: await events.find({ organizationName: { $in: eventNames }, companyId: null }).toArray(),
    attendances: await attendances.find({ organizationName: { $in: attendanceNames }, companyId: null }).toArray(),
    createdCompanyIds: [],
  };
  // The backup file must exist before the first company is inserted, so a crash
  // part-way through still leaves a file that lists what to roll back.
  if (backupFile) writeBackup(backupFile, backup);

  // 2. One company per group (reuse an existing one with the same nameKey).
  const idByKey = new Map();
  let companiesReused = 0;
  for (const g of plan.groups) {
    const existing = await companies.findOne({ nameKey: g.key });
    if (existing) {
      idByKey.set(g.key, existing._id);
      companiesReused += 1;
      continue;
    }
    const logoSpoc = await users.find({
      role: 'org_spoc',
      organizationName: { $in: g.variants.map((v) => v.name) },
      organizationLogo: { $exists: true, $nin: [null, ''] },
    }).sort({ updatedAt: -1 }).limit(1).next();
    const { insertedId } = await companies.insertOne({
      name: g.name,
      nameKey: g.key,
      logoUrl: logoSpoc?.organizationLogo || '',
      status: 'active',
      createdBy: null,
      createdAt: now,
      updatedAt: now,
    });
    idByKey.set(g.key, insertedId);
    backup.createdCompanyIds.push(insertedId);
    if (backupFile) writeBackup(backupFile, backup);
  }

  // 3. Link records; companyId: null matches both null and missing, so re-runs skip linked docs.
  const link = async (col, names, extraFilter = {}) => {
    let modified = 0;
    for (const name of names) {
      const companyId = idByKey.get(toNameKey(name));
      const r = await col.updateMany({ ...extraFilter, organizationName: name, companyId: null }, { $set: { companyId } });
      modified += r.modifiedCount;
    }
    return modified;
  };

  const linkedUsers = await link(users, userNames, { role: { $in: CORPORATE } });
  const linkedEvents = await link(events, eventNames);
  const linkedAttendances = await link(attendances, attendanceNames);
  const ngo = await users.updateMany(ngoFilter, [{ $set: { ngoName: '$organizationName' } }]);
  const vol = await users.updateMany(volunteerFilter, [{ $set: { employerName: '$organizationName' } }]);

  return {
    companiesCreated: backup.createdCompanyIds.length,
    companiesReused,
    users: linkedUsers,
    events: linkedEvents,
    attendances: linkedAttendances,
    ngoNames: ngo.modifiedCount,
    employerNames: vol.modifiedCount,
  };
}

export async function cleanupMigration(db, { backupFile = null, now = new Date() } = {}) {
  const users = db.collection('users');
  const events = db.collection('events');
  const attendances = db.collection('attendances');

  const unlinked = await users.countDocuments({ role: { $in: CORPORATE }, companyId: null });
  if (unlinked > 0) throw new Error(`Refusing cleanup: ${unlinked} SPOC/employee accounts have no companyId. Run --apply first.`);
  const leaking = await events.countDocuments({ organizationName: { $exists: true, $nin: [null, ''] }, companyId: null });
  if (leaking > 0) throw new Error(`Refusing cleanup: ${leaking} private events have no companyId and would become public. Run --apply first.`);

  // The old deployment keeps writing organizationName during the expand window, so
  // records created after --apply can still depend on the old fields.
  const nonEmpty = { $exists: true, $nin: [null, ''] };
  const ngoMissing = await users.countDocuments({ role: 'ngo', organizationName: nonEmpty, ngoName: { $in: [null, ''] } });
  if (ngoMissing > 0) throw new Error(`Refusing cleanup: ${ngoMissing} NGO accounts have an organizationName but no ngoName. Run --apply again first.`);
  const volunteerMissing = await users.countDocuments({ role: 'volunteer', organizationName: nonEmpty, employerName: { $in: [null, ''] } });
  if (volunteerMissing > 0) throw new Error(`Refusing cleanup: ${volunteerMissing} volunteer accounts have an organizationName but no employerName. Run --apply again first.`);
  // Only names apply can actually link (planned groups) count; an unrelated company
  // created later in the UI must not block cleanup forever.
  const companyKeys = new Set((await planMigration(db)).groups.map((g) => g.key));
  const pendingNames = (await attendances.distinct('organizationName', { companyId: null }))
    .filter((n) => hasText(n) && companyKeys.has(toNameKey(n)));
  const attendanceUnlinked = pendingNames.length
    ? await attendances.countDocuments({ organizationName: { $in: pendingNames }, companyId: null })
    : 0;
  if (attendanceUnlinked > 0) throw new Error(`Refusing cleanup: ${attendanceUnlinked} attendance records match a company but have no companyId. Run --apply again first.`);

  const hasOld = { $or: [{ organizationName: { $exists: true } }, { organizationLogo: { $exists: true } }] };
  if (backupFile) {
    writeBackup(backupFile, {
      kind: 'cleanup',
      createdAt: now.toISOString(),
      users: await users.find(hasOld).toArray(),
      events: await events.find({ organizationName: { $exists: true } }).toArray(),
      attendances: await attendances.find({ organizationName: { $exists: true } }).toArray(),
      createdCompanyIds: [],
    });
  }

  const u = await users.updateMany(hasOld, { $unset: { organizationName: '', organizationLogo: '' } });
  const e = await events.updateMany({ organizationName: { $exists: true } }, { $unset: { organizationName: '' } });
  const a = await attendances.updateMany({ organizationName: { $exists: true } }, { $unset: { organizationName: '' } });
  try { await attendances.dropIndex('organizationName_1'); } catch { /* index already gone */ }
  return { users: u.modifiedCount, events: e.modifiedCount, attendances: a.modifiedCount };
}

export async function rollbackMigration(db, backup) {
  for (const [name, docs] of [['users', backup.users], ['events', backup.events], ['attendances', backup.attendances]]) {
    for (const doc of docs) await db.collection(name).replaceOne({ _id: doc._id }, doc);
  }
  if (backup.createdCompanyIds?.length) {
    await db.collection('companies').deleteMany({ _id: { $in: backup.createdCompanyIds } });
  }
}

// host/dbname, so the operator sees which database a run will touch.
function targetOf(uri) {
  const u = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:'));
  return `${u.host}/${u.pathname.replace(/^\//, '') || '(default)'}`;
}

export async function main(argv) {
  const args = parseArgs(argv);
  // override: --env must win over a MONGODB_URI already in the shell environment.
  dotenv.config({ path: args.env, override: true });
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is not set in ${args.env}`);
  console.log(`Target database: ${targetOf(uri)} (from ${args.env})`);
  if (args.mode !== 'plan' && !args.yes) {
    throw new Error(`--${args.mode} writes to ${targetOf(uri)}. Re-run with --yes to confirm.`);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups');

  if (args.mode === 'plan') {
    const plan = await planMigration(db);
    console.log(`\nProposed companies (${plan.groups.length}):`);
    for (const g of plan.groups) {
      console.log(`  ${g.name}  [users ${g.users}, events ${g.events}, attendance ${g.attendance}]`);
      if (g.variants.length > 1) console.log(`    merges: ${g.variants.map((v) => `"${v.name}" ×${v.count}`).join(', ')}`);
    }
    if (plan.unmatched.length) {
      console.log('\nAttendance names with no company (left unassigned):');
      for (const u of plan.unmatched) console.log(`  "${u.name}" ×${u.count}`);
    }
    console.log(`\nNGO users moving to ngoName: ${plan.ngoUsers}`);
    console.log(`Volunteers moving to employerName: ${plan.volunteerUsers}`);
    console.log('\nNothing was written. Re-run with --apply --yes to apply.');
  } else if (args.mode === 'apply') {
    const backupFile = path.join(backupDir, `migrate-companies-apply-${stamp}.json`);
    console.log(await applyMigration(db, { backupFile }));
    console.log(`Backup: ${backupFile}`);
  } else if (args.mode === 'cleanup') {
    const backupFile = path.join(backupDir, `migrate-companies-cleanup-${stamp}.json`);
    console.log(await cleanupMigration(db, { backupFile }));
    console.log(`Backup: ${backupFile}`);
  } else if (args.mode === 'rollback') {
    await rollbackMigration(db, readBackup(args.rollbackFile));
    console.log(`Restored from ${args.rollbackFile}`);
  }
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(() => process.exit(0)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
