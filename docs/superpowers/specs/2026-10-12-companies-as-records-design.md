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
  - `setCompanyLogo(id, url)`: implemented by folding it into `updateCompanyLogo(url, companyId?)`, one action for both callers. Staff pass `companyId`; a SPOC's own company is implied and any other `companyId` is refused.
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

Usage: `node scripts/migrate-companies.mjs [--env <file>] [--apply | --cleanup | --rollback <backup.json> | --backfill-legacy] [--yes]`. Every mode except the dry run writes, and refuses to run without `--yes`. It reads `MONGODB_URI` from `--env` (default `.env.local`) and prints the target cluster host before doing anything.

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
  - Follows earlier links first: a name already linked to a company (on a user, event or attendance record) keeps pointing at that company even after it is renamed. A name linked to two different companies is not linked at all and is reported. A link to a company that no longer exists is ignored, so a re-run never links a record to a missing company.
  - Attendance with no `companyId` whose attendee is a linked SPOC/employee (for example rows labelled "All Organizations") takes the attendee's company.
- **Dry run also lists** corporate users with no usable company name and events whose `organizationName` is blank (by `_id` and username/title), and each proposed company's SPOCs by status (approved/pending/rejected) so typo or squatter companies stand out.
- **`--cleanup` (contract):** unsets `organizationName` and `organizationLogo` on every collection. It refuses, listing the ids, while any user, event or attendance `companyId` points at a company that no longer exists (restore the company or re-link the records), any `org_spoc` / `org_member` has no `companyId`, any event has a blank or unlinked `organizationName`, or any attendance it could still link has no `companyId`. Blank means empty after trimming, everywhere.
- **`--rollback <backup.json>`:** field-scoped, never a whole-document replace, so later changes (hours, registrations, titles) survive.
  - Apply backup: unsets `companyId` on the backed-up users, events and attendance, restores `ngoName` / `employerName` to their backed-up values (or unsets them), and deletes the companies that apply inserted. A created company that is still referenced by records outside the backup (users, events or attendance written by the new code, or NGO partner cards) is kept and reported as "kept (still referenced by N records)".
  - Cleanup backup: sets `organizationName` / `organizationLogo` back from the backup and leaves every other field alone.
- **`--backfill-legacy`:** writes `organizationName` on SPOCs/employees, events and attendance that have a `companyId` and a blank `organizationName` (or an `Unknown company (<id>)` placeholder from an earlier run). The name is the one the company's linked legacy records already use most often, falling back to `Company.name`, so a company renamed in the new UI is not split for the old code and a later `--apply` links to the same company. It also writes `organizationLogo` on SPOCs from `Company.logoUrl` when missing. Writes a backup first and prints counts. Run it before redeploying the old code and again right after the old code is live, so internal events created by the new code do not match the old public filter. Fails closed: a record whose `companyId` has no Company gets the placeholder `Unknown company (<companyId>)` (one name per missing company, so the old code never groups two lost companies together); the run reports them and exits non-zero after writing, on every run while any placeholder remains. Once the company is restored or the record re-linked, the next run replaces the placeholder with the real name.

## 8. Release order

Every write needs `--yes`, and `--env <file>` picks the database. Run the same steps on the test database (staging, `test` branch) first, then on production (`main`, kindera.co).

1. **Dry run** (`node scripts/migrate-companies.mjs --env <file>`). Review the proposed companies, the SPOC status per company, and the unlinkable users and events. Fix those by hand (assign a company or change the role) before going on.
2. **`--apply --yes`.** Keep the printed backup path.
3. **Deploy the new code** (push `test`, or merge `test` into `main`).
4. **`--apply --yes` again, immediately.** The old code kept writing `organizationName` until the deploy finished; this links the records it wrote in that window.
5. **Verify** the deployment (company dashboards, event visibility, attendance).
6. **`--cleanup --yes`** after a few days without issues. Keep the printed backup path.

**Rollback before cleanup:**
1. `--backfill-legacy --yes`, so records created by the new code carry `organizationName` again.
2. Redeploy the previous `main`. The old fields still exist, so the old code works.
3. **`--backfill-legacy --yes` again, right after the old code is live.** The new code kept writing `companyId`-only records until the redeploy finished; this names the records it wrote in that window (the mirror of forward step 4).
4. Either roll back **every** apply backup, newest first (`--rollback <apply backup> --yes` for each; forward steps 2 and 4 each wrote one), or skip this step: `companyId` does no harm to the old code. Companies still referenced by newer records are kept and reported.

**Rollback after cleanup:**
1. `--rollback <cleanup backup> --yes` to put `organizationName` / `organizationLogo` back.
2. `--backfill-legacy --yes` for records created after cleanup.
3. Redeploy the old code.
4. **`--backfill-legacy --yes` again, right after the old code is live**, for records the new code wrote while the redeploy was going out.

If `--backfill-legacy` exits non-zero, some records point at a company that no longer exists. They carry an `Unknown company (<id>)` placeholder, so the old code keeps them private; restore those companies or re-link the records, then run it again.

I cannot connect to the production database. Every production step is run by the user.

## 9. Testing

No test runner exists today. Add:

- **Vitest** (dev dependency) with unit tests for `src/lib/company.js`. Every role is tested against its own company, another company, and public/null for `resolveCompanyAccess`, `eventVisibilityFilter`, `canSeeEvent` and `canManageEvent`, including the multi-SPOC cases from §4.1.
- **Migration tests** against an in-memory MongoDB (`mongodb-memory-server`, dev dependency; the first run downloads a MongoDB binary of about 100 MB, which needs approval before it happens). They cover:
  - duplicate-name grouping;
  - idempotent re-runs;
  - NGO and volunteer field moves;
  - cleanup refusing to run when it isn't safe;
  - rollback restoring only the fields the migration changed (never whole documents), so later changes survive, and keeping any created company that newer records still reference;
  - `--backfill-legacy` naming records for the old code, failing closed on missing companies.
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
