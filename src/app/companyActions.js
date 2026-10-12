'use server';

import { isValidObjectId } from 'mongoose';
import { revalidatePath } from 'next/cache';
import connectDB from '@/lib/db';
import Company from '@/models/Company';
import User from '@/models/User';
import Attendance from '@/models/Attendance';
import { getCurrentUser } from '@/lib/auth';
import { isStaff, sameCompany } from '@/lib/company';

const DUPLICATE = 'A company with this name already exists';

function serialize(c) {
  return {
    _id: String(c._id),
    name: c.name,
    logoUrl: c.logoUrl || '',
    status: c.status,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
  };
}

async function requireStaff() {
  await connectDB();
  const caller = await getCurrentUser();
  if (!caller) return { error: 'Not authenticated' };
  if (!isStaff(caller)) return { error: 'Only Kindera admins and staff can manage companies' };
  return { caller };
}

function revalidateCompanies() {
  revalidatePath('/admin/companies');
  revalidatePath('/admin/corporate');
  revalidatePath('/admin/register');
}

export async function listCompanies({ includeArchived = false } = {}) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    const companies = await Company.find(includeArchived ? {} : { status: 'active' }).sort({ name: 1 }).lean();
    const ids = companies.map((c) => c._id);
    const [spocs, members, hours] = await Promise.all([
      User.aggregate([{ $match: { role: 'org_spoc', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      User.aggregate([{ $match: { role: 'org_member', companyId: { $in: ids } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]),
      Attendance.aggregate([{ $match: { attended: true, companyId: { $in: ids } } }, { $group: { _id: '$companyId', h: { $sum: '$hoursContributed' } } }]),
    ]);
    const byId = (rows, field) => new Map(rows.map((r) => [String(r._id), r[field]]));
    const spocCount = byId(spocs, 'n');
    const memberCount = byId(members, 'n');
    const volunteerHours = byId(hours, 'h');
    return {
      success: true,
      companies: companies.map((c) => ({
        ...serialize(c),
        spocCount: spocCount.get(String(c._id)) || 0,
        memberCount: memberCount.get(String(c._id)) || 0,
        volunteerHours: volunteerHours.get(String(c._id)) || 0,
      })),
    };
  } catch (error) {
    console.error('Error listing companies:', error);
    return { success: false, message: error.message };
  }
}

export async function createCompany(name) {
  try {
    const { caller, error } = await requireStaff();
    if (error) return { success: false, message: error };
    const clean = String(name ?? '').trim();
    if (clean.length < 2) return { success: false, message: 'Company name must be at least 2 characters' };
    // Uniqueness is enforced by the unique nameKey index (atomic), not by a pre-check.
    const company = await Company.create({ name: clean, createdBy: caller._id });
    revalidateCompanies();
    return { success: true, company: serialize(company) };
  } catch (error) {
    if (error?.code === 11000) return { success: false, message: DUPLICATE };
    console.error('Error creating company:', error);
    return { success: false, message: error.message };
  }
}

export async function renameCompany(id, name) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    if (!isValidObjectId(id)) return { success: false, message: 'Company not found' };
    const clean = String(name ?? '').trim();
    if (clean.length < 2) return { success: false, message: 'Company name must be at least 2 characters' };
    const company = await Company.findById(id);
    if (!company) return { success: false, message: 'Company not found' };
    company.name = clean;
    await company.save();
    revalidateCompanies();
    return { success: true, company: serialize(company) };
  } catch (error) {
    if (error?.code === 11000) return { success: false, message: DUPLICATE };
    console.error('Error renaming company:', error);
    return { success: false, message: error.message };
  }
}

async function setStatus(id, status) {
  try {
    const { error } = await requireStaff();
    if (error) return { success: false, message: error };
    if (!isValidObjectId(id)) return { success: false, message: 'Company not found' };
    const res = await Company.updateOne({ _id: id }, { $set: { status } });
    if (res.matchedCount === 0) return { success: false, message: 'Company not found' };
    revalidateCompanies();
    return { success: true };
  } catch (error) {
    console.error('Error updating company status:', error);
    return { success: false, message: error.message };
  }
}

export async function archiveCompany(id) {
  return setStatus(id, 'archived');
}

export async function restoreCompany(id) {
  return setStatus(id, 'active');
}

// Staff may set any company's logo (pass companyId). A SPOC may set only their own company's.
export async function updateCompanyLogo(url, companyId = null) {
  try {
    await connectDB();
    const caller = await getCurrentUser();
    if (!caller) return { success: false, message: 'Not authenticated' };
    let target;
    if (isStaff(caller)) {
      target = companyId;
      if (!target || !isValidObjectId(target)) return { success: false, message: 'Company is required' };
    } else if (caller.role === 'org_spoc' && caller.companyId) {
      if (companyId && !sameCompany(companyId, caller.companyId)) {
        return { success: false, message: 'Not authorized for this company' };
      }
      target = caller.companyId;
    } else {
      return { success: false, message: 'Only SPOCs can update their company logo' };
    }
    const res = await Company.updateOne({ _id: target }, { $set: { logoUrl: String(url ?? '') } });
    if (res.matchedCount === 0) return { success: false, message: 'Company not found' };
    revalidatePath('/dashboard');
    revalidatePath('/settings');
    revalidateCompanies();
    return { success: true };
  } catch (error) {
    console.error('Error updating company logo:', error);
    return { success: false, message: error.message };
  }
}
