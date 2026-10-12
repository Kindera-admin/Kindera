#!/usr/bin/env node
// Moves company identity from the free-text `organizationName` field to Company records.
//
//   node scripts/migrate-companies.mjs [--env <file>]              dry run (default, writes nothing)
//   node scripts/migrate-companies.mjs [--env <file>] --apply --yes    expand: add companyId etc., keep old fields
//   node scripts/migrate-companies.mjs [--env <file>] --cleanup --yes  contract: remove organizationName / organizationLogo
//   node scripts/migrate-companies.mjs [--env <file>] --rollback <backup.json> --yes
//   node scripts/migrate-companies.mjs [--env <file>] --backfill-legacy --yes
//       rollback helper: writes organizationName / organizationLogo back from the
//       Company records; run it before redeploying the previous code
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
// Query forms of hasText, so the queries and the in-memory grouping agree on "blank".
const TEXT = { $regex: /\S/ };
const BLANK = { $not: /\S/ }; // missing, null, '' or whitespace only

export function parseArgs(argv) {
  const args = { env: '.env.local', mode: 'plan', yes: false, rollbackFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env') args.env = argv[++i];
    else if (a === '--apply') args.mode = 'apply';
    else if (a === '--cleanup') args.mode = 'cleanup';
    else if (a === '--backfill-legacy') args.mode = 'backfill';
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

// _ids of SPOCs/employees matching `userFilter` who have attendance with no companyId.
async function corporateAttendees(db, userFilter) {
  const userIds = await db.collection('attendances').distinct('userId', { companyId: null });
  if (!userIds.length) return [];
  return db.collection('users').distinct('_id', { _id: { $in: userIds }, role: { $in: CORPORATE }, ...userFilter });
}

const asId = (id) => new mongoose.Types.ObjectId(String(id));

// nameKey of organizationName -> Set of companyId strings, from records that
// carry both (linked by an earlier run, or written back by --backfill-legacy).
async function linkedCompanyIdsByKey(db) {
  const map = new Map();
  const filter = { companyId: { $ne: null }, organizationName: TEXT };
  for (const [name, extra] of [['users', { role: { $in: CORPORATE } }], ['events', {}], ['attendances', {}]]) {
    const rows = await db.collection(name).aggregate([
      { $match: { ...extra, ...filter } },
      { $group: { _id: { name: '$organizationName', companyId: '$companyId' } } },
    ]).toArray();
    for (const { _id } of rows) {
      const key = toNameKey(_id.name);
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(String(_id.companyId));
    }
  }
  return map;
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

  // Unlinked attendance of corporate users who are linked, or will be by this run
  // (e.g. rows an admin marked as "All Organizations"), takes the attendee's company.
  const attendeeIds = await corporateAttendees(db, { $or: [{ companyId: { $ne: null } }, { organizationName: { $in: userNames } }] });

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
    attendances: await attendances.find({ companyId: null, $or: [
      { organizationName: { $in: attendanceNames } },
      { userId: { $in: attendeeIds } },
    ] }).toArray(),
    createdCompanyIds: [],
  };
  // The backup file must exist before the first company is inserted, so a crash
  // part-way through still leaves a file that lists what to roll back.
  if (backupFile) writeBackup(backupFile, backup);

  // 2. One company per group. A company may have been renamed since an earlier
  // run, so first follow the links earlier runs made (old name -> companyId);
  // then reuse a company with the same nameKey; otherwise create one.
  const linkedIds = await linkedCompanyIdsByKey(db);
  const idByKey = new Map();
  const ambiguous = [];
  let companiesReused = 0;
  for (const g of plan.groups) {
    const linkedTo = linkedIds.get(g.key);
    if (linkedTo && linkedTo.size > 1) {
      // Fail closed: the same old name already points at two companies, so
      // nothing new is linked for it. The cleanup guard keeps blocking.
      ambiguous.push({ key: g.key, name: g.name, companyIds: [...linkedTo] });
      continue;
    }
    if (linkedTo) {
      idByKey.set(g.key, asId([...linkedTo][0]));
      companiesReused += 1;
      continue;
    }
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
      if (!companyId) continue;
      const r = await col.updateMany({ ...extraFilter, organizationName: name, companyId: null }, { $set: { companyId } });
      modified += r.modifiedCount;
    }
    return modified;
  };

  const linkedUsers = await link(users, userNames, { role: { $in: CORPORATE } });
  const linkedEvents = await link(events, eventNames);
  let linkedAttendances = await link(attendances, attendanceNames);
  const attendees = await users.find({ _id: { $in: attendeeIds }, companyId: { $ne: null } }).project({ companyId: 1 }).toArray();
  for (const u of attendees) {
    linkedAttendances += (await attendances.updateMany({ userId: u._id, companyId: null }, { $set: { companyId: u.companyId } })).modifiedCount;
  }
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
    ambiguous,
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
  const linkedAttendees = await corporateAttendees(db, { companyId: { $ne: null } });
  const viaAttendee = linkedAttendees.length
    ? await attendances.countDocuments({ userId: { $in: linkedAttendees }, companyId: null })
    : 0;
  if (viaAttendee > 0) throw new Error(`Refusing cleanup: ${viaAttendee} attendance records belong to a linked SPOC/employee but have no companyId. Run --apply again first.`);

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

// Rollback step: the previous deployment only reads organizationName /
// organizationLogo, so before redeploying it, write them back from the Company
// records. Without this an internal event created by the new code (companyId
// only) matches the old public filter (organizationName null or missing).
export async function backfillLegacy(db, { backupFile = null, now = new Date() } = {}) {
  const users = db.collection('users');
  const events = db.collection('events');
  const attendances = db.collection('attendances');
  const linked = { companyId: { $ne: null } };
  const userFilter = { role: { $in: CORPORATE }, ...linked, organizationName: BLANK };
  const eventFilter = { ...linked, organizationName: BLANK };
  const logoFilter = { role: 'org_spoc', ...linked, organizationLogo: BLANK };

  const backup = {
    kind: 'backfill',
    createdAt: now.toISOString(),
    users: await users.find({ $or: [userFilter, logoFilter] }).toArray(),
    events: await events.find(eventFilter).toArray(),
    attendances: await attendances.find(eventFilter).toArray(),
    createdCompanyIds: [],
  };
  if (backupFile) writeBackup(backupFile, backup);

  const ids = [...backup.users, ...backup.events, ...backup.attendances].map((d) => d.companyId);
  const companies = await db.collection('companies').find({ _id: { $in: ids } }).toArray();
  const counts = { users: 0, events: 0, attendances: 0, logos: 0, missingCompanies: 0 };
  const known = new Set(companies.map((c) => String(c._id)));
  counts.missingCompanies = new Set(ids.map(String).filter((id) => !known.has(id))).size;
  for (const c of companies) {
    const byCompany = { companyId: c._id };
    counts.users += (await users.updateMany({ ...userFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    counts.events += (await events.updateMany({ ...eventFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    counts.attendances += (await attendances.updateMany({ ...eventFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    if (hasText(c.logoUrl)) {
      counts.logos += (await users.updateMany({ ...logoFilter, ...byCompany }, { $set: { organizationLogo: c.logoUrl } })).modifiedCount;
    }
  }
  return counts;
}

// Which fields each backup kind may put back. Rollback never replaces whole
// documents: anything else (hours, registrations, titles) may have changed since
// the backup and must survive.
const ROLLBACK_FIELDS = {
  apply: ['ngoName', 'employerName'],
  cleanup: ['organizationName', 'organizationLogo'],
  backfill: ['organizationName', 'organizationLogo'],
};

// $set each field to its backed-up value, or $unset it if the backup did not have it.
function restoreFields(doc, fields) {
  const $set = {};
  const $unset = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(doc, f)) $set[f] = doc[f];
    else $unset[f] = '';
  }
  return { $set, $unset };
}

export async function rollbackMigration(db, backup) {
  const fields = ROLLBACK_FIELDS[backup?.kind];
  if (!fields) throw new Error(`Unknown backup kind: ${backup?.kind}. Nothing was restored.`);
  for (const [name, docs] of [['users', backup.users], ['events', backup.events], ['attendances', backup.attendances]]) {
    const col = db.collection(name);
    for (const doc of docs || []) {
      const { $set, $unset } = restoreFields(doc, name === 'users' ? fields : fields.filter((f) => f === 'organizationName'));
      // Apply set companyId only where the backup had none; a companyId that was
      // already there was never touched, so it is left alone.
      if (backup.kind === 'apply' && doc.companyId == null) $unset.companyId = '';
      const update = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($unset).length) update.$unset = $unset;
      if (Object.keys(update).length) await col.updateOne({ _id: doc._id }, update);
    }
  }
  if (backup.kind === 'apply' && backup.createdCompanyIds?.length) {
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
  } else if (args.mode === 'backfill') {
    const backupFile = path.join(backupDir, `migrate-companies-backfill-${stamp}.json`);
    const res = await backfillLegacy(db, { backupFile });
    console.log(`Backfilled organizationName on ${res.users} users, ${res.events} events and ${res.attendances} attendance records; organizationLogo on ${res.logos} SPOCs.`);
    if (res.missingCompanies) console.log(`Skipped records pointing at ${res.missingCompanies} missing companies.`);
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
