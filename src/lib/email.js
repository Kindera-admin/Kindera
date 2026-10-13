// Account email rules, shared by the User model and the actions. No imports.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX = 254;

// Trimmed and lowercased; undefined for anything blank or not a string, so a
// blank value is never stored (the unique index ignores '', but there is no reason to keep one).
export function normalizeEmail(value) {
  if (typeof value !== 'string') return undefined;
  const email = value.trim().toLowerCase();
  return email || undefined;
}

export const isValidEmail = (email) => typeof email === 'string' && email.length <= EMAIL_MAX && EMAIL_RE.test(email);

// Case-insensitive match, so a legacy mixed-case email still counts as taken.
export const EMAIL_COLLATION = { locale: 'en', strength: 2 };
