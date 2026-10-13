#!/usr/bin/env node
// Moves company identity from the free-text `organizationName` field to Company records.
//
//   node scripts/migrate-companies.mjs [--env <file>]              dry run (default, writes nothing)
//   node scripts/migrate-companies.mjs [--env <file>] --apply --yes    expand: add companyId etc., keep old fields
//   node scripts/migrate-companies.mjs [--env <file>] --cleanup --yes  contract: remove organizationName / organizationLogo
//   node scripts/migrate-companies.mjs [--env <file>] --rollback <backup.json> --yes
//   node scripts/migrate-companies.mjs [--env <file>] --backfill-legacy --yes
//       rollback helper: writes organizationName / organizationLogo back from the
//       Company records; run it before redeploying the previous code and again
//       right after it is live. Exits non-zero if a record's company is missing.
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
const BLANK_STRING = { $type: 'string', $not: /\S/ }; // '' or whitespace only
const SPOC_STATUSES = ['approved', 'pending', 'rejected'];

// Records apply can never link: corporate accounts with no usable name, and
// events whose name is blank but not null (the old code did not treat those as public).
const UNLINKABLE_USERS = { role: { $in: CORPORATE }, companyId: null, organizationName: BLANK };
const UNLINKABLE_EVENTS = { companyId: null, organizationName: BLANK_STRING };

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
    .project({ role: 1, organizationName: 1, status: 1 }).toArray();
  const events = await db.collection('events').find({ organizationName: { $exists: true } })
    .project({ organizationName: 1 }).toArray();
  const attendances = await db.collection('attendances').find({ organizationName: { $exists: true } })
    .project({ organizationName: 1 }).toArray();

  const groups = new Map();
  const add = (name, field) => {
    const key = toNameKey(name);
    if (!groups.has(key)) {
      const spocStatus = Object.fromEntries(SPOC_STATUSES.map((st) => [st, 0]));
      groups.set(key, { key, variants: new Map(), users: 0, events: 0, attendance: 0, spocStatus });
    }
    const g = groups.get(key);
    g[field] += 1;
    g.variants.set(name, (g.variants.get(name) || 0) + 1);
    return g;
  };

  let ngoUsers = 0;
  let volunteerUsers = 0;
  for (const u of users) {
    if (!hasText(u.organizationName)) continue;
    if (CORPORATE.includes(u.role)) {
      const g = add(u.organizationName, 'users');
      if (u.role === 'org_spoc') {
        const st = u.status || 'unknown';
        g.spocStatus[st] = (g.spocStatus[st] || 0) + 1;
      }
    }
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
      return { key: g.key, name: variants[0].name.trim(), variants, users: g.users, events: g.events, attendance: g.attendance, spocStatus: g.spocStatus };
    }).sort((x, y) => x.name.localeCompare(y.name)),
    unmatched: [...unmatched.entries()].map(([name, count]) => ({ name, count })),
    ngoUsers,
    volunteerUsers,
    unlinkable: {
      users: await db.collection('users').find(UNLINKABLE_USERS).project({ username: 1 }).toArray(),
      events: await db.collection('events').find(UNLINKABLE_EVENTS).project({ title: 1 }).toArray(),
    },
  };
}

// Dry-run report, one line per array entry.
export function formatPlan(plan) {
  const out = [`Proposed companies (${plan.groups.length}):`];
  for (const g of plan.groups) {
    out.push(`  ${g.name}  [users ${g.users}, events ${g.events}, attendance ${g.attendance}]`);
    const st = g.spocStatus || {};
    const extra = Object.keys(st).filter((k) => !SPOC_STATUSES.includes(k)).map((k) => `, ${st[k]} ${k}`).join('');
    out.push(`    SPOCs: ${st.approved || 0} approved, ${st.pending || 0} pending, ${st.rejected || 0} rejected${extra}`);
    if (g.variants.length > 1) out.push(`    merges: ${g.variants.map((v) => `"${v.name}" ×${v.count}`).join(', ')}`);
  }
  if (plan.unmatched.length) {
    out.push('', 'Attendance names with no company (left unassigned unless the attendee is linked):');
    for (const u of plan.unmatched) out.push(`  "${u.name}" ×${u.count}`);
  }
  const { users = [], events = [] } = plan.unlinkable || {};
  if (users.length) {
    out.push('', `SPOC/employee accounts with no company name (cannot be linked; assign a company or change the role) (${users.length}):`);
    for (const u of users) out.push(`  ${u._id} ${u.username}`);
  }
  if (events.length) {
    out.push('', `Events with a blank organizationName (cannot be linked; assign a company or set it to null to make them public) (${events.length}):`);
    for (const e of events) out.push(`  ${e._id} "${e.title}"`);
  }
  out.push('', `NGO users moving to ngoName: ${plan.ngoUsers}`);
  out.push(`Volunteers moving to employerName: ${plan.volunteerUsers}`);
  return out;
}

const MAX_LISTED = 20;
const listIds = (docs, label) => {
  const shown = docs.slice(0, MAX_LISTED).map((d) => `${d._id} (${d[label]})`).join(', ');
  return docs.length > MAX_LISTED ? `${shown}, and ${docs.length - MAX_LISTED} more` : shown;
};

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

// String ids from `ids` that have a Company document.
async function existingCompanyIds(db, ids) {
  if (!ids.length) return new Set();
  const found = await db.collection('companies').find({ _id: { $in: ids.map(asId) } }).project({ _id: 1 }).toArray();
  return new Set(found.map((c) => String(c._id)));
}

const RECORD_COLLECTIONS = ['users', 'events', 'attendances'];

// Every companyId on users, events and attendance that has no Company document,
// with how many records point at each: [{ companyId, records }].
async function danglingCompanyRefs(db) {
  const counts = new Map();
  for (const name of RECORD_COLLECTIONS) {
    const rows = await db.collection(name).aggregate([
      { $match: { companyId: { $ne: null } } },
      { $group: { _id: '$companyId', n: { $sum: 1 } } },
    ]).toArray();
    for (const { _id, n } of rows) counts.set(String(_id), (counts.get(String(_id)) || 0) + n);
  }
  const known = await existingCompanyIds(db, [...counts.keys()]);
  return [...counts.entries()]
    .filter(([id]) => !known.has(id))
    .map(([id, records]) => ({ companyId: asId(id), records }));
}

// nameKey of organizationName -> Set of companyId strings, from records that
// carry both (linked by an earlier run, or written back by --backfill-legacy).
// Ids with no Company document (e.g. deleted by a rollback) are dropped, so a
// re-run never links a record to a company that does not exist.
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
  const known = await existingCompanyIds(db, [...new Set([...map.values()].flatMap((s) => [...s]))]);
  for (const [key, ids] of map) {
    for (const id of ids) if (!known.has(id)) ids.delete(id);
    if (!ids.size) map.delete(key);
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
  const ngoFilter = { role: 'ngo', organizationName: TEXT, ngoName: BLANK };
  const volunteerFilter = { role: 'volunteer', organizationName: TEXT, employerName: BLANK };

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

  // A companyId with no Company is as good as none: once the old fields are gone
  // nothing says which company the record belonged to.
  const dangling = await danglingCompanyRefs(db);
  if (dangling.length) {
    const total = dangling.reduce((sum, d) => sum + d.records, 0);
    const shown = dangling.slice(0, MAX_LISTED).map((d) => `${d.companyId} (${d.records} records)`).join(', ');
    const more = dangling.length > MAX_LISTED ? `, and ${dangling.length - MAX_LISTED} more` : '';
    throw new Error(`Refusing cleanup: ${total} records point at companies that no longer exist: ${shown}${more}. `
      + 'Before cleanup, restore those companies or re-link the records to an existing company.');
  }

  const nameless = await users.find(UNLINKABLE_USERS).project({ username: 1 }).toArray();
  if (nameless.length) {
    throw new Error(`Refusing cleanup: ${nameless.length} SPOC/employee accounts have no company name and no companyId, so --apply cannot link them. `
      + `For each, assign a company or change the role: ${listIds(nameless, 'username')}`);
  }
  const unlinked = await users.find({ role: { $in: CORPORATE }, companyId: null }).project({ username: 1 }).toArray();
  if (unlinked.length) {
    throw new Error(`Refusing cleanup: ${unlinked.length} SPOC/employee accounts have no companyId. Run --apply again; `
      + `if they stay unlinked, assign a company or change the role: ${listIds(unlinked, 'username')}`);
  }
  const blankEvents = await events.find(UNLINKABLE_EVENTS).project({ title: 1 }).toArray();
  if (blankEvents.length) {
    throw new Error(`Refusing cleanup: ${blankEvents.length} events have a blank organizationName and no companyId, so they would become public. `
      + `For each, assign a company or set organizationName to null to make it public: ${listIds(blankEvents, 'title')}`);
  }
  const leaking = await events.find({ organizationName: TEXT, companyId: null }).project({ title: 1 }).toArray();
  if (leaking.length) {
    throw new Error(`Refusing cleanup: ${leaking.length} private events have no companyId and would become public. Run --apply again first: ${listIds(leaking, 'title')}`);
  }

  // The old deployment keeps writing organizationName during the expand window, so
  // records created after --apply can still depend on the old fields.
  const ngoMissing = await users.countDocuments({ role: 'ngo', organizationName: TEXT, ngoName: BLANK });
  if (ngoMissing > 0) throw new Error(`Refusing cleanup: ${ngoMissing} NGO accounts have an organizationName but no ngoName. Run --apply again first.`);
  const volunteerMissing = await users.countDocuments({ role: 'volunteer', organizationName: TEXT, employerName: BLANK });
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
  const counts = { users: 0, events: 0, attendances: 0, logos: 0, placeholders: 0, missingCompanies: 0 };
  // Fail closed: a record whose company is gone still gets a name, one per missing
  // company so the old code never groups two lost companies together. Otherwise
  // an internal event would match the old public filter.
  const named = [
    ...companies.map((c) => ({ companyId: c._id, name: c.name, logoUrl: c.logoUrl })),
    ...(await danglingCompanyRefs(db)).map((d) => ({ companyId: d.companyId, name: placeholderName(d.companyId), logoUrl: '' })),
  ];
  for (const c of named) {
    const byCompany = { companyId: c.companyId };
    counts.users += (await users.updateMany({ ...userFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    counts.events += (await events.updateMany({ ...eventFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    counts.attendances += (await attendances.updateMany({ ...eventFilter, ...byCompany }, { $set: { organizationName: c.name } })).modifiedCount;
    if (hasText(c.logoUrl)) {
      counts.logos += (await users.updateMany({ ...logoFilter, ...byCompany }, { $set: { organizationLogo: c.logoUrl } })).modifiedCount;
    }
  }
  // Counted from the data, not from this run's writes, so a re-run still reports them.
  const dangling = await danglingCompanyRefs(db);
  counts.missingCompanies = dangling.length;
  counts.missingCompanyIds = dangling.map((d) => String(d.companyId));
  for (const d of dangling) {
    const filter = { companyId: d.companyId, organizationName: placeholderName(d.companyId) };
    for (const name of RECORD_COLLECTIONS) counts.placeholders += await db.collection(name).countDocuments(filter);
  }
  return counts;
}

const placeholderName = (companyId) => `Unknown company (${companyId})`;

// Why a backfill run must not count as a success, or null.
export function backfillFailure(res) {
  if (!res.placeholders) return null;
  return `${res.placeholders} records point at ${res.missingCompanies} missing ${res.missingCompanies === 1 ? 'company' : 'companies'} `
    + `(${res.missingCompanyIds.join(', ')}) and carry the placeholder "Unknown company (<id>)", so the old code keeps them private. `
    + 'Restore those companies or re-link the records, then run --backfill-legacy --yes again.';
}

export function formatRollback(res) {
  const out = res.kept.map((c) => `Company "${c.name}" (${c._id}) kept (still referenced by ${c.references} records)`);
  out.push(`Deleted ${res.deleted} created companies.`);
  return out;
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
      // Cleanup only removed fields, so undoing it only puts back the ones it removed.
      if (backup.kind === 'cleanup') for (const f of Object.keys($unset)) delete $unset[f];
      // Apply set companyId only where the backup had none; a companyId that was
      // already there was never touched, so it is left alone.
      if (backup.kind === 'apply' && doc.companyId == null) $unset.companyId = '';
      const update = {};
      if (Object.keys($set).length) update.$set = $set;
      if (Object.keys($unset).length) update.$unset = $unset;
      if (Object.keys(update).length) await col.updateOne({ _id: doc._id }, update);
    }
  }
  const result = { deleted: 0, kept: [] };
  if (backup.kind === 'apply' && backup.createdCompanyIds?.length) {
    // Never delete a company that something outside this backup still points at
    // (records the new code wrote after the deploy, NGO partner cards): those
    // records would be left with a companyId that resolves to nothing.
    const created = backup.createdCompanyIds.map(asId);
    const references = new Map();
    const count = (id, n) => references.set(String(id), (references.get(String(id)) || 0) + n);
    for (const [name, docs] of [['users', backup.users], ['events', backup.events], ['attendances', backup.attendances]]) {
      const rows = await db.collection(name).aggregate([
        { $match: { companyId: { $in: created }, _id: { $nin: (docs || []).map((d) => d._id) } } },
        { $group: { _id: '$companyId', n: { $sum: 1 } } },
      ]).toArray();
      for (const { _id, n } of rows) count(_id, n);
    }
    const cards = await db.collection('ngopartners').aggregate([
      { $match: { companyIds: { $in: created } } },
      { $unwind: '$companyIds' },
      { $match: { companyIds: { $in: created } } },
      { $group: { _id: '$companyIds', n: { $sum: 1 } } },
    ]).toArray();
    for (const { _id, n } of cards) count(_id, n);

    const keep = created.filter((id) => references.has(String(id)));
    const companies = await db.collection('companies').find({ _id: { $in: keep } }).project({ name: 1 }).toArray();
    result.kept = companies.map((c) => ({ _id: c._id, name: c.name, references: references.get(String(c._id)) }));
    const remove = created.filter((id) => !references.has(String(id)));
    if (remove.length) result.deleted = (await db.collection('companies').deleteMany({ _id: { $in: remove } })).deletedCount;
  }
  return result;
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
    throw new Error(`--${args.mode === 'backfill' ? 'backfill-legacy' : args.mode} writes to ${targetOf(uri)}. Re-run with --yes to confirm.`);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve('backups');
  let failure = null;

  if (args.mode === 'plan') {
    console.log(`\n${formatPlan(await planMigration(db)).join('\n')}`);
    console.log('\nNothing was written. Re-run with --apply --yes to apply.');
  } else if (args.mode === 'apply') {
    const backupFile = path.join(backupDir, `migrate-companies-apply-${stamp}.json`);
    const res = await applyMigration(db, { backupFile });
    console.log(res);
    for (const a of res.ambiguous) {
      console.log(`NOT LINKED: "${a.name}" is already linked to more than one company (${a.companyIds.join(', ')}). Link these records by hand.`);
    }
    console.log(`Backup: ${backupFile}`);
  } else if (args.mode === 'cleanup') {
    const backupFile = path.join(backupDir, `migrate-companies-cleanup-${stamp}.json`);
    console.log(await cleanupMigration(db, { backupFile }));
    console.log(`Backup: ${backupFile}`);
  } else if (args.mode === 'backfill') {
    const backupFile = path.join(backupDir, `migrate-companies-backfill-${stamp}.json`);
    const res = await backfillLegacy(db, { backupFile });
    console.log(`Backfilled organizationName on ${res.users} users, ${res.events} events and ${res.attendances} attendance records; organizationLogo on ${res.logos} SPOCs.`);
    console.log(`Backup: ${backupFile}`);
    failure = backfillFailure(res);
  } else if (args.mode === 'rollback') {
    const res = await rollbackMigration(db, readBackup(args.rollbackFile));
    for (const line of formatRollback(res)) console.log(line);
    console.log(`Restored from ${args.rollbackFile}`);
  }
  await mongoose.disconnect();
  // Thrown after the writes, so the run exits non-zero but its work (and backup) stays.
  if (failure) throw new Error(failure);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(() => process.exit(0)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
