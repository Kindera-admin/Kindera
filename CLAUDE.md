# CLAUDE.md

Start with `README.md` for setup, roles and structure. This file covers what isn't obvious from the code.

## Architecture notes

- **JavaScript, not TypeScript.** shadcn/ui primitives in `src/components/ui/` are `.jsx`. Use the `@/` import alias for anything under `src/`.
- **Server logic lives in `src/app/actions.js`.** It is one file of about 3.4k lines of `"use server"` actions. Add new data operations there, next to related actions, rather than adding API routes. The only API route is `/api/upload`. Do not add setup, seeding, reset or cron routes: admin bootstrap and data maintenance live in `scripts/` and run locally against `.env.local`.
- **Auth is a custom JWT cookie** (`auth-token`, HS256 via `jose`, 30-day expiry). It is signed in `src/app/actions.js` (`login`) and read with `getCurrentUser()` from `src/lib/auth.js`. `next-auth` is still in `package.json` but unused.
- **`src/middleware.js` only protects page routes** (`/dashboard`, `/admin`, `/reports`, …). Its matcher excludes `/api/*`, so every API route and server action has to check auth and role itself through `getCurrentUser()`. For anything scoped to a company, use `resolveOrgAccess()` in `actions.js` so corporate users can only read their own organisation.
- **Roles:** `admin`, `employee`, `ngo`, `org_spoc`, `org_member`, `volunteer`. Approval status (`pending`/`approved`/`rejected`) is checked separately from role. An `org_member` links to its SPOC via `User.spocId`.
- **Denormalized data:** `User.totalVolunteerHours` caches hours and is updated when attendance is marked. Event registrations are embedded in `User.eventRegistrations`, not stored in a separate collection.
- **Page pattern:** `page.js` (server, fetches data) → `*Client.js` (client, renders it) → `loading.js` (skeleton).

## Working rules

- Never hardcode credentials (Mongo URIs, Cloudinary keys, passwords). Read them from `process.env` and add any new variable to `.env.example`.
- Scripts in `scripts/` load `.env.local` and run against whatever database `MONGODB_URI` points at. That may be production.
- There is no test suite. Verify with `npm run build` and by exercising the flow in `npm run dev` under the relevant role.
- Record user-facing feature changes in `docs/FEATURES.md`.
