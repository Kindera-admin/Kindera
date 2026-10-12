import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { isTestClusterUri, seedQa, removeQa } from '../../scripts/seed-qa.mjs';

let db;
const credsFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'qa-')), 'qa-accounts.json');
const COLLECTIONS = ['users', 'companies', 'events', 'attendances', 'messages'];

beforeEach(async () => {
  await connectDB();
  db = mongoose.connection.db;
  // tests/setup.js only clears registered models; these tests also use raw collections.
  for (const name of COLLECTIONS) await db.collection(name).deleteMany({});
});

describe('test-cluster guard (D1)', () => {
  it('accepts only a host under the test cluster', () => {
    expect(isTestClusterUri('mongodb+srv://u:p@cluster0.2a5vud1.mongodb.net/kindera?retryWrites=true')).toBe(true);
    expect(isTestClusterUri('mongodb://u:p@shard-00.2a5vud1.mongodb.net:27017/kindera')).toBe(true);
  });
  it('refuses a URI that only mentions the cluster id elsewhere', () => {
    for (const uri of [
      'mongodb+srv://u:p@prod.abc123.mongodb.net/kindera?appName=2a5vud1',
      'mongodb+srv://2a5vud1:pw@prod.abc123.mongodb.net/kindera',
      'mongodb+srv://u:p@prod.abc123.mongodb.net/2a5vud1',
      'mongodb+srv://u:p@cluster0.2a5vud1.mongodb.net.evil.com/kindera',
      'mongodb+srv://u:p@2a5vud1.mongodb.net/kindera',
      'mongodb://u:p@a.2a5vud1.mongodb.net:27017,b.prod.mongodb.net:27017/kindera',
    ]) {
      expect(isTestClusterUri(uri), uri).toBe(false);
    }
  });
  it('refuses anything that does not parse', () => {
    for (const uri of ['', undefined, null, 'not a uri', '2a5vud1']) expect(isTestClusterUri(uri)).toBe(false);
  });
});

describe('seeding (D3)', () => {
  it('creates the QA accounts and reminds the operator to remove them', async () => {
    const lines = [];
    const file = credsFile();
    await seedQa(db, { credsFile: file, log: (l) => lines.push(l) });
    expect(await db.collection('users').countDocuments({ username: /^qa-/ })).toBe(7);
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toHaveLength(7);
    expect(lines.join('\n')).toMatch(/npm run seed:qa -- --remove/);
  });
});

describe('--remove (D2)', () => {
  it("deletes the QA users' and companies' events, attendance and messages, and leaves everything else", async () => {
    await seedQa(db, { credsFile: credsFile(), log: () => {} });
    const qa = Object.fromEntries((await db.collection('users').find({ username: /^qa-/ }).toArray()).map((u) => [u.username, u]));
    const qaCompany = await db.collection('companies').findOne({ nameKey: 'qa company a' });
    const { insertedId: realUser } = await db.collection('users').insertOne({ username: 'real', role: 'volunteer', name: 'Real' });
    const { insertedId: realAdmin } = await db.collection('users').insertOne({ username: 'real-admin', role: 'admin', name: 'Admin' });

    const ev = db.collection('events');
    const { insertedId: qaInternal } = await ev.insertOne({ title: 'QA internal', createdBy: qa['qa-spoc-a1']._id, companyId: qaCompany._id });
    const { insertedId: qaPublic } = await ev.insertOne({ title: 'QA public', createdBy: qa['qa-admin']._id, companyId: null });
    // Created by a real admin but scoped to the QA company.
    await ev.insertOne({ title: 'Scoped to QA', createdBy: realAdmin, companyId: qaCompany._id });
    const { insertedId: realEvent } = await ev.insertOne({ title: 'Real public', createdBy: realAdmin, companyId: null });

    const att = db.collection('attendances');
    await att.insertMany([
      { eventId: realEvent, userId: qa['qa-member-a']._id, companyId: qaCompany._id },
      { eventId: qaPublic, userId: realUser, companyId: null },
      { eventId: realEvent, userId: realUser, companyId: null },
    ]);
    const msg = db.collection('messages');
    await msg.insertMany([
      { sender: qa['qa-ngo']._id, receiver: realAdmin, content: 'qa to real' },
      { sender: realAdmin, receiver: qa['qa-spoc-b']._id, content: 'real to qa' },
      { sender: realAdmin, receiver: realUser, content: 'real to real' },
    ]);

    const lines = [];
    const counts = await removeQa(db, { log: (l) => lines.push(l) });
    expect(counts).toEqual({ events: 3, attendances: 2, messages: 2, users: 7, companies: 2 });
    expect(lines.join('\n')).toMatch(/3 events, 2 attendance records, 2 messages, 7 users and 2 companies/);

    expect((await ev.find({}).toArray()).map((e) => e.title)).toEqual(['Real public']);
    expect(await att.countDocuments()).toBe(1);
    expect(await att.countDocuments({ eventId: realEvent, userId: realUser })).toBe(1);
    expect((await msg.find({}).toArray()).map((m) => m.content)).toEqual(['real to real']);
    expect(await db.collection('users').countDocuments()).toBe(2);
    expect(await db.collection('companies').countDocuments()).toBe(0);
    expect(qaInternal).toBeDefined();
  });
});
