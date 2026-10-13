// Usernames for generated and uploaded team logins. No imports, so the
// server actions and the upload screen share one definition.

export const slugify = (name) => String(name ?? '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Username prefix for a company's logins; a name with no ASCII letters falls back to "team".
export const loginSlug = (name) => slugify(name).replace(/^-+|-+$/g, '') || 'team';

// `<slug>-<employee ID>`: trimmed, lowercased, only [a-z0-9._-], any run of other
// characters collapsed to one dash. Null when the ID has nothing usable.
export function employeeLogin(slug, employeeId) {
  if (typeof employeeId !== 'string' && typeof employeeId !== 'number') return null;
  const id = String(employeeId).trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id ? `${slug}-${id}` : null;
}

// Rows of an uploaded sheet (sheet_to_json objects keyed by header) as account
// rows. Only rows with a name are kept.
export function accountRowsFromSheet(data) {
  return data.map((row) => ({
    name: row['Name'] || row['Employee Name'] || row['Full Name'],
    employeeId: row['ID'] || row['Employee ID'] || row['Emp ID'],
    username: row['Email'] || row['Username'],
    email: row['Email'],
  })).filter((r) => r.name);
}
