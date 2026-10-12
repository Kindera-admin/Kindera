#!/usr/bin/env node
// Creates (or with --remove deletes) clearly prefixed QA accounts in the TEST database only.
//   node scripts/seed-qa.mjs          create
//   node scripts/seed-qa.mjs --remove delete the QA accounts and everything tied to them
// Passwords are written to backups/qa-accounts.json (gitignored), never printed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { toNameKey } from '../src/lib/companyName.mjs';

const TEST_HOST_SUFFIX = '.2a5vud1.mongodb.net';
const PREFIX = 'qa-';
const QA_COMPANIES = ['QA Company A', 'QA Company B'];

// Only a URI whose host is under the test cluster. The cluster id appearing
// anywhere else (user name, database, query string) does not count, and a URI
// that does not parse, or lists several hosts, is refused.
export function isTestClusterUri(uri) {
  if (typeof uri !== 'string' || uri === '') return false;
  let url;
  try {
    url = new URL(uri);
  } catch {
    return false;
  }
  if (url.protocol !== 'mongodb:' && url.protocol !== 'mongodb+srv:') return false;
  return url.hostname.toLowerCase().endsWith(TEST_HOST_SUFFIX);
}

export async function seedQa(db, { credsFile = path.join('backups', 'qa-accounts.json'), log = console.log } = {}) {
  const users = db.collection('users');
  const companies = db.collection('companies');
  const now = new Date();
  const company = async (name) => (await companies.findOneAndUpdate(
    { nameKey: toNameKey(name) },
    { $setOnInsert: { name, nameKey: toNameKey(name), logoUrl: '', status: 'active', createdBy: null, createdAt: now, updatedAt: now } },
    { upsert: true, returnDocument: 'after' },
  ));
  const a = await company(QA_COMPANIES[0]);
  const b = await company(QA_COMPANIES[1]);
  const accounts = [
    ['admin', 'admin', null], ['spoc-a1', 'org_spoc', a._id], ['spoc-a2', 'org_spoc', a._id],
    ['member-a', 'org_member', a._id], ['spoc-b', 'org_spoc', b._id], ['volunteer', 'volunteer', null], ['ngo', 'ngo', null],
  ];
  const creds = [];
  for (const [slug, role, companyId] of accounts) {
    const username = `${PREFIX}${slug}`;
    const password = crypto.randomBytes(9).toString('base64url');
    await users.updateOne({ username }, { $set: {
      username, role, name: `QA ${slug}`, status: 'approved', companyId,
      password: await bcrypt.hash(password, 10),
      ...(role === 'ngo' ? { ngoId: 'QA-NGO', ngoName: 'QA NGO' } : {}),
      eventRegistrations: [], updatedAt: now,
    }, $setOnInsert: { createdAt: now } }, { upsert: true });
    creds.push({ username, role, password });
  }
  fs.mkdirSync(path.dirname(credsFile), { recursive: true });
  fs.writeFileSync(credsFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
  log(`Created ${creds.length} QA accounts in ${QA_COMPANIES.join(' / ')}. Credentials: ${credsFile}`);
  log('When QA is finished, remove them and everything they created: npm run seed:qa -- --remove');
  return { accounts: creds.length };
}

// Deletes what the QA accounts left behind first (events they created or that
// belong to a QA company, attendance of QA users, QA companies or those events,
// and messages to or from QA users), then the accounts and companies.
export async function removeQa(db, { log = console.log } = {}) {
  const users = db.collection('users');
  const companies = db.collection('companies');
  const events = db.collection('events');
  const attendances = db.collection('attendances');
  const messages = db.collection('messages');

  const userIds = await users.distinct('_id', { username: { $regex: `^${PREFIX}` } });
  const companyIds = await companies.distinct('_id', { nameKey: { $in: QA_COMPANIES.map(toNameKey) } });
  const eventIds = await events.distinct('_id', { $or: [{ createdBy: { $in: userIds } }, { companyId: { $in: companyIds } }] });

  const counts = {
    events: (await events.deleteMany({ _id: { $in: eventIds } })).deletedCount,
    attendances: (await attendances.deleteMany({ $or: [
      { userId: { $in: userIds } }, { companyId: { $in: companyIds } }, { eventId: { $in: eventIds } },
    ] })).deletedCount,
    messages: (await messages.deleteMany({ $or: [{ sender: { $in: userIds } }, { receiver: { $in: userIds } }] })).deletedCount,
    users: (await users.deleteMany({ _id: { $in: userIds } })).deletedCount,
    companies: (await companies.deleteMany({ _id: { $in: companyIds } })).deletedCount,
  };
  log(`Removed ${counts.events} events, ${counts.attendances} attendance records, ${counts.messages} messages, `
    + `${counts.users} users and ${counts.companies} companies.`);
  return counts;
}

async function main(argv) {
  dotenv.config({ path: '.env.local' });
  const uri = process.env.MONGODB_URI || '';
  if (!isTestClusterUri(uri)) {
    throw new Error(`Refusing: MONGODB_URI is not a host under the test cluster (*${TEST_HOST_SUFFIX}).`);
  }
  await mongoose.connect(uri);
  try {
    if (argv.includes('--remove')) await removeQa(mongoose.connection.db);
    else await seedQa(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(() => process.exit(0)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
