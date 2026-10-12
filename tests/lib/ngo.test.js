import { describe, it, expect, beforeEach } from 'vitest';
import NGOPartner from '@/models/NGOPartner';
import User from '@/models/User';
import { partnerVisibilityFilter, myNgosFilter, ngoEventCompanies } from '@/lib/ngo';
import { makeWorld, makePartner, makeUser } from '../helpers/factories.js';

let w;
let pub;
let onlyA;
let aAndB;

const namesFor = async (filter) =>
  (await NGOPartner.find(filter).lean()).map((p) => p.name).sort();

beforeEach(async () => {
  w = await makeWorld();
  pub = await makePartner({ name: 'Public' });
  onlyA = await makePartner({ name: 'OnlyA', companyIds: [w.companyA._id] });
  aAndB = await makePartner({ name: 'AandB', companyIds: [w.companyA._id, w.companyB._id] });
});

describe('model fields', () => {
  it('NGOPartner defaults to public with no login', () => {
    expect(pub.companyIds).toHaveLength(0);
    expect(pub.loginUserId).toBeNull();
  });

  it('User.ngoPartnerId defaults to null and stores a partner id', async () => {
    expect(w.ngo.ngoPartnerId).toBeNull();
    const linked = await makeUser('ngo', { ngoPartnerId: onlyA._id });
    const fresh = await User.findById(linked._id).lean();
    expect(String(fresh.ngoPartnerId)).toBe(String(onlyA._id));
  });
});

describe('partnerVisibilityFilter', () => {
  it('staff see everything', async () => {
    expect(partnerVisibilityFilter(w.admin)).toEqual({});
    expect(partnerVisibilityFilter(w.employee)).toEqual({});
    expect(await namesFor(partnerVisibilityFilter(w.admin))).toEqual(['AandB', 'OnlyA', 'Public']);
  });

  it('company A users see public plus every partner containing A', async () => {
    for (const u of [w.spocA, w.spocA2, w.memberA]) {
      expect(await namesFor(partnerVisibilityFilter(u))).toEqual(['AandB', 'OnlyA', 'Public']);
    }
  });

  it('company B users see public plus the shared partner, not A-only', async () => {
    for (const u of [w.spocB, w.memberB]) {
      expect(await namesFor(partnerVisibilityFilter(u))).toEqual(['AandB', 'Public']);
    }
  });

  it('volunteers, NGOs and logged-out callers see public only', async () => {
    for (const u of [w.volunteer, w.ngo, null, undefined]) {
      expect(partnerVisibilityFilter(u)).toEqual({ 'companyIds.0': { $exists: false } });
      expect(await namesFor(partnerVisibilityFilter(u))).toEqual(['Public']);
    }
  });

  it('a corporate user without a company falls back to public only', async () => {
    const lost = { _id: 'lost', role: 'org_spoc', companyId: null };
    expect(await namesFor(partnerVisibilityFilter(lost))).toEqual(['Public']);
  });
});

describe('legacy partner with no companyIds field', () => {
  beforeEach(async () => {
    await NGOPartner.collection.insertOne({ name: 'Legacy', description: 'old' });
  });

  it('is stored without the field (precondition)', async () => {
    const raw = await NGOPartner.collection.findOne({ name: 'Legacy' });
    expect('companyIds' in raw).toBe(false);
  });

  it('is public: visible to staff, company users, volunteers and logged-out callers', async () => {
    for (const u of [w.admin, w.employee, w.spocA, w.spocB, w.volunteer, w.ngo, null]) {
      expect(await namesFor(partnerVisibilityFilter(u))).toContain('Legacy');
    }
  });

  it('is not a company NGO: myNgosFilter excludes it', async () => {
    expect(await namesFor(myNgosFilter(w.spocA))).toEqual(['AandB', 'OnlyA']);
  });

  it('gives an NGO linked to it public events only', async () => {
    const raw = await NGOPartner.collection.findOne({ name: 'Legacy' });
    expect(ngoEventCompanies({ ngoPartnerId: raw._id }, raw)).toEqual([null]);
  });
});

describe('myNgosFilter', () => {
  it('returns only the caller company partners, including shared ones', async () => {
    for (const u of [w.spocA, w.spocA2, w.memberA]) {
      expect(await namesFor(myNgosFilter(u))).toEqual(['AandB', 'OnlyA']);
    }
    expect(await namesFor(myNgosFilter(w.spocB))).toEqual(['AandB']);
  });

  it('is null for staff, volunteers, NGOs, logged-out and company-less corporate callers', () => {
    const lost = { _id: 'lost', role: 'org_member', companyId: null };
    for (const u of [w.admin, w.employee, w.volunteer, w.ngo, lost, null, undefined]) {
      expect(myNgosFilter(u)).toBeNull();
    }
  });
});

describe('ngoEventCompanies', () => {
  it('an unlinked NGO may only create public events', () => {
    expect(ngoEventCompanies({ ngoPartnerId: null }, null)).toEqual([null]);
    expect(ngoEventCompanies({}, undefined)).toEqual([null]);
  });

  it('a linked NGO whose card is missing (deleted) may use nothing', () => {
    expect(ngoEventCompanies({ ngoPartnerId: onlyA._id }, null)).toEqual([]);
    expect(ngoEventCompanies({ ngoPartnerId: onlyA._id }, undefined)).toEqual([]);
  });

  it('a public card gives public events only', () => {
    expect(ngoEventCompanies({ ngoPartnerId: pub._id }, pub)).toEqual([null]);
  });

  it('a company card gives exactly its companies as strings, never null', async () => {
    const one = ngoEventCompanies({ ngoPartnerId: onlyA._id }, onlyA);
    expect(one).toEqual([String(w.companyA._id)]);
    const lean = await NGOPartner.findById(aAndB._id).lean();
    const two = ngoEventCompanies({ ngoPartnerId: aAndB._id }, lean);
    expect(two).toEqual([String(w.companyA._id), String(w.companyB._id)]);
    expect(two.every((v) => typeof v === 'string')).toBe(true);
    expect(two).not.toContain(null);
  });
});
