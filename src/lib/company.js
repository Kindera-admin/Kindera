import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Company from '@/models/Company';

// Every company access and event-visibility decision lives here.
// Nothing else in the app compares companies directly.

const STAFF = ['admin', 'employee'];
const CORPORATE = ['org_spoc', 'org_member'];

const idOf = (value) => (value == null ? null : String(value._id ?? value));

export function isStaff(user) {
  return !!user && STAFF.includes(user.role);
}

export function isCorporate(user) {
  return !!user && CORPORATE.includes(user.role) && !!user.companyId;
}

export function sameCompany(a, b) {
  const x = idOf(a);
  const y = idOf(b);
  return !!x && x === y;
}

// Aggregation $match compares types strictly: a string never matches an ObjectId.
export function asObjectId(id) {
  return id ? new mongoose.Types.ObjectId(String(id)) : null;
}

// Which company's data may `caller` read? Staff: the requested one (or all if
// none). SPOCs and employees: only their own, whatever they asked for.
export function resolveCompanyAccess(caller, companyId = null) {
  if (!caller) return { error: 'Not authenticated' };
  if (isStaff(caller)) return { companyId: companyId ? idOf(companyId) : null };
  if (isCorporate(caller)) {
    if (companyId && !sameCompany(companyId, caller.companyId)) {
      return { error: 'Not authorized for this company' };
    }
    return { companyId: idOf(caller.companyId) };
  }
  return { error: 'Not authorized' };
}

// Mongo filter for event lists. Public means companyId null (or missing).
export function eventVisibilityFilter(caller) {
  if (isStaff(caller)) return {};
  if (isCorporate(caller)) return { $or: [{ companyId: null }, { companyId: caller.companyId }] };
  return { companyId: null };
}

export function canSeeEvent(caller, event) {
  if (!event) return false;
  if (!event.companyId) return true;
  if (isStaff(caller)) return true;
  return isCorporate(caller) && sameCompany(event.companyId, caller.companyId);
}

// Admins, the creator, or any SPOC of the event's company.
export function canManageEvent(caller, event) {
  if (!caller || !event) return false;
  if (caller.role === 'admin') return true;
  if (sameCompany(event.createdBy, caller._id)) return true;
  return caller.role === 'org_spoc' && !!event.companyId && sameCompany(event.companyId, caller.companyId);
}

export async function getCompanyName(companyId) {
  if (!companyId) return null;
  await connectDB();
  const company = await Company.findById(companyId).select('name').lean();
  return company?.name ?? null;
}

export async function getCompaniesByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  await connectDB();
  const list = await Company.find({ _id: { $in: unique } }).select('name logoUrl status').lean();
  return new Map(list.map((c) => [String(c._id), { name: c.name, logoUrl: c.logoUrl || '', status: c.status }]));
}
