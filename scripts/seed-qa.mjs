#!/usr/bin/env node
// Creates (or with --remove deletes) clearly prefixed QA accounts in the TEST database only.
//   node scripts/seed-qa.mjs          create
//   node scripts/seed-qa.mjs --remove delete
// Passwords are written to backups/qa-accounts.json (gitignored), never printed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { toNameKey } from '../src/lib/companyName.mjs';

dotenv.config({ path: '.env.local' });
const uri = process.env.MONGODB_URI || '';
const TEST_CLUSTER = '2a5vud1';
if (!uri.includes(TEST_CLUSTER)) {
  console.error(`Refusing: MONGODB_URI is not the test cluster (${TEST_CLUSTER}).`);
  process.exit(1);
}

const PREFIX = 'qa-';
const remove = process.argv.includes('--remove');

await mongoose.connect(uri);
const db = mongoose.connection.db;
const users = db.collection('users');
const companies = db.collection('companies');

if (remove) {
  const u = await users.deleteMany({ username: { $regex: `^${PREFIX}` } });
  const c = await companies.deleteMany({ nameKey: { $in: [toNameKey('QA Company A'), toNameKey('QA Company B')] } });
  console.log(`Removed ${u.deletedCount} QA users and ${c.deletedCount} QA companies.`);
} else {
  const now = new Date();
  const company = async (name) => (await companies.findOneAndUpdate(
    { nameKey: toNameKey(name) },
    { $setOnInsert: { name, nameKey: toNameKey(name), logoUrl: '', status: 'active', createdBy: null, createdAt: now, updatedAt: now } },
    { upsert: true, returnDocument: 'after' },
  ));
  const a = await company('QA Company A');
  const b = await company('QA Company B');
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
  fs.mkdirSync('backups', { recursive: true });
  fs.writeFileSync(path.join('backups', 'qa-accounts.json'), JSON.stringify(creds, null, 2), { mode: 0o600 });
  console.log(`Created ${creds.length} QA accounts in QA Company A / B. Credentials: backups/qa-accounts.json`);
}
await mongoose.disconnect();
