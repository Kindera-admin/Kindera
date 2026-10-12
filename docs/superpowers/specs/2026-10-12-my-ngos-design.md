# My NGOs (company-private NGO partners) — design

Builds on `2026-10-12-companies-as-records-design.md` (Company records, `companyId`, rules in `src/lib/company.js`).

## 1. What the user asked for

A corporate wants its own NGOs. Kindera staff (admins and employees) add them and pick which company or companies each one belongs to. SPOCs cannot add them. A company's NGOs are visible only to that company's SPOCs and employees, on a read-only "My NGOs" page. If staff generate a login for one of these NGOs, that login can create events, and each event is visible only to one of the NGO's companies.

Decisions already agreed:
- An NGO can belong to one or more companies.
- The NGO picks the company per event.
- The NGO login is linked to the NGO card.
- Staff add NGOs one by one or by Excel import.
- Every SPOC of a company sees the same list.

## 2. Data

The NGO card is the existing `NGOPartner` model. It gains two fields:

- `companyIds: [ObjectId → Company]`, default `[]`.
  - Empty means a **public partner**, shown on `/ngo-partners` and `/partners` exactly as today.
  - Non-empty means a **company NGO**, private to those companies.
- `loginUserId: ObjectId → User`, default `null`. This is the NGO login linked to the card. A card has at most one login.

`User` gains `ngoPartnerId: ObjectId → NGOPartner`, default `null`. It is set only on `role: 'ngo'` logins that staff generate from a card.

## 3. Rules

All rules live in a new `src/lib/ngo.js`, next to `src/lib/company.js`, and use its helpers.

- `partnerVisibilityFilter(caller)`:
  - staff → `{}` (everything);
  - `org_spoc` / `org_member` with a company → public partners plus partners whose `companyIds` contains the caller's company;
  - everyone else (volunteer, ngo, logged out) → public partners only (`companyIds` empty).
- `myNgosFilter(caller)`:
  - `org_spoc` / `org_member` with a company → `{ companyIds: caller.companyId }`;
  - anyone else → nothing (a filter that matches no document).
- `ngoEventCompanies(ngoUser, partner)`: which `companyId` values an NGO login may stamp on an event.
  - An unlinked NGO, or one linked to a public partner, may only create public events (`[null]`).
  - An NGO linked to a company NGO card may only use that card's companies. It never gets null, so it can never create a public event.
  - An NGO whose linked card is missing (deleted) may use nothing. It fails closed.

## 4. Actions (`src/app/actions.js`)

- **`getAllNGOPartners()`**
  - Today anyone can call it, logged out included, and it returns every partner.
  - It becomes caller-scoped via `partnerVisibilityFilter`.
  - Items gain `companyIds` (strings) and `companyNames`, plus `hasLogin` for staff only.
- **`getMyNGOs()`** (new)
  - For `org_spoc` / `org_member` only; others are refused.
  - Returns the cards from `myNgosFilter`, plus for each card a count of upcoming events this NGO's login created for the caller's company.
- **`createNGOPartner` / `updateNGOPartner`**
  - Accept `companyIds`, a JSON array of ids in the form field `companyIds`.
  - Each id must be valid and point to an active company, otherwise the action is refused.
  - Staff only, as today.
- **`importNGOPartners(rows, companyIds)`** (new, staff only)
  - Rows come from an Excel sheet with columns `name, description, focusAreas, programs, impact, registeredOffice, location, website`.
  - `name` and `description` are required per row.
  - Imports at most 500 rows, using `insertMany({ ordered: false })`.
  - Reports how many rows were created and which rows were skipped and why, with no raw Mongo text.
  - Every row gets the same `companyIds`, which are validated as above.
- **`generateNGOLogin(partnerId)`** (new, staff only)
  - Refused if the card already has a login.
  - Creates a `User` with:
    - `role: 'ngo'`, `status: 'approved'`;
    - `name` and `ngoName` = the card name;
    - a unique `ngoId` and `username` (slug of the name plus a short random suffix);
    - a random 10-character password;
    - `ngoPartnerId` = the card.
  - Sets `loginUserId` on the card and returns the username and password once, for staff to copy.
- **`deleteNGOPartner`**
  - Also sets any linked login to `status: 'rejected'` and clears its `ngoPartnerId`, so a dangling login cannot create events.
- **`createEvent`** for `role: 'ngo'`
  - Reads the optional `companyId` form field and checks it against `ngoEventCompanies`.
  - An NGO linked to a company card must send one of its companies. A missing or other value is refused with "Choose which company this event is for".
  - An NGO with no card, or with a public card, keeps creating public events. Any `companyId` it sends is ignored.
- **Event visibility is unchanged.** `companyId` already makes an event visible only to that company and staff (Task 7). The "NGO for A" test already guards this.
- **`registerUser` (admin) for `role: 'ngo'`** now stores `ngoName = name` (the deferred Task 6 finding).

## 5. Screens

- **`/admin/ngo-partners`** (staff)
  - Each card shows its companies as chips, or "Public partner".
  - A **company filter** above the list offers All / Public partners / each active company. It is a client-side filter over the loaded list.
  - The add/edit form gets a **Companies** multi-select of active companies (from `listCompanies()`). Leaving it empty keeps the partner public.
  - An **Import from Excel** button opens a small panel: choose companies (multi-select), choose an `.xlsx` file, then import. It uses the `xlsx` package already used by Generate Logins.
  - Each card has a **Generate login** button. It shows "Login: <username>" once one exists. After generating, a dialog shows the username and password with copy buttons and the note "shown once".
- **`/dashboard/my-ngos`** (new, for `org_spoc` and `org_member`)
  - Read-only cards (logo, name, focus areas, location, website, description), with the upcoming-events count.
  - Empty state: "Your company has no NGOs yet. Kindera adds them for you — contact your Kindera team."
  - There are no add, edit or delete controls.
- **Navbar**: a "My NGOs" link for `org_spoc` and `org_member`.
- **`/events/create`** for an NGO linked to a company card
  - A required **Company** select lists only that card's companies (names resolved server-side in `page.js`).
  - For other NGOs the form is unchanged.
- **Public `/ngo-partners` and `/partners`** keep calling `getAllNGOPartners()`, which is now scoped, so company NGOs never show to outsiders.

## 6. Errors and safety

- All ids are checked with `isValidObjectId` before use. The user-facing message is safe and never a CastError or raw error text.
- Non-staff calling any staff action get "Only admins and employees can manage NGO partners", and nothing changes.
- An archived company stays on existing cards. The pickers only offer active companies.

## 7. Tests (`tests/actions/ngos.test.js`)

- **Visibility:** staff see all cards.
  - spocA, spocA2 and memberA see public cards plus A's cards.
  - spocB does not see A's cards.
  - A volunteer, an NGO and a logged-out caller see public cards only.
- **`getMyNGOs`:**
  - spocA and spocA2 get identical lists, containing only A's cards (including a card shared by A and B).
  - Volunteers, NGOs and staff are refused.
- **Create, update, import and generate login:**
  - Staff succeed.
  - SPOCs, members and volunteers are refused, and the database is unchanged.
  - An invalid, unknown or archived company id is refused.
  - Import creates the valid rows and reports the bad ones.
- **Generate login:**
  - The login is linked both ways.
  - A second generate is refused.
  - The password works with `login()`.
- **NGO events:**
  - A linked NGO creating an event for A gets `companyId` A. That event is visible to memberA and not to memberB or a volunteer.
  - Missing company, company B (not on the card) and a malformed id are each refused, with no event created.
  - An unlinked NGO creates a public event.
- **Delete:** deleting a card rejects its login, and that login can no longer create events.
- **Admin-registered NGO:** `registerUser` stores `ngoName`.

## 8. Out of scope

- No SPOC editing of NGOs, as asked.
- No change to NGO documents or reports.
- No email delivery of credentials.
