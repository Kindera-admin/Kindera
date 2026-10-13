import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  resolveCompanyAccess, eventVisibilityFilter, canSeeEvent, canManageEvent, sameCompany,
} from '@/lib/company';
import { toNameKey } from '@/lib/companyName.mjs';
import Company from '@/models/Company';
import { makeCompany } from '../helpers/factories.js';
import { getCompaniesByIds, getCompanyName } from '@/lib/company';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const admin = { _id: 'admin1', role: 'admin' };
const employee = { _id: 'emp1', role: 'employee' };
const spocA = { _id: 'spocA', role: 'org_spoc', companyId: A };
const spocA2 = { _id: 'spocA2', role: 'org_spoc', companyId: A };
const memberA = { _id: 'memberA', role: 'org_member', companyId: A };
const spocB = { _id: 'spocB', role: 'org_spoc', companyId: B };
const volunteer = { _id: 'vol1', role: 'volunteer' };
const ngo = { _id: 'ngo1', role: 'ngo' };
const spocWithoutCompany = { _id: 'lost', role: 'org_spoc', companyId: null };

describe('toNameKey', () => {
  it('ignores case and surrounding / repeated spaces', () => {
    expect(toNameKey('  Acme   Corp ')).toBe('acme corp');
    expect(toNameKey('ACME CORP')).toBe(toNameKey('acme corp'));
  });
  it('keeps different names different', () => {
    expect(toNameKey('Acme')).not.toBe(toNameKey('Acme Corp'));
  });
});

describe('sameCompany', () => {
  it('matches equal ids across string and ObjectId', () => {
    expect(sameCompany(new mongoose.Types.ObjectId(A), A)).toBe(true);
  });
  it('rejects different, prefix and empty ids', () => {
    expect(sameCompany(A, B)).toBe(false);
    expect(sameCompany(A, A.slice(0, 23))).toBe(false);
    expect(sameCompany(null, null)).toBe(false);
  });
});

describe('resolveCompanyAccess', () => {
  it('lets staff read any company, or all when none is given', () => {
    expect(resolveCompanyAccess(admin, B)).toEqual({ companyId: B });
    expect(resolveCompanyAccess(employee, A)).toEqual({ companyId: A });
    expect(resolveCompanyAccess(admin)).toEqual({ companyId: null });
  });
  it('pins corporate users to their own company', () => {
    expect(resolveCompanyAccess(spocA, A)).toEqual({ companyId: A });
    expect(resolveCompanyAccess(memberA)).toEqual({ companyId: A });
  });
  it("denies corporate users another company's data", () => {
    expect(resolveCompanyAccess(spocA, B)).toHaveProperty('error');
    expect(resolveCompanyAccess(memberA, B)).toHaveProperty('error');
    expect(resolveCompanyAccess(spocB, A)).toHaveProperty('error');
  });
  it('denies everyone else', () => {
    expect(resolveCompanyAccess(volunteer, A)).toHaveProperty('error');
    expect(resolveCompanyAccess(ngo, A)).toHaveProperty('error');
    expect(resolveCompanyAccess(spocWithoutCompany)).toHaveProperty('error');
    expect(resolveCompanyAccess(null, A)).toEqual({ error: 'Not authenticated' });
  });
});

describe('eventVisibilityFilter', () => {
  it('shows staff everything', () => {
    expect(eventVisibilityFilter(admin)).toEqual({});
    expect(eventVisibilityFilter(employee)).toEqual({});
  });
  it('shows corporate users public events, their company and their own', () => {
    expect(eventVisibilityFilter(memberA)).toEqual({
      $or: [{ companyId: null }, { companyId: A }, { createdBy: 'memberA' }],
    });
  });
  it('shows everyone else public events plus their own', () => {
    for (const who of [volunteer, ngo, spocWithoutCompany]) {
      expect(eventVisibilityFilter(who)).toEqual({ $or: [{ companyId: null }, { createdBy: who._id }] });
    }
    expect(eventVisibilityFilter(null)).toEqual({ $or: [{ companyId: null }] });
  });
});

describe('canSeeEvent', () => {
  const publicEvent = { companyId: null, createdBy: 'ngo1' };
  const internalA = { companyId: A, createdBy: 'spocA' };
  it('shows public events to anyone, even logged out', () => {
    for (const who of [null, volunteer, ngo, memberA, spocB]) expect(canSeeEvent(who, publicEvent)).toBe(true);
  });
  it("shows a company's event to all its SPOCs and employees, and staff", () => {
    for (const who of [spocA, spocA2, memberA, admin, employee]) expect(canSeeEvent(who, internalA)).toBe(true);
  });
  it("hides a company's event from everyone else", () => {
    for (const who of [spocB, volunteer, ngo, null, spocWithoutCompany]) expect(canSeeEvent(who, internalA)).toBe(false);
  });
});

describe('canManageEvent', () => {
  const internalA = { companyId: A, createdBy: 'spocA' };
  const adminEvent = { companyId: null, createdBy: 'admin1' };
  it('lets admins, the creator, and any SPOC of the company manage it', () => {
    expect(canManageEvent(admin, internalA)).toBe(true);
    expect(canManageEvent(spocA, internalA)).toBe(true);
    expect(canManageEvent(spocA2, internalA)).toBe(true);
  });
  it('refuses employees of the company, other companies, staff and outsiders', () => {
    for (const who of [memberA, spocB, employee, volunteer, ngo, null]) expect(canManageEvent(who, internalA)).toBe(false);
  });
  it("does not let a SPOC manage public events they didn't create", () => {
    expect(canManageEvent(spocA, adminEvent)).toBe(false);
  });
  it('accepts a populated createdBy', () => {
    expect(canManageEvent(spocA, { companyId: B, createdBy: { _id: 'spocA' } })).toBe(true);
  });
});

describe('Company model', () => {
  it('derives nameKey from name', async () => {
    const c = await makeCompany('  Acme   Corp ');
    expect(c.name).toBe('Acme   Corp');
    expect(c.nameKey).toBe('acme corp');
  });
  it('rejects a second company whose name differs only by case or spacing', async () => {
    await Company.init();
    await makeCompany('Acme Corp');
    await expect(makeCompany('ACME  corp')).rejects.toMatchObject({ code: 11000 });
  });
  it('resolves names by id', async () => {
    const a = await makeCompany('Acme');
    expect(await getCompanyName(a._id)).toBe('Acme');
    expect(await getCompanyName(null)).toBeNull();
    const map = await getCompaniesByIds([a._id, String(a._id), null]);
    expect(map.size).toBe(1);
    expect(map.get(String(a._id)).name).toBe('Acme');
  });
});
