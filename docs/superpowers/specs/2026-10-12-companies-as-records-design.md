# Companies as records: design

**Status:** approved in brainstorming on 2026-10-12, awaiting spec review
**Branch:** `test` (staging). Release to `main` (kindera.co) only on explicit approval.
**Follow-up project:** Private NGOs ("My NGOs"), which gets its own spec. It builds on the company records defined here.

## 1. Goal

Make each corporate client a real `Company` record and make the company, not the individual SPOC, the unit of ownership and visibility. Today a company is the free-text `organizationName` copied onto users, events and attendance, and each SPOC works in a silo.

Success means:

- Every SPOC and employee belongs to exactly one company through `companyId`.
- All SPOCs of a company share one dashboard: events, team, attendance, stats, history, branding.
- `organizationName` and `organizationLogo` no longer exist in the code (`src/`) or the database (after cleanup).
- Nothing a user could do before is lost, apart from the deliberate changes listed in §6.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Approach | Full switch to `Company` records, with no long-term dual fields (option C, "full switch in one go") |
| Who creates companies | Admins only (admins and Kindera staff with role `employee`) |
| How SPOCs join a company | Admins register SPOCs. Public signup no longer offers the SPOC role |
| Multiple SPOCs per company | Share everything, and any SPOC of the company can edit or delete any of the company's events |
| Release safety | Expand, then contract: add the new fields, deploy the code, remove the old fields later |

## 3. Data model

### 3.1 New `Company` model (`src/models/Company.js`)

| Field | Type | Notes |
|---|---|---|
| `name` | String, required, trimmed | Display name |
| `nameKey` | String, required, unique index | `name.trim().toLowerCase()` with inner whitespace collapsed. Prevents "Infosys" / "infosys " duplicates |
| `logoUrl` | String, default `''` | Moves from the SPOC's `organizationLogo` |
| `status` | `'active' \| 'archived'`, default `'active'` | Archived companies are hidden from pickers; their history is kept |
| `createdBy` | ObjectId → User | Admin who created it (null for migrated companies) |
| timestamps | | |

### 3.2 Field changes on existing models

| Model / role | Before | After |
|---|---|---|
| `User` with role `org_spoc` or `org_member` | `organizationName` (String, required) | `companyId` (ObjectId → Company, required for these roles) |
| `User` with role `ngo` | `organizationName` used as the NGO's own name | `ngoName` (String) |
| `User` with role `volunteer` | optional `organizationName` (employer) | optional `employerName` (String, display only) |
| `User` with role `org_spoc` | `organizationLogo` | removed; logo lives on `Company.logoUrl` |
| `User.spocId` | Controls what an employee sees | Kept only as "which SPOC created this login". **No access decision may use it** |
| `Event` | `organizationName` (set means a private company event) | `companyId` (null means public) |
| `Attendance` | `organizationName` | `companyId` |

Indexes: `User.companyId`, `Event.companyId`, `Attendance.companyId` (plus the existing `eventId`).

## 4. Access and visibility rules

All rules live in one new module, `src/lib/company.js`. Nothing else in the codebase compares companies directly.

- `getCompanyName(companyId)` and `getCompaniesByIds(ids)` (batched, for display).
- `resolveCompanyAccess(caller, companyId)` replaces `resolveOrgAccess` in `actions.js`:
  - `admin` / `employee`: any company (or all, if `companyId` is omitted).
  - `org_spoc` / `org_member`: only `caller.companyId`. Any other id returns an error.
  - Anyone else: refused.
- `eventVisibilityFilter(caller)` returns the Mongo filter for event lists:
  - Logged out, `volunteer`, `ngo`: `{ companyId: null }` (public only).
  - `org_spoc` / `org_member`: `{ $or: [{ companyId: null }, { companyId: caller.companyId }] }`.
  - `admin` / `employee`: no filter.
- `canSeeEvent(caller, event)` and `canManageEvent(caller, event)` are single-event versions. Manage means `admin`, the event's creator, or **any `org_spoc` of `event.companyId`**.

**Behaviour change to note:** today any event created by an NGO login counts as public through the `createdByRole: 'ngo'` clause. After this change, "public" means only `companyId: null`. Every existing NGO event has no company, so they all stay public. This is what makes company-scoped NGO events (project 2) safe.

### 4.1 Shared company dashboard (multiple SPOCs)

| Area | Before | After |
|---|---|---|
| Internal events | Seen by the creating SPOC and the employees whose `spocId` is that SPOC | Seen by every SPOC and employee with that `companyId` |
| Team page / members list | Employees created by this SPOC | All `org_member` users of the company |
| Mark attendance | Admin, or a SPOC for users of the same org name | Admin, or any SPOC of the event's company, for users of that company |
| Employee joins a public event | Their own SPOC must have registered the company | Any SPOC of their company must have registered it |
| Edit / delete internal events | Creating SPOC only | Any SPOC of the company |
| Stats, events history, impact, branding, chat | Grouped by org name | Grouped by `companyId` |

## 5. Server changes (`src/app/actions.js`)

These 29 actions use company fields today and are rewritten to use `companyId` through `src/lib/company.js`:

`login`, `registerUser`, `getAllUsers`, `getPendingEventRegistrations`, `createEvent`, `getHomeEvents`, `getEvents`, `getEventById`, `signup`, `generateTeamLogins`, `bulkCreateFromExcel`, `getOrgMembers`, `markAttendance`, `getEventAttendance`, `getOrgStats`, `getAllCorporateStats`, `getDetailedDirectoryStats`, `exportDetailedAttendanceData`, `updateOrganizationLogo`, `logMyHoursAndFeedback`, `getMyImpact`, `registerForEvent`, `registerForEventLoggedIn`, `getChatContacts`, `getImpactStats`, `getAdminImpactStats`, `getAllEventsHistory`, `getAdminEventDetails`, `getOrgEventsHistory`.

Specific rules:

- `createEvent`: an `org_spoc` event gets `companyId = caller.companyId`. Admin and NGO events get `companyId: null`. (Project 2 extends this for company-scoped NGOs.)
- `updateEvent` / `deleteEvent`: use `canManageEvent`.
- `registerUser` (admin Register screen): for `org_spoc` / `org_member`, require a `companyId` that refers to an **active** company. The free-text name is removed.
- `generateTeamLogins` / `bulkCreateFromExcel`: new employees get the calling SPOC's `companyId`. When an admin calls them, the admin passes a `companyId`.
- `signup` (public): roles `volunteer` and `ngo` only. NGOs store `ngoName`; volunteers store optional `employerName`.
- `updateOrganizationLogo` is renamed `updateCompanyLogo(companyId, url)`: an `admin`, or an `org_spoc` of that company.
- `getOrgStats(companyId, year)`, `getOrgMembers(companyId)`, `getEventAttendance(eventId, companyId)`, `getOrgEventsHistory(companyId)`: parameters change from a name to a `companyId`, and access goes through `resolveCompanyAccess`.
- New company actions (admin/employee only):
  - `listCompanies({ includeArchived })`
  - `createCompany(name)`, rejecting a duplicate `nameKey`
  - `renameCompany(id, name)`, which must keep `nameKey` unique
  - `setCompanyLogo(id, url)`
  - `archiveCompany(id)` / `restoreCompany(id)`
- `login` returns `companyId` and the company name (for the client auth store) instead of `organizationName`.

## 6. Screens

**New: `/admin/companies`** (admin and employee)
- Table columns: name, logo, number of SPOCs, number of employees, volunteer hours, status.
- Actions: **New company**, **Rename**, **Upload logo**, **Archive / Restore**.
- Linked from the admin Control Centre, next to Corporate overview.

**Changed:**
- **Admin → Register user** (`RegisterForm.js`): choosing SPOC or Employee shows a required company picker (active companies) instead of a text field.
- **Admin → Corporate overview, Directory, Users, Events history, Event details modal:** names and logos come from `Company`, and filters and links use `companyId`. The corporate list is built from `Company` records, not from distinct names on users.
- **Signup** (`signup/page.js`): the "Organisation SPOC" option is removed. The NGO form stores "NGO name" as `ngoName`; the volunteer form stores "Employer (optional)" as `employerName`.
- **SPOC dashboard pages** (dashboard home, team, generate logins, attendance, events history): data comes from the shared company scope described in §4.1.
- **Settings → Branding:** edits the company logo, shared by all of the company's SPOCs.
- **My Impact certificate, event registration page, chat contact labels:** company name and logo come from `Company`.

**Deliberate user-visible changes:** SPOC self-signup is removed; SPOCs of the same company now see each other's events, team and attendance; NGO events are public only when they have no company (no change for existing data).

## 7. Migration (`scripts/migrate-companies.mjs`)

Usage: `node scripts/migrate-companies.mjs [--env <file>] [--apply | --cleanup | --rollback <backup.json>]`. It reads `MONGODB_URI` from `--env` (default `.env.local`) and prints the target cluster host before doing anything.

- **Dry run** (default, writes nothing):
  - Collects every `organizationName` from `org_spoc` / `org_member` users, events and attendance.
  - Groups them by `nameKey` and prints each proposed company: the variants found, and the users, events and attendance records per variant.
  - Also lists NGO and volunteer users whose `organizationName` will move to `ngoName` / `employerName`.
- **`--apply` (expand):**
  - Saves a backup JSON of every document it will modify (`backups/migrate-companies-<timestamp>.json`, gitignored).
  - Creates one `Company` per group, named after the most-used variant, with `logoUrl` taken from a SPOC's `organizationLogo` (the most recently updated non-empty one).
  - Sets `companyId` on the matching users, events and attendance.
  - Copies NGO `organizationName` to `ngoName`, and volunteer `organizationName` to `employerName`.
  - **Leaves `organizationName` / `organizationLogo` in place**, so the currently deployed code keeps working.
  - Idempotent: re-running skips documents that already have the new fields.
- **`--cleanup` (contract):** unsets `organizationName` and `organizationLogo` on every collection. It refuses to run unless every `org_spoc` / `org_member` user has a `companyId`.
- **`--rollback <backup.json>`:** restores the backed-up documents and deletes companies the script created.

## 8. Release order

1. **Test database / staging.** I run the dry run and you review the proposed companies. I run `--apply` and push to `test`. We verify staging.
2. **Production.**
   - You run the dry run with `--env` pointing at production credentials, and we review it together.
   - You run `--apply`.
   - I merge `test` into `main` (kindera.co redeploys) and verify.
3. **Cleanup.** After a few days without issues, `--cleanup` runs on each database.

**Rollback:**
- Before cleanup: redeploy the previous `main`. The old fields still exist, so the old code works.
- After cleanup: `--rollback` with the backup file.

I cannot connect to the production database. Every production step is run by the user.

## 9. Testing

No test runner exists today. Add:

- **Vitest** (dev dependency) with unit tests for `src/lib/company.js`. Every role is tested against its own company, another company, and public/null for `resolveCompanyAccess`, `eventVisibilityFilter`, `canSeeEvent` and `canManageEvent`, including the multi-SPOC cases from §4.1.
- **Migration tests** against an in-memory MongoDB (`mongodb-memory-server`, dev dependency; the first run downloads a MongoDB binary of about 100 MB, which needs approval before it happens). They cover:
  - duplicate-name grouping;
  - idempotent re-runs;
  - NGO and volunteer field moves;
  - cleanup refusing to run when it isn't safe;
  - rollback restoring documents exactly.
- **QA seed** (`scripts/seed-qa.mjs` / `--remove`), for the test database only. The script refuses to run on any other cluster. It creates clearly prefixed `qa-` accounts:
  - an admin;
  - two SPOCs in Company A and one employee in Company A;
  - one SPOC in Company B;
  - a volunteer and an NGO.
- **Manual QA** on a local production build, at desktop and 375px widths:
  - each role against the §4 and §4.1 tables;
  - the admin Companies screen;
  - the Register user company picker;
  - the signup roles.

**Done means:**
- The build and tests pass.
- `grep -r "organizationName\|organizationLogo" src/` returns nothing.
- Every row of the §4 and §4.1 tables is verified for every role.

## 10. Out of scope

- Private NGOs / "My NGOs" (next project, separate spec).
- Merging or splitting companies after migration through the UI; the dry-run review is the merge step.
- Invite links or any self-service way for SPOCs to join a company.
- Removing the unused `next-auth` dependency.
