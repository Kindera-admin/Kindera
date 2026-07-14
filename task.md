# Task List

## 1. Event Capacity Enforcement
- [x] actions.js — add capacity check in `registerForEventLoggedIn` + `registerForEvent`
- [x] events/[eventId]/page.js — fetch + pass registeredCount to client
- [x] EventRegisterClient.js — show "X spots left" badge, disable button when full

## 2. Attendance Per-Event Page
- [x] Create /dashboard/attendance/[eventId]/page.js
- [x] Create /dashboard/attendance/[eventId]/AttendanceMarkClient.js
- [x] Added dynamic PDF printable Certificates to volunteer impact dashboard

## 3. Homepage Live Stats
- [x] actions.js — add getImpactStats()
- [x] app/page.js — call getImpactStats(), pass to HomePageClient
- [x] HomePageClient.js — use live stats in Counter

## 4. NGO Partners Public Page
- [x] Created public /partners page
- [x] /partners/page.js — fetches partners
- [x] /partners/PartnersClient.js — beautiful card grid with search/filter
- [x] HomePageHeader.js — add Partners link to nav

## 5. Deploy
- [x] npm run build
- [x] git push both remotes (origin and upstream)
