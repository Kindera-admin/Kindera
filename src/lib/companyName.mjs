// Shared by the app and scripts/migrate-companies.mjs, so it has no imports.
// Two company names are the same company when their keys match.
export function toNameKey(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}
