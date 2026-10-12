# Companies as Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-text `organizationName` company identity with `Company` records referenced by `companyId`, and make every SPOC and employee of a company share one dashboard.

**Architecture:**
- A new `Company` model, plus one module (`src/lib/company.js`) that owns every company access and event-visibility rule.
- Each server action in `src/app/actions.js` is rewritten to use those rules and `companyId`, together with the screens that call it, so the app builds after every task.
- A standalone migration script moves existing data: dry run, then expand, then contract, with rollback.

**Tech Stack:** Next.js 15 (App Router, server actions), React 19, Mongoose 8 / MongoDB, Tailwind 4 + shadcn/ui, Vitest + mongodb-memory-server (new, dev only).

**Spec:** `docs/superpowers/specs/2026-10-12-companies-as-records-design.md`

## Global Constraints

- Branch `test` only. Never push to `main`. kindera.co releases only on explicit user approval.
- Commits are authored by the repo's configured git identity (`Dhruv-Pratap-Chauhan`). **No `Co-Authored-By` or "Generated with" lines.**
- JavaScript only (no TypeScript). Use the `@/` alias for `src/` imports in app code.
- Never hardcode credentials. Scripts read `MONGODB_URI` from an env file.
- **Every company comparison** goes through `src/lib/company.js` (`resolveCompanyAccess`, `eventVisibilityFilter`, `canSeeEvent`, `canManageEvent`, `sameCompany`). No action compares companies by hand.
- **"Public event" means `companyId: null`.** Never use `createdByRole` to decide visibility.
- **`User.spocId` must never decide what anyone can see or do.** It only records which SPOC created a login.
- **Aggregation pipelines `$match` on ObjectIds.** Convert string ids with `asObjectId()`, because a string never matches an ObjectId inside `aggregate()`.
- Public signup offers only `volunteer` and `ngo`.
- Done means:
  - `npm test` and `npm run build` pass;
  - `grep -rn "organizationName\|organizationLogo" src/` prints nothing;
  - every row of spec §4 and §4.1 is covered by a test.

**Spec deviations (implementation detail, same behaviour):**
- The spec lists `setCompanyLogo` (admin) and `updateCompanyLogo` (SPOC) separately. This plan uses one action, `updateCompanyLogo(url, companyId)`, that serves both callers.
- Company admin actions live in a new focused file, `src/app/companyActions.js` (`'use server'`), instead of growing `actions.js` further. `CLAUDE.md` is updated to say so.

## File Map

| File | Responsibility |
|---|---|
| `vitest.config.mjs` (new) | Test runner config, `@` alias |
| `tests/setup.js` (new) | In-memory MongoDB, env, `next/headers` and `next/cache` mocks, per-test DB reset |
| `tests/helpers/auth.js` (new) | `actAs(user)`, which signs the `auth-token` cookie the app reads |
| `tests/helpers/factories.js` (new) | `makeUser`, `makeEvent`, `makeCompany`, `makeWorld` |
| `src/lib/companyName.mjs` (new) | `toNameKey(name)`, shared by the app and the migration script; no imports |
| `src/models/Company.js` (new) | Company schema |
| `src/lib/company.js` (new) | Access and visibility rules, `asObjectId`, company name lookups |
| `src/models/User.js`, `Event.js`, `Attendance.js` | `organizationName` / `organizationLogo` → `companyId`, `ngoName`, `employerName` |
| `scripts/migrate-companies.mjs` (new) | Plan / apply / cleanup / rollback |
| `scripts/seed-qa.mjs` (new) | QA accounts in the test database only |
| `src/app/companyActions.js` (new) | `listCompanies`, `createCompany`, `renameCompany`, `archiveCompany`, `restoreCompany`, `updateCompanyLogo` |
| `src/app/admin/companies/page.js`, `CompaniesClient.js` (new) | Admin Companies screen |
| `src/app/actions.js` | 29 actions rewritten in Tasks 6–11 |
| Screens under `src/app/**` | Consumers switched in the same task as their action |

---

### Task 1: Test harness

**Files:**
- Modify: `package.json` (scripts, devDependencies)
- Create: `vitest.config.mjs`, `tests/setup.js`, `tests/helpers/auth.js`, `tests/helpers/factories.js`, `tests/harness.test.js`

**Interfaces:**
- Produces: `actAs(user | null)` from `tests/helpers/auth.js`; `makeUser(role, overrides)` and `makeEvent(creator, overrides)` from `tests/helpers/factories.js`; the `npm test` script.

- [ ] **Step 1: Install dev dependencies.** Ask the user before running. The first test run downloads a MongoDB binary of about 100 MB into `~/.cache/mongodb-binaries`.

Run: `cd /Users/dhruv/Downloads/Kindera && npm install --save-dev vitest@^3 mongodb-memory-server@^10`
Expected: both appear under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the test script.** In `package.json` `"scripts"`, add `"test": "vitest run"` after `"lint"`.

- [ ] **Step 3: Create `vitest.config.mjs`.**

```js
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setup.js'],
    // One process: the in-memory MongoDB and mongoose's global connection cache are shared.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 180000,
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
```

- [ ] **Step 4: Create `tests/helpers/auth.js`.**

```js
import { SignJWT } from 'jose';

// The mocked cookie store in tests/setup.js reads this token.
export const authState = { token: null };

// Sign in as `user` the same way the app does (HS256 JWT with userId + role in the auth-token cookie).
export async function actAs(user) {
  if (!user) {
    authState.token = null;
    return;
  }
  const key = new TextEncoder().encode(process.env.JWT_SECRET);
  authState.token = await new SignJWT({ userId: String(user._id), role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}
```

- [ ] **Step 5: Create `tests/setup.js`.**

```js
import { vi, beforeEach, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { authState } from './helpers/auth.js';

const mongod = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongod.getUri('kindera_test');
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-chars';

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name) => (name === 'auth-token' && authState.token ? { value: authState.token } : undefined),
    set: () => {},
    delete: () => {},
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

beforeEach(async () => {
  authState.token = null;
  if (mongoose.connection.readyState === 1) {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});
```

- [ ] **Step 6: Create `tests/helpers/factories.js`.**

```js
import connectDB from '@/lib/db';
import User from '@/models/User';
import Event from '@/models/Event';

let seq = 0;
export const next = () => ++seq;

export async function makeUser(role, overrides = {}) {
  await connectDB();
  const i = next();
  return User.create({
    username: `${role}-${i}`,
    password: 'password123',
    name: `${role} ${i}`,
    role,
    status: 'approved',
    ...(role === 'ngo' ? { ngoId: `NGO-${i}` } : {}),
    ...overrides,
  });
}

export async function makeEvent(creator, overrides = {}) {
  await connectDB();
  return Event.create({
    title: `Event ${next()}`,
    description: 'Test event',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    location: 'Bengaluru',
    createdBy: creator._id,
    createdByRole: creator.role,
    ...overrides,
  });
}
```

- [ ] **Step 7: Write the harness test** (`tests/harness.test.js`).

```js
import { describe, it, expect } from 'vitest';
import { getCurrentUser } from '@/lib/auth';
import { actAs } from './helpers/auth.js';
import { makeUser } from './helpers/factories.js';

describe('test harness', () => {
  it('signs a test user in through the auth cookie', async () => {
    const volunteer = await makeUser('volunteer');
    await actAs(volunteer);
    const me = await getCurrentUser();
    expect(String(me._id)).toBe(String(volunteer._id));
  });

  it('treats a request without a cookie as logged out', async () => {
    await actAs(null);
    expect(await getCurrentUser()).toBeNull();
  });

  it('starts every test with an empty database', async () => {
    const User = (await import('@/models/User')).default;
    expect(await User.countDocuments()).toBe(0);
  });
});
```

- [ ] **Step 8: Run the tests.** Run: `npm test`. Expected: 3 passed. The first run is slow while MongoDB downloads.

- [ ] **Step 9: Commit.**

```bash
git add package.json package-lock.json vitest.config.mjs tests
git commit -m "Add Vitest harness with in-memory MongoDB"
```

---

### Task 2: Company model and access rules

**Files:**
- Create: `src/lib/companyName.mjs`, `src/models/Company.js`, `src/lib/company.js`, `tests/lib/company.test.js`
- Modify: `tests/helpers/factories.js` (add `makeCompany`)

**Interfaces:**
- Produces:
  - `toNameKey(name: string): string`
  - `Company` model with fields `{ name, nameKey, logoUrl, status: 'active'|'archived', createdBy }`
  - From `src/lib/company.js`:
    - `isStaff(user): boolean`
    - `isCorporate(user): boolean`
    - `sameCompany(a, b): boolean`
    - `asObjectId(id): ObjectId|null`
    - `resolveCompanyAccess(caller, companyId?)`, returning `{ companyId: string|null } | { error: string }`
    - `eventVisibilityFilter(caller): object`
    - `canSeeEvent(caller, event): boolean`
    - `canManageEvent(caller, event): boolean`
    - `getCompanyName(id): Promise<string|null>`
    - `getCompaniesByIds(ids): Promise<Map<string, { name, logoUrl, status }>>`
  - `makeCompany(name?, overrides?)` test factory.

- [ ] **Step 1: Write the failing rule tests** (`tests/lib/company.test.js`). Every rule gets a denied case next to its allowed case. IDs are compared exactly, never by substring or prefix.

```js
import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  resolveCompanyAccess, eventVisibilityFilter, canSeeEvent, canManageEvent, sameCompany,
} from '@/lib/company';
import { toNameKey } from '@/lib/companyName.mjs';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const admin = { _id: 'admin1', role: 'admin' };
const employee = { _id: 'emp1', role: 'employee' };
const spocA = { _id: 'spocA', role: 'org_spoc', companyId: A };
const spocA2 = { _id: 'spocA2', role: 'org_spoc', companyId: A };
const memberA = { _id: 'memberA', role: 'org_member', companyId: A };
const spocB = { _id: 'spocB', role: 'org_spoc', companyId: B };
const volunteer = { _id: 'vol1', role: 'volunteer' };
const ngo = { _id: 'ngo1', role: 'ngo' };
const spocWithoutCompany = { _id: 'lost', role: 'org_spoc', companyId: null };

describe('toNameKey', () => {
  it('ignores case and surrounding / repeated spaces', () => {
    expect(toNameKey('  Acme   Corp ')).toBe('acme corp');
    expect(toNameKey('ACME CORP')).toBe(toNameKey('acme corp'));
  });
  it('keeps different names different', () => {
    expect(toNameKey('Acme')).not.toBe(toNameKey('Acme Corp'));
  });
});

describe('sameCompany', () => {
  it('matches equal ids across string and ObjectId', () => {
    expect(sameCompany(new mongoose.Types.ObjectId(A), A)).toBe(true);
  });
  it('rejects different, prefix and empty ids', () => {
    expect(sameCompany(A, B)).toBe(false);
    expect(sameCompany(A, A.slice(0, 23))).toBe(false);
    expect(sameCompany(null, null)).toBe(false);
  });
});

describe('resolveCompanyAccess', () => {
  it('lets staff read any company, or all when none is given', () => {
    expect(resolveCompanyAccess(admin, B)).toEqual({ companyId: B });
    expect(resolveCompanyAccess(employee, A)).toEqual({ companyId: A });
    expect(resolveCompanyAccess(admin)).toEqual({ companyId: null });
  });
  it('pins corporate users to their own company', () => {
    expect(resolveCompanyAccess(spocA, A)).toEqual({ companyId: A });
    expect(resolveCompanyAccess(memberA)).toEqual({ companyId: A });
  });
  it("denies corporate users another company's data", () => {
    expect(resolveCompanyAccess(spocA, B)).toHaveProperty('error');
    expect(resolveCompanyAccess(memberA, B)).toHaveProperty('error');
    expect(resolveCompanyAccess(spocB, A)).toHaveProperty('error');
  });
  it('denies everyone else', () => {
    expect(resolveCompanyAccess(volunteer, A)).toHaveProperty('error');
    expect(resolveCompanyAccess(ngo, A)).toHaveProperty('error');
    expect(resolveCompanyAccess(spocWithoutCompany)).toHaveProperty('error');
    expect(resolveCompanyAccess(null, A)).toEqual({ error: 'Not authenticated' });
  });
});

describe('eventVisibilityFilter', () => {
  it('shows staff everything', () => {
    expect(eventVisibilityFilter(admin)).toEqual({});
    expect(eventVisibilityFilter(employee)).toEqual({});
  });
  it('shows corporate users public events plus their company', () => {
    expect(eventVisibilityFilter(memberA)).toEqual({ $or: [{ companyId: null }, { companyId: A }] });
  });
  it('shows everyone else public events only', () => {
    for (const who of [volunteer, ngo, null, spocWithoutCompany]) {
      expect(eventVisibilityFilter(who)).toEqual({ companyId: null });
    }
  });
});

describe('canSeeEvent', () => {
  const publicEvent = { companyId: null, createdBy: 'ngo1' };
  const internalA = { companyId: A, createdBy: 'spocA' };
  it('shows public events to anyone, even logged out', () => {
    for (const who of [null, volunteer, ngo, memberA, spocB]) expect(canSeeEvent(who, publicEvent)).toBe(true);
  });
  it("shows a company's event to all its SPOCs and employees, and staff", () => {
    for (const who of [spocA, spocA2, memberA, admin, employee]) expect(canSeeEvent(who, internalA)).toBe(true);
  });
  it("hides a company's event from everyone else", () => {
    for (const who of [spocB, volunteer, ngo, null, spocWithoutCompany]) expect(canSeeEvent(who, internalA)).toBe(false);
  });
});

describe('canManageEvent', () => {
  const internalA = { companyId: A, createdBy: 'spocA' };
  const adminEvent = { companyId: null, createdBy: 'admin1' };
  it('lets admins, the creator, and any SPOC of the company manage it', () => {
    expect(canManageEvent(admin, internalA)).toBe(true);
    expect(canManageEvent(spocA, internalA)).toBe(true);
    expect(canManageEvent(spocA2, internalA)).toBe(true);
  });
  it('refuses employees of the company, other companies, staff and outsiders', () => {
    for (const who of [memberA, spocB, employee, volunteer, ngo, null]) expect(canManageEvent(who, internalA)).toBe(false);
  });
  it("does not let a SPOC manage public events they didn't create", () => {
    expect(canManageEvent(spocA, adminEvent)).toBe(false);
  });
  it('accepts a populated createdBy', () => {
    expect(canManageEvent(spocA, { companyId: B, createdBy: { _id: 'spocA' } })).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/lib/company.test.js`. Expected: FAIL, cannot resolve `@/lib/company`.

- [ ] **Step 3: Create `src/lib/companyName.mjs`.**

```js
// Shared by the app and scripts/migrate-companies.mjs, so it has no imports.
// Two company names are the same company when their keys match.
export function toNameKey(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
```

- [ ] **Step 4: Create `src/models/Company.js`.**

```js
import mongoose from 'mongoose';
import { toNameKey } from '@/lib/companyName.mjs';

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // Unique, case- and spacing-insensitive form of `name`; blocks "Acme" vs "acme ".
  nameKey: { type: String, required: true, unique: true },
  logoUrl: { type: String, default: '' },
  status: { type: String, enum: ['active', 'archived'], default: 'active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

companySchema.pre('validate', function setNameKey(next) {
  if (this.isModified('name') || !this.nameKey) this.nameKey = toNameKey(this.name);
  next();
});

const Company = mongoose.models.Company || mongoose.model('Company', companySchema);
export default Company;
```

- [ ] **Step 5: Create `src/lib/company.js`.**

```js
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Company from '@/models/Company';

// Every company access and event-visibility decision lives here.
// Nothing else in the app compares companies directly.

const STAFF = ['admin', 'employee'];
const CORPORATE = ['org_spoc', 'org_member'];

const idOf = (value) => (value == null ? null : String(value._id ?? value));

export function isStaff(user) {
  return !!user && STAFF.includes(user.role);
}

export function isCorporate(user) {
  return !!user && CORPORATE.includes(user.role) && !!user.companyId;
}

export function sameCompany(a, b) {
  const x = idOf(a);
  const y = idOf(b);
  return !!x && x === y;
}

// Aggregation $match compares types strictly: a string never matches an ObjectId.
export function asObjectId(id) {
  return id ? new mongoose.Types.ObjectId(String(id)) : null;
}

// Which company's data may `caller` read? Staff: the requested one (or all if
// none). SPOCs and employees: only their own, whatever they asked for.
export function resolveCompanyAccess(caller, companyId = null) {
  if (!caller) return { error: 'Not authenticated' };
  if (isStaff(caller)) return { companyId: companyId ? idOf(companyId) : null };
  if (isCorporate(caller)) {
    if (companyId && !sameCompany(companyId, caller.companyId)) {
      return { error: 'Not authorized for this company' };
    }
    return { companyId: idOf(caller.companyId) };
  }
  return { error: 'Not authorized' };
}

// Mongo filter for event lists. Public means companyId null (or missing).
export function eventVisibilityFilter(caller) {
  if (isStaff(caller)) return {};
  if (isCorporate(caller)) return { $or: [{ companyId: null }, { companyId: caller.companyId }] };
  return { companyId: null };
}

export function canSeeEvent(caller, event) {
  if (!event) return false;
  if (!event.companyId) return true;
  if (isStaff(caller)) return true;
  return isCorporate(caller) && sameCompany(event.companyId, caller.companyId);
}

// Admins, the creator, or any SPOC of the event's company.
export function canManageEvent(caller, event) {
  if (!caller || !event) return false;
  if (caller.role === 'admin') return true;
  if (sameCompany(event.createdBy, caller._id)) return true;
  return caller.role === 'org_spoc' && !!event.companyId && sameCompany(event.companyId, caller.companyId);
}

export async function getCompanyName(companyId) {
  if (!companyId) return null;
  await connectDB();
  const company = await Company.findById(companyId).select('name').lean();
  return company?.name ?? null;
}

export async function getCompaniesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  await connectDB();
  const list = await Company.find({ _id: { $in: unique } }).select('name logoUrl status').lean();
  return new Map(list.map((c) => [String(c._id), { name: c.name, logoUrl: c.logoUrl || '', status: c.status }]));
}
```

- [ ] **Step 6: Run the tests to verify they pass.** Run: `npm test -- tests/lib/company.test.js`. Expected: all pass.

- [ ] **Step 7: Add `makeCompany` to `tests/helpers/factories.js`.** Add `import Company from '@/models/Company';` with the other imports, and at the end:

```js
export async function makeCompany(name = `Company ${next()}`, overrides = {}) {
  await connectDB();
  return Company.create({ name, ...overrides });
}
```

- [ ] **Step 8: Add Company model tests** (append to `tests/lib/company.test.js`).

```js
import Company from '@/models/Company';
import { makeCompany } from '../helpers/factories.js';
import { getCompaniesByIds, getCompanyName } from '@/lib/company';

describe('Company model', () => {
  it('derives nameKey from name', async () => {
    const c = await makeCompany('  Acme   Corp ');
    expect(c.name).toBe('Acme   Corp');
    expect(c.nameKey).toBe('acme corp');
  });
  it('rejects a second company whose name differs only by case or spacing', async () => {
    await Company.init();
    await makeCompany('Acme Corp');
    await expect(makeCompany('ACME  corp')).rejects.toMatchObject({ code: 11000 });
  });
  it('resolves names by id', async () => {
    const a = await makeCompany('Acme');
    expect(await getCompanyName(a._id)).toBe('Acme');
    expect(await getCompanyName(null)).toBeNull();
    const map = await getCompaniesByIds([a._id, String(a._id), null]);
    expect(map.size).toBe(1);
    expect(map.get(String(a._id)).name).toBe('Acme');
  });
});
```

- [ ] **Step 9: Run all tests.** Run: `npm test`. Expected: all pass.

- [ ] **Step 10: Commit.**

```bash
git add src/lib/companyName.mjs src/models/Company.js src/lib/company.js tests
git commit -m "Add Company model and central company access rules"
```

---

### Task 3: Schema switch to companyId

**Files:**
- Modify: `src/models/User.js:29-38`, `src/models/Event.js:44-48`, `src/models/Attendance.js:14-17,48-49`
- Modify: `tests/helpers/factories.js` (add `makeWorld`)
- Create: `tests/models/schema.test.js`

**Interfaces:**
- Consumes: `Company` (Task 2), `makeCompany` (Task 2).
- Produces:
  - `User.companyId` (required for `org_spoc` / `org_member`), `User.ngoName`, `User.employerName`
  - `Event.companyId` (default `null`)
  - `Attendance.companyId` (default `null`)
  - `makeWorld()` returns `{ companyA, companyB, admin, employee, spocA, spocA2, memberA, spocB, memberB, volunteer, ngo }`

- [ ] **Step 1: Write failing schema tests** (`tests/models/schema.test.js`).

```js
import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Event from '@/models/Event';
import Attendance from '@/models/Attendance';
import { makeCompany, makeUser, makeEvent } from '../helpers/factories.js';

describe('company fields', () => {
  it('no model keeps organizationName or organizationLogo', () => {
    expect(User.schema.path('organizationName')).toBeUndefined();
    expect(User.schema.path('organizationLogo')).toBeUndefined();
    expect(Event.schema.path('organizationName')).toBeUndefined();
    expect(Attendance.schema.path('organizationName')).toBeUndefined();
  });
  it('requires companyId for SPOCs and employees', async () => {
    await expect(makeUser('org_spoc')).rejects.toThrow(/companyId/);
    await expect(makeUser('org_member')).rejects.toThrow(/companyId/);
  });
  it('accepts SPOCs and employees with a company', async () => {
    const c = await makeCompany('Acme');
    const spoc = await makeUser('org_spoc', { companyId: c._id });
    expect(String(spoc.companyId)).toBe(String(c._id));
  });
  it('does not require a company for NGOs and volunteers, and stores their own fields', async () => {
    const ngo = await makeUser('ngo', { ngoName: 'Green Earth' });
    const vol = await makeUser('volunteer', { employerName: 'Freelance' });
    expect(ngo.companyId).toBeNull();
    expect(ngo.ngoName).toBe('Green Earth');
    expect(vol.employerName).toBe('Freelance');
  });
  it('makes events public unless a company is set', async () => {
    const admin = await makeUser('admin');
    expect((await makeEvent(admin)).companyId).toBeNull();
  });
  it('allows attendance without a company (individual volunteers)', async () => {
    const admin = await makeUser('admin');
    const vol = await makeUser('volunteer');
    const event = await makeEvent(admin);
    const att = await Attendance.create({ eventId: event._id, userId: vol._id, attended: true });
    expect(att.companyId).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/models/schema.test.js`. Expected: FAIL. `organizationName` paths are still defined, and the SPOC without `companyId` saves.

- [ ] **Step 3: Edit `src/models/User.js`.** Replace the `organizationName: {…}` and `organizationLogo: {…}` blocks (lines 29–38) with:

```js
  // Corporate users (SPOCs and employees) belong to exactly one company.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    required: function () {
      return this.role === 'org_spoc' || this.role === 'org_member';
    },
  },
  // NGO login's organisation name (was organizationName for role 'ngo').
  ngoName: { type: String, default: '', trim: true },
  // Optional free-text employer for individual volunteers (display only).
  employerName: { type: String, default: '', trim: true },
```

Then, below the `spocId` field's comment, replace `// Corporate team: links org_member back to their SPOC` with `// Which SPOC created this login. Record only: never used for access decisions.`. Before the `pre('save')` hook, add:

```js
userSchema.index({ companyId: 1 });
```

- [ ] **Step 4: Edit `src/models/Event.js`.** Replace the `organizationName: {…}` block with:

```js
  // Set means a private event for this company; null means public.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
    index: true,
  },
```

- [ ] **Step 5: Edit `src/models/Attendance.js`.**
  - Replace the `organizationName: {…}` block with:

```js
  // Company of the attendee at the time of marking; null for individual volunteers.
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    default: null,
  },
```

  - Replace `// Fast lookup by org` and `attendanceSchema.index({ organizationName: 1 });` with:

```js
// Fast lookup by company
attendanceSchema.index({ companyId: 1 });
```

- [ ] **Step 6: Run the tests to verify they pass.** Run: `npm test -- tests/models/schema.test.js`. Expected: all pass.

- [ ] **Step 7: Add `makeWorld` to `tests/helpers/factories.js`.**

```js
// Two companies, two SPOCs in A, one employee in each company, plus staff and outsiders.
export async function makeWorld() {
  const companyA = await makeCompany('Acme');
  const companyB = await makeCompany('Beta');
  const admin = await makeUser('admin');
  const employee = await makeUser('employee');
  const spocA = await makeUser('org_spoc', { companyId: companyA._id });
  const spocA2 = await makeUser('org_spoc', { companyId: companyA._id });
  const spocB = await makeUser('org_spoc', { companyId: companyB._id });
  const memberA = await makeUser('org_member', { companyId: companyA._id, spocId: spocA._id });
  const memberB = await makeUser('org_member', { companyId: companyB._id, spocId: spocB._id });
  const volunteer = await makeUser('volunteer');
  const ngo = await makeUser('ngo', { ngoName: 'Green Earth' });
  return { companyA, companyB, admin, employee, spocA, spocA2, memberA, spocB, memberB, volunteer, ngo };
}
```

- [ ] **Step 8: Run all tests.** Run: `npm test`. Expected: all pass.

- [ ] **Step 9: Commit.**

```bash
git add src/models tests
git commit -m "Switch User, Event and Attendance to companyId"
```

---

### Task 4: Migration script

**Files:**
- Create: `scripts/migrate-companies.mjs`, `tests/scripts/migrate-companies.test.js`
- Modify: `.gitignore` (add `backups/`)

**Interfaces:**
- Consumes: `toNameKey` (Task 2). It does **not** import app models: the script works on raw collections, so it never depends on the current schemas.
- Produces:
  - `parseArgs(argv)`
  - `planMigration(db)` → `{ groups: [{ key, name, variants: [{ name, count }], users, events, attendance }], unmatched: [{ name, count }], ngoUsers, volunteerUsers }`
  - `applyMigration(db, { backupFile? })` → `{ companiesCreated, companiesReused, users, events, attendances, ngoNames, employerNames }`
  - `cleanupMigration(db, { backupFile? })` → `{ users, events, attendances }`
  - `rollbackMigration(db, backup)`
  - `readBackup(file)`

- [ ] **Step 1: Write the failing tests** (`tests/scripts/migrate-companies.test.js`). There is one assertion per clause of spec §7.

```js
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
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/scripts/migrate-companies.test.js`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Create `scripts/migrate-companies.mjs`.**

```js
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
  }
  if (backupFile) writeBackup(backupFile, backup);

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

function hostOf(uri) {
  const u = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:'));
  return u.host;
}

async function main(argv) {
  const args = parseArgs(argv);
  dotenv.config({ path: args.env });
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error(`MONGODB_URI is not set in ${args.env}`);
  console.log(`Target database: ${hostOf(uri)} (from ${args.env})`);
  if (args.mode !== 'plan' && !args.yes) {
    throw new Error(`--${args.mode} writes to ${hostOf(uri)}. Re-run with --yes to confirm.`);
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
```

- [ ] **Step 4: Run the tests to verify they pass.** Run: `npm test -- tests/scripts/migrate-companies.test.js`. Expected: all pass.

- [ ] **Step 5: Ignore backups.** Append to `.gitignore`:

```
# migration backups (contain user data)
backups/
```

- [ ] **Step 6: Dry-run against the local test database** (read-only).

Run: `node scripts/migrate-companies.mjs`
Expected: `Target database: kindera.2a5vud1.mongodb.net …`, a list of proposed companies, and "Nothing was written". If the host is not `2a5vud1`, stop and tell the user. Paste the output to the user for review. Do not run `--apply` here; Task 12 does that.

- [ ] **Step 7: Commit.**

```bash
git add scripts/migrate-companies.mjs tests/scripts .gitignore
git commit -m "Add companies migration script with dry run, cleanup and rollback"
```

---

### Task 5: Company admin actions and the Companies screen

**Files:**
- Create: `src/app/companyActions.js`, `src/app/admin/companies/page.js`, `src/app/admin/companies/CompaniesClient.js`, `tests/actions/companies.test.js`
- Modify: `src/components/Navbar.js` (nav link), `src/app/dashboard/DashboardClient.js` (Control Centre card)

**Interfaces:**
- Consumes: `isStaff`, `sameCompany` (Task 2), `Company` (Task 2), `makeWorld` (Task 3).
- Produces (all from `@/app/companyActions`):
  - `listCompanies({ includeArchived?: boolean })` → `{ success, companies: [{ _id, name, logoUrl, status, createdAt, spocCount, memberCount, volunteerHours }] }`
  - `createCompany(name)` → `{ success, company }`
  - `renameCompany(id, name)`
  - `archiveCompany(id)` / `restoreCompany(id)`
  - `updateCompanyLogo(url, companyId?)`. Staff pass `companyId`; a SPOC's own company is implied.

- [ ] **Step 1: Write the failing tests** (`tests/actions/companies.test.js`).

```js
import { describe, it, expect } from 'vitest';
import Company from '@/models/Company';
import { actAs } from '../helpers/auth.js';
import { makeWorld } from '../helpers/factories.js';
import {
  listCompanies, createCompany, renameCompany, archiveCompany, restoreCompany, updateCompanyLogo,
} from '@/app/companyActions';

describe('company admin actions', () => {
  it('lets admins and staff create companies', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect((await createCompany('Gamma')).success).toBe(true);
    await actAs(w.employee);
    expect((await createCompany('Delta')).success).toBe(true);
  });

  it('refuses SPOCs, employees, volunteers, NGOs and logged-out callers', async () => {
    const w = await makeWorld();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      const res = await createCompany('Nope');
      expect(res.success).toBe(false);
    }
    expect(await Company.countDocuments({ nameKey: 'nope' })).toBe(0);
  });

  it('rejects a duplicate name that differs only by case or spacing', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await createCompany('  ACME ');
    expect(res).toEqual({ success: false, message: 'A company with this name already exists' });
  });

  it('allows exactly one company when the same name is created concurrently', async () => {
    const w = await makeWorld();
    await Company.init();
    await actAs(w.admin);
    const results = await Promise.all(Array.from({ length: 5 }, () => createCompany('Omega')));
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(await Company.countDocuments({ nameKey: 'omega' })).toBe(1);
  });

  it('lists companies with SPOC and employee counts, hiding archived ones by default', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    await archiveCompany(String(w.companyB._id));
    const active = await listCompanies();
    expect(active.companies.map((c) => c.name)).toEqual(['Acme']);
    expect(active.companies[0]).toMatchObject({ spocCount: 2, memberCount: 1 });
    const all = await listCompanies({ includeArchived: true });
    expect(all.companies).toHaveLength(2);
  });

  it('refuses the company list to non-staff', async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    expect((await listCompanies()).success).toBe(false);
  });

  it('renames, archives and restores', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const id = String(w.companyA._id);
    expect((await renameCompany(id, 'Acme Global')).success).toBe(true);
    expect((await Company.findById(id)).nameKey).toBe('acme global');
    expect((await renameCompany(id, 'beta')).message).toBe('A company with this name already exists');
    await archiveCompany(id);
    expect((await Company.findById(id)).status).toBe('archived');
    await restoreCompany(id);
    expect((await Company.findById(id)).status).toBe('active');
  });

  it("lets a SPOC set their own company's logo, and staff set any", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    expect((await updateCompanyLogo('https://x/a.png')).success).toBe(true);
    expect((await Company.findById(w.companyA._id)).logoUrl).toBe('https://x/a.png');
    await actAs(w.admin);
    expect((await updateCompanyLogo('https://x/b.png', String(w.companyB._id))).success).toBe(true);
    expect((await Company.findById(w.companyB._id)).logoUrl).toBe('https://x/b.png');
  });

  it("refuses logo changes from employees, and SPOC changes to another company's logo", async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    expect((await updateCompanyLogo('https://x/m.png')).success).toBe(false);
    await actAs(w.spocA);
    expect((await updateCompanyLogo('https://x/s.png', String(w.companyB._id))).success).toBe(false);
    expect((await Company.findById(w.companyB._id)).logoUrl).toBe('');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/companies.test.js`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Create `src/app/companyActions.js`.**

```js
'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/db';
import Company from '@/models/Company';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import { getCurrentUser } from '@/lib/auth';
import { isStaff, sameCompany } from '@/lib/company';

const DUPLICATE = 'A company with this name already exists';

function serialize(c) {
  return {
    _id: String(c._id),
    name: c.name,
    logoUrl: c.logoUrl || '',
    status: c.status,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  };
}

async function requireStaff() {
  await connectDB();
  const caller = await getCurrentUser();
  if (!caller) return { error: 'Not authenticated' };
  if (!isStaff(caller)) return { error: 'Only Kindera admins and staff can manage companies' };
  return { caller };
}

function revalidateCompanies() {
  revalidatePath('/admin/companies');
  revalidatePath('/admin/corporate');
  revalidatePath('/admin/register');
}

export async function listCompanies({ includeArchived = false } = {}) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    const companies = await Company.find(includeArchived ? {} : { status: 'active' }).sort({ name: 1 }).lean();
    const ids = companies.map((c) => c._id);
    const [spocs, members, hours] = await Promise.all([
      User.aggregate([{ $match: { role: 'org_spoc', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { role: 'org_member', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      Attendance.aggregate([{ $match: { attended: true, companyId: { $in: ids } } }, { $group: { _id: '$companyId', h: { $sum: '$hoursContributed' } } }]),
    ]);
    const byId = (rows, field) => new Map(rows.map((r) => [String(r._id), r[field]]));
    const spocCount = byId(spocs, 'n');
    const memberCount = byId(members, 'n');
    const volunteerHours = byId(hours, 'h');
    return {
      success: true,
      companies: companies.map((c) => ({
        ...serialize(c),
        spocCount: spocCount.get(String(c._id)) || 0,
        memberCount: memberCount.get(String(c._id)) || 0,
        volunteerHours: volunteerHours.get(String(c._id)) || 0,
      })),
    };
  } catch (error) {
    console.error('Error listing companies:', error);
    return { success: false, message: error.message };
  }
}

export async function createCompany(name) {
  try {
    const { caller, error } = await requireStaff();
    if (error) return { success: false, message: error };
    const clean = String(name ?? '').trim();
    if (clean.length < 2) return { success: false, message: 'Company name must be at least 2 characters' };
    // Uniqueness is enforced by the unique nameKey index (atomic), not by a pre-check.
    const company = await Company.create({ name: clean, createdBy: caller._id });
    revalidateCompanies();
    return { success: true, company: serialize(company) };
  } catch (error) {
    if (error?.code === 11000) return { success: false, message: DUPLICATE };
    console.error('Error creating company:', error);
    return { success: false, message: error.message };
  }
}

export async function renameCompany(id, name) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    if (!isValidObjectId(id)) return { success: false, message: 'Company not found' };
    const clean = String(name ?? '').trim();
    if (clean.length < 2) return { success: false, message: 'Company name must be at least 2 characters' };
    const company = await Company.findById(id);
    if (!company) return { success: false, message: 'Company not found' };
    company.name = clean;
    await company.save();
    revalidateCompanies();
    return { success: true, company: serialize(company) };
  } catch (error) {
    if (error?.code === 11000) return { success: false, message: DUPLICATE };
    console.error('Error renaming company:', error);
    return { success: false, message: error.message };
  }
}

async function setStatus(id, status) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    if (!isValidObjectId(id)) return { success: false, message: 'Company not found' };
    const res = await Company.updateOne({ _id: id }, { $set: { status } });
    if (res.matchedCount === 0) return { success: false, message: 'Company not found' };
    revalidateCompanies();
    return { success: true };
  } catch (error) {
    console.error('Error updating company status:', error);
    return { success: false, message: error.message };
  }
}

export async function archiveCompany(id) {
  return setStatus(id, 'archived');
}

export async function restoreCompany(id) {
  return setStatus(id, 'active');
}

// Staff may set any company's logo (pass companyId). A SPOC may set only their own company's.
export async function updateCompanyLogo(url, companyId = null) {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    if (!caller) return { success: false, message: 'Not authenticated' };
    let target;
    if (isStaff(caller)) {
      target = companyId;
      if (!target || !isValidObjectId(target)) return { success: false, message: 'Company is required' };
    } else if (caller.role === 'org_spoc' && caller.companyId) {
      if (companyId && !sameCompany(companyId, caller.companyId)) {
        return { success: false, message: 'Not authorized for this company' };
      }
      target = caller.companyId;
    } else {
      return { success: false, message: 'Only SPOCs can update their company logo' };
    }
    const res = await Company.updateOne({ _id: target }, { $set: { logoUrl: String(url ?? '') } });
    if (res.matchedCount === 0) return { success: false, message: 'Company not found' };
    revalidatePath('/dashboard');
    revalidatePath('/settings');
    revalidateCompanies();
    return { success: true };
  } catch (error) {
    console.error('Error updating company logo:', error);
    return { success: false, message: error.message };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass.** Run: `npm test -- tests/actions/companies.test.js`. Expected: all pass.

- [ ] **Step 5: Create `src/app/admin/companies/page.js`.**

```js
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listCompanies } from '@/app/companyActions';
import CompaniesClient from './CompaniesClient';

export const metadata = { title: 'Companies · Kindera' };

export default async function CompaniesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'employee') redirect('/dashboard');

  const { companies = [] } = await listCompanies({ includeArchived: true });
  return (
    <div className="w-full max-w-6xl mx-auto">
      <CompaniesClient companies={companies} />
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/admin/companies/CompaniesClient.js`.** It uses the existing UI vocabulary (`Button`, `Input`, `toast`, brand tokens, 44px tap targets, labelled icon buttons).

```js
'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Building2, Check, ImageUp, Loader2, Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cldImage } from '@/lib/cloudinary';
import {
  createCompany, renameCompany, archiveCompany, restoreCompany, updateCompanyLogo,
} from '@/app/companyActions';

export default function CompaniesClient({ companies }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const fileRef = useRef(null);
  const logoTarget = useRef(null);

  const visible = companies.filter((c) => showArchived || c.status === 'active');

  const act = (fn, successMessage, after) => startTransition(async () => {
    const res = await fn();
    if (res.success) {
      toast.success(successMessage);
      after?.();
      router.refresh();
    } else {
      toast.error(res.message);
    }
  });

  const handleCreate = (e) => {
    e.preventDefault();
    act(() => createCompany(newName), `${newName.trim()} added`, () => setNewName(''));
  };

  const handleRename = (id) => act(() => renameCompany(id, editName), 'Company renamed', () => setEditingId(null));

  const pickLogo = (id) => {
    logoTarget.current = id;
    fileRef.current?.click();
  };

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = logoTarget.current;
    if (!file || !id) return;
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'kindera/organization-logos');
      const upload = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await upload.json();
      if (!upload.ok) throw new Error(data.error || 'Upload failed');
      const res = await updateCompanyLogo(data.url, id);
      if (!res.success) throw new Error(res.message);
      toast.success('Logo updated');
      router.refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
          <p className="mt-1 text-sm text-gray-600">Corporate clients. SPOCs and employees are attached to one of these.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show archived
        </label>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row">
        <label htmlFor="new-company" className="sr-only">New company name</label>
        <Input id="new-company" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New company name, e.g. Tata Consultancy Services" className="flex-1" />
        <Button type="submit" disabled={isPending || newName.trim().length < 2}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
          Add company
        </Button>
      </form>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoFile} />

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3 text-right">SPOCs</th>
              <th className="px-6 py-3 text-right">Employees</th>
              <th className="px-6 py-3 text-right">Hours</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-gray-500">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
                  No companies yet. Add your first corporate client above.
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr key={c._id} className={`border-t border-gray-50 ${c.status === 'archived' ? 'opacity-60' : ''}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    {c.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cldImage(c.logoUrl, 80)} alt="" className="h-9 w-9 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white" aria-hidden="true">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {editingId === c._id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleRename(c._id); }} className="flex items-center gap-1">
                        <label htmlFor={`rename-${c._id}`} className="sr-only">Company name</label>
                        <Input id={`rename-${c._id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 w-56" autoFocus />
                        <Button type="submit" size="icon" aria-label="Save name" disabled={isPending}><Check className="h-4 w-4" aria-hidden="true" /></Button>
                        <Button type="button" size="icon" variant="outline" aria-label="Cancel rename" onClick={() => setEditingId(null)}><X className="h-4 w-4" aria-hidden="true" /></Button>
                      </form>
                    ) : (
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.status === 'archived' && <p className="text-xs text-gray-500">Archived</p>}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right tabular-nums">{c.spocCount}</td>
                <td className="px-6 py-4 text-right tabular-nums">{c.memberCount}</td>
                <td className="px-6 py-4 text-right font-semibold text-brand tabular-nums">{c.volunteerHours.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="outline" size="icon" aria-label={`Rename ${c.name}`} onClick={() => { setEditingId(c._id); setEditName(c.name); }}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="outline" size="icon" aria-label={`Upload logo for ${c.name}`} onClick={() => pickLogo(c._id)} disabled={uploadingId === c._id}>
                      {uploadingId === c._id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageUp className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                    {c.status === 'active' ? (
                      <Button variant="outline" size="icon" aria-label={`Archive ${c.name}`} disabled={isPending} onClick={() => act(() => archiveCompany(c._id), `${c.name} archived`)}>
                        <Archive className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" aria-label={`Restore ${c.name}`} disabled={isPending} onClick={() => act(() => restoreCompany(c._id), `${c.name} restored`)}>
                        <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Add the nav link.** In `src/components/Navbar.js`:
  - Add `Briefcase` to the `lucide-react` import list.
  - Directly after `navLinks.push({ label: 'Dashboard', href: '/admin', icon: LayoutDashboard, startsWith: true });`, add:

```js
    navLinks.push({ label: 'Companies', href: '/admin/companies', icon: Briefcase });
```

- [ ] **Step 8: Add the Control Centre card.** In `src/app/dashboard/DashboardClient.js`:
  - Add `Briefcase` to the `lucide-react` import.
  - Insert this object directly after the card whose `href` is `'/admin/corporate'`:

```js
  {
    title: 'Companies',
    description: 'Add corporate clients, set their logo, and archive old ones.',
    icon: Briefcase,
    href: '/admin/companies',
    accent: '#0d3b26',
    gradient: CATEGORY_STRIPS.brand,
    lightBg: '#f0f7f3',
  },
```

- [ ] **Step 9: Build and run all tests.** Run: `npm test && npm run build`. Expected: tests pass, the build succeeds, and `/admin/companies` is listed.

- [ ] **Step 10: Commit.**

```bash
git add src/app/companyActions.js src/app/admin/companies src/components/Navbar.js src/app/dashboard/DashboardClient.js tests/actions/companies.test.js
git commit -m "Add company admin actions and Companies screen"
```

---

### Task 6: Accounts: login, signup, admin registration, user lists

**Files:**
- Modify: `src/app/actions.js` (`login`, `registerUser`, `signup`, `getAllUsers`), `src/app/signup/page.js`, `src/app/admin/register/page.js`, `src/app/admin/register/RegisterForm.js`, `src/app/admin/users/UsersClient.js`
- Create: `tests/actions/accounts.test.js`

**Interfaces:**
- Consumes: `getCompanyName`, `getCompaniesByIds` (Task 2); `listCompanies` (Task 5); `makeWorld` (Task 3).
- Produces:
  - `login()`'s returned `user` has `companyId: string|null` and `companyName: string|null` (no `organizationName`).
  - `getAllUsers()` items have `companyName`, `ngoName`, `employerName`.
  - `registerUser(formData)` reads `companyId`.
  - `signup(formData)` reads `ngoName` / `employerName`.

- [ ] **Step 1: Write the failing tests** (`tests/actions/accounts.test.js`).

```js
import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeCompany } from '../helpers/factories.js';
import { login, registerUser, signup, getAllUsers } from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

describe('login', () => {
  it("returns the user's company id and name", async () => {
    const w = await makeWorld();
    const res = await login(form({ username: w.spocA.username, password: 'password123' }));
    expect(res.user).toMatchObject({ companyId: String(w.companyA._id), companyName: 'Acme' });
    expect(res.user).not.toHaveProperty('organizationName');
  });
});

describe('registerUser (admin)', () => {
  it('creates a SPOC attached to an active company', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await registerUser(form({ username: 'newspoc', password: 'secret123', name: 'New', role: 'org_spoc', companyId: String(w.companyB._id) }));
    expect(res.success).toBe(true);
    expect(String((await User.findOne({ username: 'newspoc' })).companyId)).toBe(String(w.companyB._id));
  });
  it('requires a company for SPOCs and employees', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await registerUser(form({ username: 'x', password: 'secret123', name: 'X', role: 'org_member' }));
    expect(res).toEqual({ success: false, message: 'Choose the company this person belongs to' });
  });
  it('rejects archived or unknown companies', async () => {
    const w = await makeWorld();
    const archived = await makeCompany('Old Co', { status: 'archived' });
    await actAs(w.admin);
    for (const companyId of [String(archived._id), 'aaaaaaaaaaaaaaaaaaaaaaaa', 'not-an-id']) {
      const res = await registerUser(form({ username: `u-${companyId}`, password: 'secret123', name: 'U', role: 'org_spoc', companyId }));
      expect(res.success).toBe(false);
    }
  });
});

describe('signup (public)', () => {
  const base = { name: 'Asha', password: 'secret123', confirmPassword: 'secret123' };
  it('creates a volunteer with an optional employer', async () => {
    const res = await signup(form({ ...base, username: 'asha', role: 'volunteer', employerName: 'Freelance' }));
    expect(res.success).toBe(true);
    expect((await User.findOne({ username: 'asha' })).employerName).toBe('Freelance');
  });
  it('creates an NGO with ngoName as its name', async () => {
    const res = await signup(form({ ...base, username: 'green', role: 'ngo', ngoName: 'Green Earth', ngoId: 'N-1' }));
    expect(res.success).toBe(true);
    const ngo = await User.findOne({ username: 'green' });
    expect(ngo).toMatchObject({ ngoName: 'Green Earth', name: 'Green Earth', status: 'pending' });
  });
  it('requires an NGO name for NGOs', async () => {
    const res = await signup(form({ ...base, username: 'nameless', role: 'ngo', ngoId: 'N-2' }));
    expect(res).toEqual({ success: false, message: 'NGO name is required' });
  });
  it('no longer accepts SPOC, employee or staff self-signup', async () => {
    for (const role of ['org_spoc', 'org_member', 'employee', 'admin']) {
      const res = await signup(form({ ...base, username: `self-${role}`, role }));
      expect(res).toEqual({ success: false, message: 'Invalid role selected' });
    }
    expect(await User.countDocuments({ username: /^self-/ })).toBe(0);
  });
});

describe('getAllUsers', () => {
  it('shows company, NGO and employer names', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const { users } = await getAllUsers();
    const byName = Object.fromEntries(users.map((u) => [u.username, u]));
    expect(byName[w.spocA.username].companyName).toBe('Acme');
    expect(byName[w.ngo.username].ngoName).toBe('Green Earth');
    expect(users.every((u) => !('organizationName' in u))).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/accounts.test.js`. Expected: FAIL. `login` returns `organizationName`, `registerUser` ignores `companyId`, and `signup` still accepts `org_spoc`.

- [ ] **Step 3: Add imports to `src/app/actions.js`.** Below `import Message from '@/models/Message';`, add:

```js
import Company from '@/models/Company';
import { isValidObjectId } from 'mongoose';
import {
  resolveCompanyAccess, eventVisibilityFilter, canSeeEvent, canManageEvent,
  getCompanyName, getCompaniesByIds, asObjectId,
} from '@/lib/company';
```

- [ ] **Step 4: Update `login`.** In the returned `user` object, replace `organizationName: user.organizationName,` with:

```js
          companyId: user.companyId ? String(user.companyId) : null,
          companyName: await getCompanyName(user.companyId),
```

- [ ] **Step 5: Update `registerUser`.**
  - Replace `const organizationName = formData.get('organizationName');` with `const companyId = formData.get('companyId');`.
  - Delete the `if ((role === 'org_spoc' || role === 'org_member') && !organizationName) {…}` block.
  - Replace the block `if (role === 'org_spoc' || role === 'org_member') { userData.organizationName = organizationName; }` with:

```js
    if (role === 'org_spoc' || role === 'org_member') {
      if (!companyId || !isValidObjectId(companyId)) {
        return { success: false, message: 'Choose the company this person belongs to' };
      }
      const company = await Company.findOne({ _id: companyId, status: 'active' }).select('_id').lean();
      if (!company) return { success: false, message: 'That company does not exist or is archived' };
      userData.companyId = company._id;
    }
```

- [ ] **Step 6: Update `signup`.**
  - Replace `const organizationName = formData.get('organizationName');` with:

```js
    const ngoName = (formData.get('ngoName') || '').trim();
    const employerName = (formData.get('employerName') || '').trim();
```

  - Delete the `if (role !== 'volunteer' && !organizationName) {…}` block.
  - Replace the role allow-list block (its comment and `if`) with:

```js
    // Public signup is for volunteers and NGOs. Admins register SPOCs and
    // employees against a Company; SPOCs generate their team's logins.
    if (!['volunteer', 'ngo'].includes(role)) {
      return { success: false, message: 'Invalid role selected' };
    }

    if (role === 'ngo' && !ngoName) {
      return { success: false, message: 'NGO name is required' };
    }
```

  - Replace the `if (role === 'ngo') { … } else { userData.organizationName = organizationName.trim(); }` block with:

```js
    if (role === 'ngo') {
      userData.ngoId = ngoId;
      userData.ngoName = ngoName;
      userData.name = ngoName; // an NGO's display name is its organisation
    } else {
      userData.employerName = employerName;
    }
```

- [ ] **Step 7: Update `getAllUsers`.**
  - In the `populate` call, change `select: 'title createdBy'` to `select: 'title createdBy companyId'` and `populate: { path: 'createdBy', select: 'organizationName name' }` to `populate: { path: 'createdBy', select: 'name companyId' }`.
  - Directly after the `User.find(...)` statement, add:

```js
    const companies = await getCompaniesByIds([
      ...users.map((u) => u.companyId),
      ...users.flatMap((u) => (u.eventRegistrations || []).flatMap((r) => [r.eventId?.companyId, r.eventId?.createdBy?.companyId])),
    ]);
    const companyName = (id) => (id ? companies.get(String(id))?.name ?? null : null);
```

  - Replace `organizationName: user.organizationName,` with:

```js
        companyId: user.companyId ? String(user.companyId) : null,
        companyName: companyName(user.companyId),
        ngoName: user.ngoName || '',
        employerName: user.employerName || '',
```

  - Replace `organizerName: reg.eventId?.createdBy?.organizationName || reg.eventId?.createdBy?.name || 'Unknown',` with:

```js
          organizerName: companyName(reg.eventId?.companyId) || companyName(reg.eventId?.createdBy?.companyId) || reg.eventId?.createdBy?.name || 'Unknown',
```

- [ ] **Step 8: Run the tests to verify they pass.** Run: `npm test -- tests/actions/accounts.test.js`. Expected: all pass.

- [ ] **Step 9: Update the signup page** (`src/app/signup/page.js`).
  - Delete `<SelectItem value="org_spoc">Organisation SPOC</SelectItem>`.
  - In `defaultValues`, replace `organizationName: '',` with `affiliation: '',`.
  - Replace `formData.append('organizationName', data.organizationName);` with:

```js
      if (data.role === 'ngo') formData.append('ngoName', data.affiliation);
      else formData.append('employerName', data.affiliation || '');
```

  - Replace the whole "Organization / NGO Name" block (the `<div className="space-y-2">` containing `htmlFor="organizationName"`) with:

```jsx
        <div className="space-y-2">
          <Label htmlFor="affiliation">{role === 'ngo' ? 'NGO Name' : 'Employer (Optional)'}</Label>
          <Input id="affiliation"
            placeholder={role === 'ngo' ? 'Enter your NGO name' : 'Where do you work? (optional)'}
            {...register('affiliation', {
              required: role === 'ngo' ? 'NGO name is required' : false,
              minLength: { value: 2, message: 'Must be at least 2 characters' },
            })} />
          {errors.affiliation && <p className="text-sm text-red-500">{errors.affiliation.message}</p>}
        </div>
```

- [ ] **Step 10: Pass companies to the register form** (`src/app/admin/register/page.js`).
  - Add `import { listCompanies } from '@/app/companyActions';`.
  - Before `return (`, add `const { companies = [] } = user.role === 'admin' ? await listCompanies() : { companies: [] };`.
  - Change `<RegisterForm userRole={user.role} />` to `<RegisterForm userRole={user.role} companies={companies} />`.

- [ ] **Step 11: Company picker in `RegisterForm.js`.**
  - Change the signature to `export default function RegisterForm({ userRole, companies = [] }) {`.
  - Add `watch` to the `useForm` destructuring: `const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({`.
  - In `defaultValues`, replace `organizationName: ''` with `companyId: ''`.
  - Replace `formData.append('organizationName', data.organizationName);` with `formData.append('companyId', data.companyId);`.
  - Replace `setValue('organizationName', '');` with `setValue('companyId', '');`.
  - Replace the whole `{showOrganizationField && (…)}` block with:

```jsx
          {showOrganizationField && (
            <div className="space-y-2">
              <Label htmlFor="companyId">Company</Label>
              <Select value={watch('companyId')} onValueChange={(v) => setValue('companyId', v, { shouldValidate: true })}>
                <SelectTrigger id="companyId" className="w-full">
                  <SelectValue placeholder={companies.length ? 'Select a company' : 'No companies yet'} />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <input type="hidden" {...register('companyId', { required: showOrganizationField ? 'Company is required' : false })} />
              {errors.companyId && <p className="text-sm text-red-500">{errors.companyId.message}</p>}
              {companies.length === 0 && (
                <p className="text-xs text-gray-500">
                  Add the company on the <a href="/admin/companies" className="underline">Companies</a> page first.
                </p>
              )}
            </div>
          )}
```

- [ ] **Step 12: Update `UsersClient.js` display.**
  - Replace all four occurrences of `user.organizationName || user.ngoId` (lines 93, 331, 333 and 348; line 331 is the `(…) &&` guard) with `user.companyName || user.ngoName || user.employerName || user.ngoId`.
  - Replace `(user.organizationName && user.organizationName.toLowerCase().includes(searchLower))` with `(user.companyName && user.companyName.toLowerCase().includes(searchLower))`.

- [ ] **Step 13: Build and run all tests.** Run: `npm test && npm run build`. Expected: pass.

- [ ] **Step 14: Commit.**

```bash
git add src/app/actions.js src/app/signup/page.js src/app/admin/register src/app/admin/users/UsersClient.js tests/actions/accounts.test.js
git commit -m "Accounts use companyId; public signup is volunteer and NGO only"
```

---

### Task 7: Event visibility and management

**Files:**
- Modify: `src/app/actions.js` (`createEvent`, `getHomeEvents`, `getEvents`, `getEventById`, `updateEvent`, `deleteEvent`, `getPendingEventRegistrations`, `updateEventRegistrationStatus`)
- Create: `tests/actions/events.test.js`

**Interfaces:**
- Consumes: `eventVisibilityFilter`, `canSeeEvent`, `canManageEvent`, `getCompanyName`, `getCompaniesByIds` (Task 2); `makeWorld`, `makeEvent` (Tasks 1, 3).
- Produces:
  - Event objects from `getEvents` and `getEventById` gain `companyId: string|null`; `getEventById` also gains `companyName`.
  - Pending registrations gain `companyName`.

- [ ] **Step 1: Write the failing tests** (`tests/actions/events.test.js`).

```js
import { describe, it, expect } from 'vitest';
import Event from '@/models/Event';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import {
  createEvent, getEvents, getHomeEvents, getEventById, updateEvent, deleteEvent,
  getPendingEventRegistrations, updateEventRegistrationStatus,
} from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};
const titles = (res) => res.events.map((e) => e.title).sort();

async function seedEvents(w) {
  await makeEvent(w.admin, { title: 'Admin public' });
  await makeEvent(w.ngo, { title: 'NGO public' });
  await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id });
  await makeEvent(w.spocB, { title: 'B internal', companyId: w.companyB._id });
  // Created by an NGO login but scoped to company A. It must not leak (guards project 2).
  await makeEvent(w.ngo, { title: 'NGO for A', companyId: w.companyA._id });
}

describe('event lists', () => {
  it('show logged-out visitors, volunteers and NGOs only public events', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    for (const who of [null, w.volunteer, w.ngo]) {
      await actAs(who);
      expect(titles(await getEvents())).toEqual(['Admin public', 'NGO public']);
    }
  });
  it("show every SPOC and employee of a company that company's events", async () => {
    const w = await makeWorld();
    await seedEvents(w);
    for (const who of [w.spocA, w.spocA2, w.memberA]) {
      await actAs(who);
      expect(titles(await getEvents())).toEqual(['A internal', 'Admin public', 'NGO for A', 'NGO public']);
    }
  });
  it("never show a company another company's events", async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.memberB);
    expect(titles(await getEvents())).toEqual(['Admin public', 'B internal', 'NGO public']);
  });
  it('show staff everything', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.employee);
    expect((await getEvents()).events).toHaveLength(5);
  });
  it('apply the same rule on the home page', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.volunteer);
    expect(titles(await getHomeEvents())).toEqual(['Admin public', 'NGO public']);
  });
  it('include companyId on each event', async () => {
    const w = await makeWorld();
    await seedEvents(w);
    await actAs(w.spocA);
    const internal = (await getEvents()).events.find((e) => e.title === 'A internal');
    expect(internal.companyId).toBe(String(w.companyA._id));
  });
});

describe('getEventById', () => {
  it('opens a company event for another SPOC of the same company', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await getEventById(String(ev._id));
    expect(res.success).toBe(true);
    expect(res.event).toMatchObject({ companyId: String(w.companyA._id), companyName: 'Acme' });
  });
  it('refuses other companies, volunteers and logged-out visitors', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.spocB, w.memberB, w.volunteer, null]) {
      await actAs(who);
      expect((await getEventById(String(ev._id))).success).toBe(false);
    }
  });
});

describe('createEvent', () => {
  const fields = { title: 'T', description: 'D', date: '2030-01-01T10:00', location: 'L' };
  it("scopes a SPOC's event to their company", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await createEvent(form(fields));
    expect(String((await Event.findById(res.event._id)).companyId)).toBe(String(w.companyA._id));
  });
  it('keeps admin and NGO events public', async () => {
    const w = await makeWorld();
    for (const who of [w.admin, w.ngo]) {
      await actAs(who);
      const res = await createEvent(form(fields));
      expect((await Event.findById(res.event._id)).companyId).toBeNull();
    }
  });
});

describe('update and delete', () => {
  it("let any SPOC of the company edit and delete the company's events", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    expect((await updateEvent(String(ev._id), form({ title: 'Renamed', description: 'D', date: '2030-01-01T10:00', location: 'L', status: 'upcoming' }))).success).toBe(true);
    expect((await deleteEvent(String(ev._id))).success).toBe(true);
  });
  it('refuse employees of the company and other companies', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.memberA, w.spocB]) {
      await actAs(who);
      expect((await deleteEvent(String(ev._id))).success).toBe(false);
    }
    expect(await Event.countDocuments({ _id: ev._id })).toBe(1);
  });
});

describe('registration review', () => {
  it("shows a SPOC the pending registrations for any of their company's events", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'pending' } } });
    await actAs(w.spocA2);
    const { users } = await getPendingEventRegistrations();
    expect(users.map((u) => u._id)).toEqual([String(w.memberA._id)]);
    expect(users[0].companyName).toBe('Acme');
  });
  it("lets any SPOC of the company approve, and refuses another company's SPOC", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await User.updateOne({ _id: w.memberA._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'pending' } } });
    await actAs(w.spocB);
    expect((await updateEventRegistrationStatus(form({ userId: String(w.memberA._id), eventId: String(ev._id), status: 'approved' }))).success).toBe(false);
    await actAs(w.spocA2);
    expect((await updateEventRegistrationStatus(form({ userId: String(w.memberA._id), eventId: String(ev._id), status: 'approved' }))).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/events.test.js`. Expected: FAIL. "NGO for A" leaks to volunteers, `spocA2` can't see "A internal", and `companyId` is undefined.

- [ ] **Step 3: `createEvent`.** Replace `organizationName: user.role === 'org_spoc' ? user.organizationName : null,` with:

```js
      companyId: user.role === 'org_spoc' ? user.companyId : null,
```

- [ ] **Step 4: `getHomeEvents` and `getEvents`.** In both functions, replace the entire `if (!currentUser || currentUser.role === 'volunteer') { … } else if (currentUser.role === 'org_spoc') { … } else if (currentUser.role === 'org_member') { … }` chain with:

```js
    Object.assign(filter, eventVisibilityFilter(currentUser));
```

In `getEvents`' serialised event, add after `status: event.status,`:

```js
        companyId: event.companyId ? String(event.companyId) : null,
```

- [ ] **Step 5: `getEventById`.** Replace the whole `if (event.organizationName) { … }` block with:

```js
    if (!canSeeEvent(currentUser, event)) {
      return {
        success: false,
        message: currentUser ? 'You do not have permission to view this event' : 'You must be logged in to view this private event',
      };
    }
```

In the returned `event` object, add after `status: event.status,`:

```js
        companyId: event.companyId ? String(event.companyId) : null,
        companyName: await getCompanyName(event.companyId),
```

- [ ] **Step 6: `updateEvent` and `deleteEvent`.** Replace each `if (user.role !== 'admin' && event.createdBy.toString() !== user._id.toString()) {` with `if (!canManageEvent(user, event)) {`. Change the comments above them to `// Admins, the creator, or any SPOC of the event's company`.

- [ ] **Step 7: `getPendingEventRegistrations`.**
  - Replace the `eventQuery` block (from `let eventQuery = { createdBy: currentUser._id };` through the closing `}` of its `if`) with:

```js
    // Admin: all events. SPOC: every event of their company. Others: events they created.
    let eventQuery = { createdBy: currentUser._id };
    if (currentUser.role === 'admin') eventQuery = {};
    else if (currentUser.role === 'org_spoc' && currentUser.companyId) eventQuery = { companyId: currentUser.companyId };
```

  - After the `User.find(...)` statement, add `const companies = await getCompaniesByIds(users.map((u) => u.companyId));`.
  - Replace `organizationName: user.organizationName || '',` with `companyName: companies.get(String(user.companyId))?.name || '',`.

- [ ] **Step 8: `updateEventRegistrationStatus`.** Replace:

```js
    if (currentUser.role !== 'admin') {
      if (event.createdBy.toString() !== currentUser._id.toString()) {
        return { success: false, message: 'Not authorized. This user registered for another organizer\'s event.' };
      }
    }
```

with:

```js
    if (!event) return { success: false, message: 'Event not found' };
    if (!canManageEvent(currentUser, event)) {
      return { success: false, message: 'Not authorized. This user registered for another organizer\'s event.' };
    }
```

- [ ] **Step 9: Run the tests.** Run: `npm test -- tests/actions/events.test.js`. Expected: all pass. Then `npm test && npm run build`. Expected: pass.

- [ ] **Step 10: Commit.**

```bash
git add src/app/actions.js tests/actions/events.test.js
git commit -m "Event visibility and management by company"
```

---

### Task 8: Event registration

**Files:**
- Modify: `src/app/actions.js` (`registerForEvent`, `registerForEventLoggedIn`), `src/app/events/[eventId]/register/page.js`, `src/app/events/[eventId]/register/EventRegisterClient.js`
- Create: `tests/actions/registration.test.js`

**Interfaces:**
- Consumes: `canSeeEvent`, `getCompanyName` (Task 2); `getEventById` now returns `companyId` (Task 7).
- Produces: `EventRegisterClient` takes a new `companyName` prop.

- [ ] **Step 1: Write the failing tests** (`tests/actions/registration.test.js`).

```js
import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import { registerForEvent, registerForEventLoggedIn } from '@/app/actions';

const guestForm = () => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ username: 'guest1', password: 'secret123', name: 'Guest' })) fd.append(k, v);
  return fd;
};

describe('internal company events', () => {
  it("let an employee join an event created by any SPOC of their company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA2, { companyId: w.companyA._id });
    await actAs(w.memberA); // memberA's spocId is spocA, not spocA2
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(true);
  });
  it("refuse employees and SPOCs of other companies", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    for (const who of [w.memberB, w.spocB, w.volunteer]) {
      await actAs(who);
      expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    }
  });
  it("don't let a SPOC register themselves for their own company's internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await registerForEventLoggedIn(String(ev._id), '');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/internal event/);
  });
  it('refuse guest registration', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    expect((await registerForEvent(guestForm(), String(ev._id))).success).toBe(false);
  });
});

describe('public events', () => {
  it('make an employee wait until any SPOC of their company has registered', async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.memberA);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
    await User.updateOne({ _id: w.spocA2._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved', volunteersCount: 5 } } });
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(true);
  });
  it("don't count another company's SPOC registration", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await User.updateOne({ _id: w.spocB._id }, { $push: { eventRegistrations: { eventId: ev._id, status: 'approved' } } });
    await actAs(w.memberA);
    expect((await registerForEventLoggedIn(String(ev._id), '')).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/registration.test.js`. Expected: FAIL, because the code still uses `event.organizationName` and `spocId`.

- [ ] **Step 3: `registerForEvent`.** Replace `if (event.organizationName) {` with `if (event.companyId) {`.

- [ ] **Step 4: `registerForEventLoggedIn`.** Replace the block from `// Role-based registration restrictions for internal/global events` through the closing `}` of its `else { … }` with:

```js
    // Internal company events: employees of that company only.
    // Public events: an employee joins once any SPOC of their company has registered it.
    if (event.companyId) {
      if (!canSeeEvent(currentUser, event)) {
        return { success: false, message: 'Only members of the hosting company can register for this event.' };
      }
      if (currentUser.role === 'org_spoc') {
        return { success: false, message: 'This is an internal event for your company. Ask your team to register.' };
      }
      if (currentUser.role !== 'org_member') {
        return { success: false, message: 'Only members of the hosting company can register for this event.' };
      }
    } else if (currentUser.role === 'org_member') {
      const spocDoc = await User.findOne({
        role: 'org_spoc',
        companyId: currentUser.companyId,
        'eventRegistrations.eventId': eventId,
      });
      if (!spocDoc) {
        return { success: false, message: 'Your company has not registered for this event yet. Please contact your SPOC.' };
      }
    }
```

- [ ] **Step 5: Run the tests to verify they pass.** Run: `npm test -- tests/actions/registration.test.js`. Expected: all pass.

- [ ] **Step 6: Register page** (`src/app/events/[eventId]/register/page.js`).
  - Add `import { getCompanyName } from '@/lib/company';`.
  - In the `spocDoc` query, replace `organizationName: user.organizationName,` with `companyId: user.companyId,`.
  - Before `return (`, add `const companyName = user?.companyId ? await getCompanyName(user.companyId) : null;`.
  - Add the prop `companyName={companyName}` to `<EventRegisterClient … />`.

- [ ] **Step 7: `EventRegisterClient.js`.**
  - Add `companyName` to the destructured props of the component function.
  - Replace `const isGlobalEvent = !event.organizationName; // NGO or Admin event` with `const isGlobalEvent = !event.companyId; // not scoped to a company`.
  - Replace `currentUser.organizationName || 'your organisation'` with `companyName || 'your company'`.
  - Replace `<strong>{currentUser.organizationName}</strong>` with `<strong>{companyName || 'your company'}</strong>`.

- [ ] **Step 8: Build and run all tests.** Run: `npm test && npm run build`. Expected: pass.

- [ ] **Step 9: Commit.**

```bash
git add src/app/actions.js "src/app/events/[eventId]/register" tests/actions/registration.test.js
git commit -m "Event registration by company; any SPOC unlocks public events"
```

---

### Task 9: Team logins and attendance

**Files:**
- Modify: `src/app/actions.js` (`generateTeamLogins`, `bulkCreateFromExcel`, `getOrgMembers`, `markAttendance`, `getEventAttendance`, `logMyHoursAndFeedback`)
- Modify screens:
  - `src/app/dashboard/team/generate/page.js`
  - `src/app/dashboard/team/generate/GenerateLoginsClient.js`
  - `src/app/dashboard/team/page.js` (the `getOrgMembers` call only)
  - `src/app/dashboard/team/TeamClient.js`
  - `src/app/dashboard/attendance/page.js`
  - `src/app/dashboard/attendance/[eventId]/page.js`
  - `src/app/dashboard/attendance/[eventId]/AttendanceClient.js`
- Create: `tests/actions/team-attendance.test.js`

**Interfaces:**
- Consumes: `resolveCompanyAccess`, `canSeeEvent`, `getCompanyName` (Task 2).
- Produces:
  - `generateTeamLogins(formData)` reads `companyId`; SPOCs are pinned to their own.
  - `bulkCreateFromExcel(rows, companyId)`
  - `getOrgMembers(companyId)`
  - `getEventAttendance(eventId, companyId)`
  - `AttendanceClient` props `{ event, initialRecords, companyId, companyName }`
  - `GenerateLoginsClient` props `{ role, companyId, companyName }`

- [ ] **Step 1: Write the failing tests** (`tests/actions/team-attendance.test.js`).

```js
import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import {
  generateTeamLogins, bulkCreateFromExcel, getOrgMembers, markAttendance, getEventAttendance, logMyHoursAndFeedback,
} from '@/app/actions';

const form = (fields) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
};

describe('team logins', () => {
  it("put a SPOC's generated logins in the SPOC's company, ignoring any other company sent", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await generateTeamLogins(form({ count: '2', companyId: String(w.companyB._id) }));
    expect(res.success).toBe(true);
    const created = await User.find({ username: { $in: res.credentials.map((c) => c.username) } });
    expect(created.every((u) => String(u.companyId) === String(w.companyA._id))).toBe(true);
    expect(created.every((u) => String(u.spocId) === String(w.spocA2._id))).toBe(true);
  });
  it('make admins choose an active company', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect((await generateTeamLogins(form({ count: '1' }))).success).toBe(false);
    const res = await generateTeamLogins(form({ count: '1', companyId: String(w.companyB._id) }));
    expect(String((await User.findOne({ username: res.credentials[0].username })).companyId)).toBe(String(w.companyB._id));
  });
  it('create Excel rows in the right company', async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    const res = await bulkCreateFromExcel([{ name: 'Ravi' }], String(w.companyB._id));
    expect(String((await User.findOne({ username: res.credentials[0].username })).companyId)).toBe(String(w.companyA._id));
  });
  it('refuse employees and volunteers', async () => {
    const w = await makeWorld();
    for (const who of [w.memberA, w.volunteer]) {
      await actAs(who);
      expect((await generateTeamLogins(form({ count: '1' }))).success).toBe(false);
    }
  });
});

describe('getOrgMembers', () => {
  it('list every employee of the company to every SPOC', async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await getOrgMembers(String(w.companyA._id));
    expect(res.members.map((m) => m._id)).toEqual([String(w.memberA._id)]);
  });
  it("refuse another company's list", async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    expect((await getOrgMembers(String(w.companyB._id))).success).toBe(false);
  });
});

describe('attendance', () => {
  it("let any SPOC of the company mark its employees and record the employee's company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocA, { companyId: w.companyA._id });
    await actAs(w.spocA2);
    const res = await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 3 }]);
    expect(res.success).toBe(true);
    const att = await Attendance.findOne({ eventId: ev._id, userId: w.memberA._id });
    expect(String(att.companyId)).toBe(String(w.companyA._id));
    expect((await User.findById(w.memberA._id)).totalVolunteerHours).toBe(3);
  });
  it("refuse a SPOC marking another company's employees", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await actAs(w.spocB);
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 3 }])).success).toBe(false);
    expect(await Attendance.countDocuments()).toBe(0);
  });
  it("refuse a SPOC marking attendance on another company's internal event", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.spocB, { companyId: w.companyB._id });
    await actAs(w.spocA);
    expect((await markAttendance(String(ev._id), [{ userId: String(w.memberA._id), attended: true, hoursContributed: 1 }])).success).toBe(false);
  });
  it("pin a SPOC's attendance view to their own company", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin);
    await Attendance.create({ eventId: ev._id, userId: w.memberA._id, companyId: w.companyA._id, attended: true });
    await Attendance.create({ eventId: ev._id, userId: w.memberB._id, companyId: w.companyB._id, attended: true });
    await actAs(w.spocA);
    const res = await getEventAttendance(String(ev._id), null);
    expect(res.records.map((r) => r.userId)).toEqual([String(w.memberA._id)]);
    expect((await getEventAttendance(String(ev._id), String(w.companyB._id))).success).toBe(false);
  });
  it("record the employee's company when they log their own hours", async () => {
    const w = await makeWorld();
    const ev = await makeEvent(w.admin, { date: new Date(Date.now() - 86400000) });
    await actAs(w.memberA);
    expect((await logMyHoursAndFeedback(String(ev._id), 2, 5)).success).toBe(true);
    expect(String((await Attendance.findOne({ userId: w.memberA._id })).companyId)).toBe(String(w.companyA._id));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/team-attendance.test.js`. Expected: FAIL.

- [ ] **Step 3: Add a shared helper** in `src/app/actions.js`, directly above `export async function generateTeamLogins`:

```js
// Which active company new team logins go into: a SPOC's own; an admin must name one.
async function teamCompanyFor(caller, requestedCompanyId) {
  const id = caller.role === 'org_spoc' ? caller.companyId : requestedCompanyId;
  if (!id || !isValidObjectId(String(id))) return null;
  return Company.findOne({ _id: id, status: 'active' }).select('name').lean();
}

const slugify = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
```

- [ ] **Step 4: `generateTeamLogins`.**
  - Replace the lines from `const orgName = formData.get('orgName')?.trim();` through `const orgSlug = …;` with:

```js
    const company = await teamCompanyFor(caller, formData.get('companyId'));
    const count   = parseInt(formData.get('count'));

    if (!company || !count || count < 1 || count > 500) {
      return { success: false, message: 'Choose a company and a count (1–500)' };
    }
    const orgName = company.name;
    const orgSlug = slugify(orgName);
```

  - Replace `User.find({ organizationName: orgName, role: 'org_member' })` with `User.find({ companyId: company._id, role: 'org_member' })`.
  - Replace `organizationName: orgName,` with `companyId: company._id,`.

- [ ] **Step 5: `bulkCreateFromExcel`.**
  - Change the signature to `export async function bulkCreateFromExcel(rows, companyId = null) {`.
  - Replace the block `if (!rows?.length || !orgName) { … }` and the `const orgSlug = …` line with:

```js
    const company = await teamCompanyFor(caller, companyId);
    if (!rows?.length || !company) {
      return { success: false, message: 'Rows and a company are required' };
    }
    const orgName = company.name;
    const orgSlug = slugify(orgName);
```

  - Replace `organizationName: orgName,` with `companyId: company._id,`.
  - Replace `spocId: spocId || (caller.role === 'org_spoc' ? caller._id : null),` with `spocId: caller.role === 'org_spoc' ? caller._id : null,`.

- [ ] **Step 6: `getOrgMembers`.** Replace the function body's opening lines and the query, from `const access = await resolveOrgAccess(requestedOrg);` through `.select('-password').lean();`, with:

```js
    const access = resolveCompanyAccess(await getCurrentUser(), requestedOrg);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: true, members: [] };

    const members = await User.find({ companyId: access.companyId, role: 'org_member' })
      .select('-password').lean();
```

Rename the parameter: `export async function getOrgMembers(requestedOrg) {` becomes `export async function getOrgMembers(companyId) {`, and use `companyId` in the `resolveCompanyAccess` call.

- [ ] **Step 7: `markAttendance`.**
  - Replace the whole `// SPOCs may only mark attendance for members of their own organisation` block with:

```js
    const event = await Event.findById(eventId).select('companyId').lean();
    if (!event) return { success: false, message: 'Event not found' };
    const people = await User.find({ _id: { $in: userIds } }).select('companyId').lean();
    const companyOf = new Map(people.map((p) => [String(p._id), p.companyId || null]));

    // SPOCs may only mark their own company's employees, on events their company can see.
    if (caller.role === 'org_spoc') {
      const outsiders = userIds.filter((id) => !companyOf.has(String(id)) || String(companyOf.get(String(id))) !== String(caller.companyId));
      if (outsiders.length > 0 || !canSeeEvent(caller, event)) {
        return { success: false, message: 'You can only mark attendance for your own company' };
      }
    }
```

  - In the `$set`, replace `organizationName: caller.organizationName || entry.organizationName,` with `companyId: companyOf.get(String(entry.userId)) ?? null,`.

- [ ] **Step 8: `getEventAttendance`.**
  - Change the signature to `(eventId, companyId)`.
  - Replace its access lines and `if (orgName) filter.organizationName = orgName;` with:

```js
    const access = resolveCompanyAccess(await getCurrentUser(), companyId);
    if (access.error) return { success: false, message: access.error };

    const filter = { eventId };
    if (access.companyId) filter.companyId = access.companyId;
```

- [ ] **Step 9: `logMyHoursAndFeedback`.** Replace `organizationName: caller.organizationName, // Ensure org name is captured` with `companyId: caller.companyId ?? null,`.

- [ ] **Step 10: Run the tests to verify they pass.** Run: `npm test -- tests/actions/team-attendance.test.js`. Expected: all pass.

- [ ] **Step 11: Generate-logins page** (`src/app/dashboard/team/generate/page.js`). Replace the file with:

```js
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getCompanyName } from '@/lib/company';
import GenerateLoginsClient from './GenerateLoginsClient';

export default async function GenerateLoginsPage({ searchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && user.role !== 'org_spoc') redirect('/dashboard');

  // SPOCs: their own company. Admins: the company chosen on the Corporate overview.
  const params = await searchParams;
  const companyId = user.role === 'org_spoc' ? String(user.companyId) : params?.company;
  if (!companyId) redirect('/admin/corporate');
  const companyName = await getCompanyName(companyId);
  if (!companyName) redirect(user.role === 'admin' ? '/admin/corporate' : '/dashboard');

  return (
    <div className="w-full max-w-4xl mx-auto">
      <GenerateLoginsClient role={user.role} companyId={companyId} companyName={companyName} />
    </div>
  );
}
```

- [ ] **Step 12: `GenerateLoginsClient.js`.**
  - Change the signature to `export default function GenerateLoginsClient({ role, companyId, companyName }) {`.
  - Delete `const searchParams = useSearchParams();` and `const orgParam = searchParams.get('org');`, and remove `useSearchParams` from its import.
  - Delete the `const [orgName, setOrgName] = useState(…)` line and add `const orgName = companyName;`.
  - In `handleQuickGenerate`:
    - replace `if (!orgName.trim() || !count || count < 1 || count > 500) {` with `if (!count || count < 1 || count > 500) {`;
    - replace the toast text with `'Please enter a count between 1 and 500'`;
    - replace `fd.append('orgName', orgName);` with `fd.append('companyId', companyId);`.
  - In the Excel handler:
    - replace `if (!excelFile || !orgName.trim()) {` with `if (!excelFile) {`, and its toast with `'Please select an Excel file'`;
    - replace `bulkCreateFromExcel(rows, orgName)` with `bulkCreateFromExcel(rows, companyId)`.
  - Replace both "Organisation Name" `<div>` blocks (the quick form one, and the `role === 'admin'` one in the Excel form) with this single read-only block. In the Excel form it is no longer wrapped in `role === 'admin' &&`.

```jsx
                <div>
                  <p className="block text-sm font-semibold text-gray-700 mb-1.5">Company</p>
                  <p className="w-full h-11 flex items-center rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-700">{companyName}</p>
                </div>
```

  - Replace `disabled={isPending || !orgName || !count}` with `disabled={isPending || !count}`, and `disabled={isPending || !excelFile || !orgName}` with `disabled={isPending || !excelFile}`.

- [ ] **Step 13: Team page and TeamClient.**
  - In `src/app/dashboard/team/page.js`, replace `getOrgMembers(orgName),` with `getOrgMembers(user.companyId ? String(user.companyId) : null),`. Leave `getOrgStats(orgName)` for Task 10.
  - In `src/app/dashboard/team/TeamClient.js`, delete the `{(member.organizationName || member.ngoId) && ( … )}` block (lines 95–99). Members always belong to the viewer's company.

- [ ] **Step 14: Attendance pages.**
  - In `src/app/dashboard/attendance/[eventId]/page.js`:
    - Add `import { getCompanyName } from '@/lib/company';`.
    - Replace the `filterOrg` lines and the `getEventAttendance` call with:

```js
  // SPOCs see their own company's attendance; admins see everyone's.
  const companyId = user.role === 'org_spoc' && user.companyId ? String(user.companyId) : null;
  const companyName = companyId ? await getCompanyName(companyId) : null;
  const { records = [] } = await getEventAttendance(eventId, companyId);
```

    - Change the `orgName={…}` prop to `companyId={companyId} companyName={companyName}`.
  - In `AttendanceClient.js`:
    - the signature becomes `({ event, initialRecords, companyId, companyName })`;
    - replace `if (orgName !== 'All Organizations') {` with `if (companyId) {`;
    - replace `getOrgMembers(orgName)` with `getOrgMembers(companyId)`;
    - in the effect dependency array replace `orgName` with `companyId`;
    - in the payload, delete `organizationName: orgName,`;
    - replace any other remaining `orgName` text in the JSX with `companyName || 'All companies'`. Check with `grep -n orgName src/app/dashboard/attendance/\[eventId\]/AttendanceClient.js`, which must print nothing.
  - In `src/app/dashboard/attendance/page.js`:
    - replace `User.find({ organizationName: user.organizationName })` with `User.find({ companyId: user.companyId })`;
    - replace the `events = allEvents.filter(…)` expression with:

```js
    events = allEvents.filter((e) =>
      e.companyId
        ? e.companyId === String(user.companyId)       // any internal event of this company
        : registeredEventIds.has(e._id.toString())     // public events the company joined
    );
```

- [ ] **Step 15: Build and run all tests.** Run: `npm test && npm run build`. Expected: pass.

- [ ] **Step 16: Commit.**

```bash
git add src/app/actions.js src/app/dashboard/team src/app/dashboard/attendance tests/actions/team-attendance.test.js
git commit -m "Team logins and attendance shared across a company's SPOCs"
```

---

### Task 10: Stats, history, directory and impact

**Files:**
- Modify: `src/app/actions.js`:
  - `getOrgStats`, `getAllCorporateStats`, `getDetailedDirectoryStats`, `exportDetailedAttendanceData`
  - `getImpactStats`, `getAdminImpactStats`
  - `getAllEventsHistory`, `getAdminEventDetails`, `getOrgEventsHistory`, `getMyImpact`
  - removes `resolveOrgAccess`
- Modify screens:
  - `src/app/dashboard/page.js`
  - `src/app/dashboard/team/page.js`
  - `src/app/admin/corporate/CorporateOverviewClient.js`
  - `src/app/admin/directory/DirectoryClient.js`
  - `src/app/admin/events-history/EventsHistoryClient.js`
  - `src/app/admin/events-history/EventDetailsModal.js`
  - `src/app/dashboard/events-history/page.js`
  - `src/app/dashboard/events-history/CorporateEventsHistoryClient.js`
  - `src/app/dashboard/my-impact/MyImpactClient.js`
- Create: `tests/actions/stats.test.js`

**Interfaces:**
- Consumes: `resolveCompanyAccess`, `canSeeEvent`, `asObjectId`, `getCompaniesByIds`, `getCompanyName` (Task 2).
- Produces:
  - `getOrgStats(companyId, year)`
  - `getAllCorporateStats()` → `orgs: [{ companyId, name, spocNames, memberCount, volunteerHours, eventsAttended, joinedAt }]`
  - `getDetailedDirectoryStats()` SPOC rows gain `companyId`, `companyName`
  - `exportDetailedAttendanceData(companyId, year, quarter)` rows have `companyName`
  - `getAllEventsHistory()` items have `companyId`, `companyName`, `createdBy.companyName`; `corporateDetails[].orgName` holds the company name
  - `getAdminEventDetails()` returns `event.companyName`, `createdBy.companyName`, `participants[].companyName`
  - `getOrgEventsHistory(companyId)`
  - `getMyImpact()` returns `stats.companyName`, `stats.companyLogo`, `events[].companyName`

- [ ] **Step 1: Write the failing tests** (`tests/actions/stats.test.js`).

```js
import { describe, it, expect } from 'vitest';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import Company from '@/models/Company';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import {
  getOrgStats, getAllCorporateStats, getAdminImpactStats, getAllEventsHistory, getAdminEventDetails,
  getOrgEventsHistory, getMyImpact, exportDetailedAttendanceData, getImpactStats,
} from '@/app/actions';

async function seedAttendance(w) {
  const pub = await makeEvent(w.admin, { title: 'Public', date: new Date(Date.now() - 86400000) });
  const internalA = await makeEvent(w.spocA, { title: 'A internal', companyId: w.companyA._id, date: new Date(Date.now() - 86400000) });
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
  });
  it("refuses another company's stats", async () => {
    const w = await makeWorld();
    await actAs(w.spocB);
    expect((await getOrgStats(String(w.companyA._id))).success).toBe(false);
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
    const publicRow = history.find((h) => h._id === String(pub._id));
    expect(publicRow.corporateDetails.map((c) => c.orgName).sort()).toEqual(['Acme', 'Beta']);
  });
  it('exports attendance rows with company names, filtered by company', async () => {
    const w = await makeWorld();
    await seedAttendance(w);
    await actAs(w.admin);
    const { data } = await exportDetailedAttendanceData(String(w.companyB._id));
    expect(data.map((r) => r.companyName)).toEqual(['Beta']);
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
  it("refuse a SPOC details of another company's internal event", async () => {
    const w = await makeWorld();
    const { internalA } = await seedAttendance(w);
    await actAs(w.spocB);
    expect((await getAdminEventDetails(String(internalA._id))).success).toBe(false);
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
  it("show an employee their company's name and logo", async () => {
    const w = await makeWorld();
    await Company.updateOne({ _id: w.companyA._id }, { logoUrl: 'https://x/acme.png' });
    await seedAttendance(w);
    await actAs(w.memberA);
    const { stats, events } = await getMyImpact();
    expect(stats).toMatchObject({ companyName: 'Acme', companyLogo: 'https://x/acme.png' });
    expect(events.find((e) => e.title === 'A internal').companyName).toBe('Acme');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/stats.test.js`. Expected: FAIL.

- [ ] **Step 3: `getOrgStats`.**
  - Change the signature to `getOrgStats(companyId, targetYear)`.
  - Replace its first access lines (`const access = await resolveOrgAccess(requestedOrg);` through `if (!orgName) …`) with:

```js
    const access = resolveCompanyAccess(await getCurrentUser(), companyId);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: false, message: 'Company is required' };
    const company = asObjectId(access.companyId);
```

  - Then:
    - replace `User.countDocuments({ organizationName: orgName, role: 'org_member' })` with `User.countDocuments({ companyId: company, role: 'org_member' })`;
    - replace each `{ $match: { organizationName: orgName,` (three occurrences) with `{ $match: { companyId: company,`;
    - in the `Event.find` select string, replace `organizationName` with `companyId`;
    - replace `isCorporate: !!ev.organizationName, // corporate/personal vs global` with `isCorporate: !!ev.companyId, // internal company event vs public`.

- [ ] **Step 4: `getAllCorporateStats`.** Replace everything from `// Get all distinct orgs with their SPOCs` to `return { success: true, orgs };` with:

```js
    const companies = await Company.find({ status: 'active' }).sort({ name: 1 }).lean();
    const ids = companies.map((c) => c._id);
    const [spocs, memberCounts, attendance] = await Promise.all([
      User.find({ role: 'org_spoc', companyId: { $in: ids } }).select('name companyId').lean(),
      User.aggregate([{ $match: { role: 'org_member', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      Attendance.aggregate([
        { $match: { attended: true, companyId: { $in: ids } } },
        { $group: { _id: '$companyId', hours: { $sum: '$hoursContributed' }, events: { $addToSet: '$eventId' } } },
      ]),
    ]);
    const membersBy = new Map(memberCounts.map((m) => [String(m._id), m.n]));
    const attendanceBy = new Map(attendance.map((a) => [String(a._id), a]));

    const orgs = companies.map((c) => {
      const id = String(c._id);
      const a = attendanceBy.get(id) || {};
      return {
        companyId: id,
        name: c.name,
        spocNames: spocs.filter((s) => String(s.companyId) === id).map((s) => s.name),
        memberCount: membersBy.get(id) || 0,
        volunteerHours: a.hours || 0,
        eventsAttended: (a.events || []).length,
        joinedAt: c.createdAt ? c.createdAt.toISOString() : null,
      };
    });

    return { success: true, orgs };
```

- [ ] **Step 5: `getDetailedDirectoryStats`.**
  - Change the SPOC `.select('name username organizationName status createdAt mobile')` to `.select('name username companyId status createdAt mobile')`.
  - After that query, add `const companies = await getCompaniesByIds(spocs.map((s) => s.companyId));`.
  - In the per-SPOC callback:
    - replace `organizationName: spoc.organizationName,` (member query) with `companyId: spoc.companyId,`;
    - replace `{ $match: { organizationName: spoc.organizationName, attended: true } },` with `{ $match: { companyId: spoc.companyId, attended: true } },`;
    - in the returned object, replace `organizationName: spoc.organizationName,` with:

```js
        companyId:       spoc.companyId ? String(spoc.companyId) : null,
        companyName:     companies.get(String(spoc.companyId))?.name || '',
```

- [ ] **Step 6: `exportDetailedAttendanceData`.**
  - Change the signature to `(companyId = null, year = null, quarter = null)`.
  - Replace `if (orgName) { query.organizationName = orgName; }` with `if (companyId && isValidObjectId(companyId)) query.companyId = companyId;`.
  - Add `.populate('companyId', 'name')` before `.lean()`.
  - Replace `organizationName: record.organizationName || 'Individual',` with `companyName: record.companyId?.name || 'Individual',`.

- [ ] **Step 7: `getImpactStats` and `getAdminImpactStats`.** In both, replace `User.distinct('organizationName', { organizationName: { $ne: null } }),` with `Company.countDocuments({ status: 'active' }),`.
  - In `getImpactStats`, change `organisations: orgUsers.length,` to `organisations: orgUsers,`.
  - In `getAdminImpactStats`, change `totalOrgs: totalOrgs.length,` to `totalOrgs,`.
  - Also in `getAdminImpactStats`, replace `_id: '$organizationName',` with `_id: '$companyId',`, and replace the `const topOrgs = orgStats.map(…)` statement with:

```js
    const topCompanies = await getCompaniesByIds(orgStats.map((o) => o._id));
    const topOrgs = orgStats.map((o) => ({
      name: topCompanies.get(String(o._id))?.name || 'Individual',
      hours: o.hours,
      volunteers: o.volunteers,
    }));
```

- [ ] **Step 8: `getAllEventsHistory`.**
  - Change `.populate('createdBy', 'name role organizationName')` to `.populate('createdBy', 'name role companyId')`.
  - Replace `orgName: '$organizationName'` with `companyId: '$companyId'`.
  - Directly before `const corpDetailsMap`, add:

```js
    const historyCompanies = await getCompaniesByIds([
      ...events.flatMap((e) => [e.companyId, e.createdBy?.companyId]),
      ...corpDetailsAgg.map((c) => c._id.companyId),
    ]);
    const nameOf = (id) => (id ? historyCompanies.get(String(id))?.name ?? null : null);
```

  - Replace `const orgName = curr._id.orgName || 'Unknown Corporation';` with `const orgName = nameOf(curr._id.companyId) || 'Unknown company';`.
  - In the returned item:
    - replace `organizationName: event.organizationName || null,` with:

```js
        companyId: event.companyId ? String(event.companyId) : null,
        companyName: nameOf(event.companyId),
```

    - replace `organizationName: event.createdBy.organizationName || null,` with `companyName: nameOf(event.createdBy.companyId),`.

- [ ] **Step 9: `getAdminEventDetails`.**
  - Change `.populate('createdBy', 'name role organizationName email')` to `.populate('createdBy', 'name role companyId email')`.
  - After `if (!event) return …`, add:

```js
    if (!canSeeEvent(caller, event)) return { success: false, message: 'Unauthorized' };
```

  - Replace `registeredQuery.organizationName = caller.organizationName;` with `registeredQuery.companyId = caller.companyId;`.
  - Change `.select('name role organizationName email')` to `.select('name role companyId email')`.
  - After that query, add `const detailCompanies = await getCompaniesByIds([event.companyId, event.createdBy?.companyId, ...registeredUsers.map((u) => u.companyId)]);`.
  - Replace the three `organizationName` properties:
    - participant: `companyName: detailCompanies.get(String(u.companyId))?.name || null,`
    - event: `companyName: detailCompanies.get(String(event.companyId))?.name || null,`
    - createdBy: `companyName: detailCompanies.get(String(event.createdBy.companyId))?.name || null,`

- [ ] **Step 10: `getOrgEventsHistory`.**
  - Change the signature to `(companyId)`.
  - Replace its access lines with:

```js
    const access = resolveCompanyAccess(await getCurrentUser(), companyId);
    if (access.error) return { success: false, message: access.error };
    if (!access.companyId) return { success: false, message: 'Company is required' };
    const ownCompany = access.companyId;
```

  - Then:
    - replace `organizationName: orgName,` in the users query with `companyId: ownCompany,`;
    - replace `organizationName: orgName,` in the attendance query with `companyId: ownCompany,`;
    - replace `type: event.organizationName === orgName ? 'internal' : 'global',` with `type: event.companyId && String(event.companyId) === ownCompany ? 'internal' : 'global',`.

- [ ] **Step 11: `getMyImpact`.**
  - In the `Event.find` select, replace `organizationName` with `companyId`.
  - After `const allEvents = …;`, add `const impactCompanies = await getCompaniesByIds([caller.companyId, ...allEvents.map((e) => e.companyId)]);`.
  - Replace `organizationName: ev.organizationName || null,` with `companyName: impactCompanies.get(String(ev.companyId))?.name || null,`.
  - Delete the `let organizationLogo = null; if (caller.organizationName) { … }` block.
  - In `stats`, replace `organizationName: caller.organizationName,` and `organizationLogo,` with:

```js
        companyName: impactCompanies.get(String(caller.companyId))?.name || null,
        companyLogo: impactCompanies.get(String(caller.companyId))?.logoUrl || null,
```

- [ ] **Step 12: Remove `resolveOrgAccess`.** Delete the whole `resolveOrgAccess` function and its comment block from `actions.js`. Then run `grep -n "resolveOrgAccess\|orgName" src/app/actions.js`. Expected: only the local `orgName` variables inside `generateTeamLogins`, `bulkCreateFromExcel` and `getAllEventsHistory`.

- [ ] **Step 13: Run the tests to verify they pass.** Run: `npm test -- tests/actions/stats.test.js`. Expected: all pass.

- [ ] **Step 14: Screens.**
  - `src/app/dashboard/page.js`: replace `getOrgStats(user.organizationName, year)` with `getOrgStats(String(user.companyId), year)`.
  - `src/app/dashboard/team/page.js`: delete `const orgName = user.organizationName;`, and replace `getOrgStats(orgName),` with `getOrgStats(user.companyId ? String(user.companyId) : null),`.
  - `src/app/dashboard/events-history/page.js`: replace `getOrgEventsHistory(user.organizationName)` with `getOrgEventsHistory(String(user.companyId))`.
  - `CorporateEventsHistoryClient.js`:
    - replace `(item.organizationName || '').toLowerCase().includes(searchTerm.toLowerCase())` with `(item.type || '').includes(searchTerm.toLowerCase())`;
    - replace `{item.organizationName ? (` with `{item.type === 'internal' ? (`.
  - `CorporateOverviewClient.js`:
    - `filteredOrgs`: replace `o.organizationName.toLowerCase()` with `o.name.toLowerCase()`;
    - `handleGenerate`: replace with `const handleGenerate = (companyId) => { router.push(\`/dashboard/team/generate?company=${companyId}\`); };`;
    - `handleViewStats`: signature `(companyId, name)`, then `setLoadingStatsOrg(companyId);`, `getOrgStats(companyId)`, and `setSelectedOrgStats({ orgName: name, … })`;
    - table row: `key={org.companyId}`; replace `org.organizationName` with `org.name` (2 places); replace `{org.spocName}` with `{org.spocNames.join(', ') || '—'}`;
    - buttons: `onClick={() => handleViewStats(org.companyId, org.name)}`, `loadingStatsOrg === org.companyId`, `onClick={() => handleGenerate(org.companyId)}`.
  - `DirectoryClient.js`:
    - replace `(s.organizationName || '')` with `(s.companyName || '')`;
    - CSV header row: replace `` `"${s.organizationName || ''}"` `` with `` `"${s.companyName || ''}"` ``;
    - export CSV row: `` `"${r.organizationName}"` `` becomes `` `"${r.companyName}"` ``;
    - avatar and label: `spoc.organizationName` becomes `spoc.companyName` (2 places);
    - `handleExportIndividualCSV(spoc.organizationName)` becomes `handleExportIndividualCSV({ id: spoc.companyId, name: spoc.companyName })`;
    - `exportTarget` now holds `{ id, name } | null`: pass `exportTarget?.id ?? null` to `exportDetailedAttendanceData`, and use `exportTarget?.name` wherever it was used as display or filename text.
    - Check with `grep -n exportTarget src/app/admin/directory/DirectoryClient.js`. Every usage must read `.id` or `.name`.
  - `EventsHistoryClient.js`:
    - replace `(item.organizationName || '')` with `(item.companyName || '')`;
    - replace `const isInternal = !!item.organizationName;` with `const isInternal = !!item.companyId;`;
    - replace `{item.createdBy.organizationName ? \` (${item.createdBy.organizationName})\` : ''}` with `{item.createdBy.companyName ? \` (${item.createdBy.companyName})\` : ''}`;
    - replace `{item.organizationName ? (` with `{item.companyName ? (`, and `{item.organizationName}` with `{item.companyName}`.
  - `EventDetailsModal.js`: `data.event.organizationName` becomes `data.event.companyName` (2 places); `p.organizationName` becomes `p.companyName`.
  - `MyImpactClient.js`:
    - `stats.organizationName` becomes `stats.companyName` (all occurrences);
    - `stats.organizationLogo` becomes `stats.companyLogo` (2 places);
    - `ev.organizationName` becomes `ev.companyName` (2 places).

- [ ] **Step 15: Build and run all tests.** Run: `npm test && npm run build`. Expected: pass.

- [ ] **Step 16: Commit.**

```bash
git add src/app tests/actions/stats.test.js
git commit -m "Stats, history, directory and impact by companyId"
```

---

### Task 11: Chat contacts and company logo in Settings

**Files:**
- Modify: `src/app/actions.js` (`getChatContacts`; delete `updateOrganizationLogo`), `src/app/messages/ChatClient.js`, `src/app/settings/page.js`, `src/app/settings/SettingsClient.js`
- Create: `tests/actions/chat.test.js`

**Interfaces:**
- Consumes: `updateCompanyLogo` (Task 5), `getCompaniesByIds` / `getCompanyName` (Task 2).
- Produces:
  - `getChatContacts()` contacts are `{ _id, name, role, companyName, ngoName, ngoId, unread }`.
  - `SettingsClient` takes the prop `companyLogo`.

- [ ] **Step 1: Write the failing tests** (`tests/actions/chat.test.js`).

```js
import { describe, it, expect } from 'vitest';
import { actAs } from '../helpers/auth.js';
import { makeWorld } from '../helpers/factories.js';
import { getChatContacts } from '@/app/actions';

const ids = (res) => res.contacts.map((c) => c._id).sort();

describe('chat contacts', () => {
  it("let a SPOC message admins and every employee of their company, but not other companies", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    const res = await getChatContacts();
    expect(ids(res)).toEqual([String(w.admin._id), String(w.memberA._id)].sort());
    expect(res.contacts.find((c) => c._id === String(w.memberA._id)).companyName).toBe('Acme');
  });
  it("let an employee message every SPOC of their company", async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    expect(ids(await getChatContacts())).toEqual([String(w.spocA._id), String(w.spocA2._id)].sort());
  });
  it('label NGO contacts with their NGO name', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const ngo = (await getChatContacts()).contacts.find((c) => c._id === String(w.ngo._id));
    expect(ngo.ngoName).toBe('Green Earth');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail.** Run: `npm test -- tests/actions/chat.test.js`. Expected: FAIL.

- [ ] **Step 3: `getChatContacts`.**
  - Replace every `.select('name role organizationName ngoId')` with `.select('name role companyId ngoId ngoName')` (6 occurrences).
  - Replace both `organizationName: currentUser.organizationName` filters with `companyId: currentUser.companyId`.
  - Before `const serialized`, add `const contactCompanies = await getCompaniesByIds(contacts.map((c) => c.companyId));`.
  - Replace `organizationName: c.organizationName || null,` with:

```js
      companyName: contactCompanies.get(String(c.companyId))?.name || null,
      ngoName: c.ngoName || null,
```

- [ ] **Step 4: Delete `updateOrganizationLogo`.** Remove the whole function and its doc comment from `actions.js`. `updateCompanyLogo` in `companyActions.js` replaces it.

- [ ] **Step 5: Run the tests to verify they pass.** Run: `npm test -- tests/actions/chat.test.js`. Expected: all pass.

- [ ] **Step 6: `ChatClient.js`.** Replace each `c.organizationName` / `contact.organizationName` / `activeContact.organizationName`:
  - `(c.organizationName || '')` becomes `(c.companyName || c.ngoName || '')`;
  - `{contact.organizationName || ROLE_LABEL[contact.role]}` becomes `{contact.companyName || contact.ngoName || ROLE_LABEL[contact.role]}`;
  - `{activeContact.organizationName || ROLE_LABEL[activeContact.role]}` becomes `{activeContact.companyName || activeContact.ngoName || ROLE_LABEL[activeContact.role]}`.

- [ ] **Step 7: Settings.**
  - In `src/app/settings/page.js`:
    - add `import { getCompaniesByIds } from '@/lib/company';`;
    - before `return`, add:

```js
  const company = user.companyId ? (await getCompaniesByIds([user.companyId])).get(String(user.companyId)) : null;
```

    - change the return to `return <SettingsClient user={user} companyLogo={company?.logoUrl || ''} />;`.
  - In `SettingsClient.js`:
    - the signature becomes `export default function SettingsClient({ user, companyLogo = '' }) {`;
    - replace `useState(user.organizationLogo || '')` with `useState(companyLogo)`;
    - change the import `updateOrganizationLogo` to `import { updateProfileName, updatePassword } from '@/app/actions';` plus `import { updateCompanyLogo } from '@/app/companyActions';`;
    - replace both `updateOrganizationLogo(` calls with `updateCompanyLogo(`.

- [ ] **Step 8: Build and run all tests.** Run: `npm test && npm run build`. Expected: pass.

- [ ] **Step 9: Commit.**

```bash
git add src/app/actions.js src/app/messages/ChatClient.js src/app/settings tests/actions/chat.test.js
git commit -m "Chat contacts and company logo use Company records"
```

---

### Task 12: QA seed, docs, migration on the test database, verification, push

**Files:**
- Create: `scripts/seed-qa.mjs`
- Modify: `README.md`, `CLAUDE.md`, `package.json` (scripts)

**Interfaces:**
- Consumes: everything above; `scripts/migrate-companies.mjs` (Task 4).

- [ ] **Step 1: Confirm every producer task is committed** before starting (observation 0018).

Run: `git log --oneline -12`
Expected: commits from Tasks 1–11 are present. If any is missing, stop.

- [ ] **Step 2: Create `scripts/seed-qa.mjs`.** It refuses any cluster other than the test cluster.

```js
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
```

- [ ] **Step 3: Add npm scripts.** In `package.json` `"scripts"`, add:

```json
    "migrate:companies": "node scripts/migrate-companies.mjs",
    "seed:qa": "node scripts/seed-qa.mjs",
```

- [ ] **Step 4: Update `README.md`.**
  - In **Roles**, change the `org_spoc` row to: "Corporate single point of contact. Registered by an admin against a Company. All SPOCs of a company share its dashboard."
  - Add a **Companies** paragraph under Roles: "Corporate clients are `Company` records, managed at `/admin/companies`. SPOCs and employees reference one through `companyId`. Public signup is for volunteers and NGOs only."
  - In **Scripts**, add rows for `npm test`, `npm run migrate:companies` (dry run; `--apply --yes`, `--cleanup --yes`, `--rollback <file> --yes`, `--env <file>`), and `npm run seed:qa` / `npm run seed:qa -- --remove` (test cluster only).

- [ ] **Step 5: Update `CLAUDE.md`** (Architecture notes).
  - Replace the bullet starting "**`src/middleware.js` only protects page routes**" sentence about `resolveOrgAccess` with: "For anything scoped to a company, use the helpers in `src/lib/company.js` (`resolveCompanyAccess`, `eventVisibilityFilter`, `canSeeEvent`, `canManageEvent`). Public events have `companyId: null`. `User.spocId` is a record only and never controls access."
  - Add the bullet: "**Company admin actions** live in `src/app/companyActions.js`. Run `npm test` (Vitest + in-memory MongoDB) before pushing."
  - In the Roles bullet, replace "An `org_member` links to its SPOC via `User.spocId`." with "SPOCs and employees belong to a `Company` via `companyId`. All of a company's SPOCs share its data."

- [ ] **Step 6: Final checks.**

Run: `grep -rn "organizationName\|organizationLogo" src/`
Expected: no output.

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 7: Migrate the test database.** Tell the user first and wait for their go-ahead, because staging shares this database.

Run: `npm run migrate:companies` (dry run). Review the companies with the user. If they approve, run:

```bash
npm run migrate:companies -- --apply --yes
```

Expected: a summary with `companiesCreated`, linked counts, and a backup path under `backups/`.

- [ ] **Step 8: Manual QA on a local production build** (follow observations 0029 and 0031). Start the server after the build, check its PID start time is later than `.next/BUILD_ID`, target controls by exact role and name, and never click destructive controls.

  1. Run `npm run seed:qa`.
  2. Run `npm run build && npm run start`.
  3. Using `backups/qa-accounts.json`, check at desktop and 375px:
     - **Admin:**
       - `/admin/companies` creates, renames, uploads a logo, archives and restores.
       - Register user shows the company picker.
       - Corporate overview shows one row per company, with both SPOC names for QA Company A.
       - Generate logins goes through `?company=`.
     - **qa-spoc-a1:** creates an internal event.
     - **qa-spoc-a2:** sees and edits that event, sees the same team and attendance, and can mark `qa-member-a`.
     - **qa-member-a:** sees and registers for the internal event.
     - **qa-spoc-b:** cannot see it (the event URL shows the 404 page).
     - **qa-volunteer and logged out:** see only public events.
     - **Signup page:** offers Volunteer and NGO only.
  4. Run `npm run seed:qa -- --remove`.

- [ ] **Step 9: Commit and push to `test`.**

```bash
git add scripts/seed-qa.mjs package.json README.md CLAUDE.md
git commit -m "Add QA seed script and document companies"
git push upstream test
```

- [ ] **Step 10: Hand off.** Report to the user:
  - test, build and QA results;
  - the migration summary;
  - the production steps from spec §8 (they run `--env <prod env file>` dry run, then `--apply --yes`; then ask for the merge to `main`; `--cleanup --yes` a few days later).

Do not merge to `main`.
