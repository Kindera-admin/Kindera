import { isStaff, isCorporate } from '@/lib/company';

// Who may see which NGO partner cards, and which companies an NGO login may
// stamp on an event. A partner with no companyIds is public.

// Mongo filter for partner lists.
export function partnerVisibilityFilter(caller) {
  if (isStaff(caller)) return {};
  if (isCorporate(caller)) {
    return { $or: [{ companyIds: { $size: 0 } }, { companyIds: caller.companyId }] };
  }
  return { companyIds: { $size: 0 } };
}

// Filter for a company's own NGOs, or null when the caller has no company.
// Callers must refuse on null.
export function myNgosFilter(caller) {
  if (isCorporate(caller)) return { companyIds: caller.companyId };
  return null;
}

// The companyId values an NGO login may put on an event: strings, or null for
// a public event. An empty array means it may create nothing (fails closed).
export function ngoEventCompanies(ngoUser, partner) {
  if (!ngoUser?.ngoPartnerId) return [null];
  if (!partner) return [];
  const ids = (partner.companyIds || []).map(String);
  return ids.length === 0 ? [null] : ids;
}
