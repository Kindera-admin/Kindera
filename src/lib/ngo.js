import { isStaff, isCorporate } from '@/lib/company';

// Who may see which NGO partner cards, and which companies an NGO login may
// stamp on an event. A partner with no companyIds is public.

// A public partner has no companies. This also matches legacy documents that
// predate the field (`$size: 0` would not match a missing field).
const PUBLIC_PARTNER = { 'companyIds.0': { $exists: false } };

// Mongo filter for partner lists.
export function partnerVisibilityFilter(caller) {
  if (isStaff(caller)) return {};
  if (isCorporate(caller)) {
    return { $or: [PUBLIC_PARTNER, { companyIds: caller.companyId }] };
  }
  return { ...PUBLIC_PARTNER };
}

// Filter for a company's own NGOs. Callers without a company get a filter
// that matches nothing (never null: find(null) would match everything).
export function myNgosFilter(caller) {
  if (isCorporate(caller)) return { companyIds: caller.companyId };
  return { _id: { $in: [] } };
}

// The companyId values an NGO login may put on an event: strings, or null for
// a public event. An empty array means it may create nothing (fails closed).
export function ngoEventCompanies(ngoUser, partner) {
  if (!ngoUser?.ngoPartnerId) return [null];
  if (!partner) return [];
  const ids = (partner.companyIds || []).map(String);
  return ids.length === 0 ? [null] : ids;
}
