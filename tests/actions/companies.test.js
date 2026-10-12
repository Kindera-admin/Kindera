import { describe, it, expect } from 'vitest';
import Company from '@/models/Company';
import Attendance from '@/models/Attendance';
import { actAs } from '../helpers/auth.js';
import { makeWorld, makeEvent } from '../helpers/factories.js';
import {
  listCompanies, createCompany, renameCompany, archiveCompany, restoreCompany, updateCompanyLogo,
} from '@/app/companyActions';

describe('company admin actions', () => {
  it('lets admins and staff create companies', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect((await createCompany('Gamma')).success).toBe(true);
    await actAs(w.employee);
    expect((await createCompany('Delta')).success).toBe(true);
  });

  it('refuses SPOCs, employees, volunteers, NGOs and logged-out callers', async () => {
    const w = await makeWorld();
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      const res = await createCompany('Nope');
      expect(res.success).toBe(false);
    }
    expect(await Company.countDocuments({ nameKey: 'nope' })).toBe(0);
  });

  it('rejects a duplicate name that differs only by case or spacing', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const res = await createCompany('  ACME ');
    expect(res).toEqual({ success: false, message: 'A company with this name already exists' });
  });

  it('allows exactly one company when the same name is created concurrently', async () => {
    const w = await makeWorld();
    await Company.init();
    await actAs(w.admin);
    const results = await Promise.all(Array.from({ length: 5 }, () => createCompany('Omega')));
    expect(results.filter((r) => r.success)).toHaveLength(1);
    for (const r of results.filter((x) => !x.success)) {
      expect(r.message).toBe('A company with this name already exists');
    }
    expect(await Company.countDocuments({ nameKey: 'omega' })).toBe(1);
  });

  it('lists companies with SPOC and employee counts, hiding archived ones by default', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    await archiveCompany(String(w.companyB._id));
    const active = await listCompanies();
    expect(active.companies.map((c) => c.name)).toEqual(['Acme']);
    expect(active.companies[0]).toMatchObject({ spocCount: 2, memberCount: 1 });
    const all = await listCompanies({ includeArchived: true });
    expect(all.companies).toHaveLength(2);
  });

  it('refuses the company list to non-staff', async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    expect((await listCompanies()).success).toBe(false);
  });

  it('renames, archives and restores', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const id = String(w.companyA._id);
    expect((await renameCompany(id, 'Acme Global')).success).toBe(true);
    expect((await Company.findById(id)).nameKey).toBe('acme global');
    expect((await renameCompany(id, 'beta')).message).toBe('A company with this name already exists');
    await archiveCompany(id);
    expect((await Company.findById(id)).status).toBe('archived');
    await restoreCompany(id);
    expect((await Company.findById(id)).status).toBe('active');
  });

  it("lets a SPOC set their own company's logo, and staff set any", async () => {
    const w = await makeWorld();
    await actAs(w.spocA2);
    expect((await updateCompanyLogo('https://x/a.png')).success).toBe(true);
    expect((await Company.findById(w.companyA._id)).logoUrl).toBe('https://x/a.png');
    await actAs(w.admin);
    expect((await updateCompanyLogo('https://x/b.png', String(w.companyB._id))).success).toBe(true);
    expect((await Company.findById(w.companyB._id)).logoUrl).toBe('https://x/b.png');
  });

  it("refuses logo changes from employees, and SPOC changes to another company's logo", async () => {
    const w = await makeWorld();
    await actAs(w.memberA);
    expect((await updateCompanyLogo('https://x/m.png')).success).toBe(false);
    await actAs(w.spocA);
    expect((await updateCompanyLogo('https://x/s.png', String(w.companyB._id))).success).toBe(false);
    expect((await Company.findById(w.companyB._id)).logoUrl).toBe('');
  });

  it('sums volunteer hours for attended records only', async () => {
    const w = await makeWorld();
    const event = await makeEvent(w.admin);
    await Attendance.create({ eventId: event._id, userId: w.spocA._id, companyId: w.companyA._id, attended: true, hoursContributed: 5 });
    await Attendance.create({ eventId: event._id, userId: w.memberA._id, companyId: w.companyA._id, attended: false, hoursContributed: 7 });
    await actAs(w.admin);
    const { companies } = await listCompanies();
    expect(companies.find((c) => c.name === 'Acme').volunteerHours).toBe(5);
    expect(companies.find((c) => c.name === 'Beta').volunteerHours).toBe(0);
  });

  it('refuses rename, archive and restore to everyone except staff, leaving the company unchanged', async () => {
    const w = await makeWorld();
    const id = String(w.companyA._id);
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect((await renameCompany(id, 'Hijacked')).success).toBe(false);
      expect((await archiveCompany(id)).success).toBe(false);
      const afterArchive = await Company.findById(id);
      expect(afterArchive.name).toBe('Acme');
      expect(afterArchive.status).toBe('active');
    }
    await Company.updateOne({ _id: id }, { $set: { status: 'archived' } });
    for (const who of [w.spocA, w.memberA, w.volunteer, w.ngo, null]) {
      await actAs(who);
      expect((await restoreCompany(id)).success).toBe(false);
      expect((await Company.findById(id)).status).toBe('archived');
    }
    expect((await Company.findById(id)).name).toBe('Acme');
  });

  it('refuses logo changes from logged-out, volunteer and NGO callers', async () => {
    const w = await makeWorld();
    for (const who of [null, w.volunteer, w.ngo]) {
      await actAs(who);
      expect((await updateCompanyLogo('https://x/z.png', String(w.companyA._id))).success).toBe(false);
    }
    expect((await Company.findById(w.companyA._id)).logoUrl).toBe('');
  });

  it('requires staff to name a valid company when setting a logo', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    expect(await updateCompanyLogo('https://x/z.png')).toEqual({ success: false, message: 'Company is required' });
    expect(await updateCompanyLogo('https://x/z.png', 'not-an-id')).toEqual({ success: false, message: 'Company is required' });
  });

  it('limits company names to 100 characters on create and rename', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const tooLong = 'x'.repeat(101);
    const exact = 'y'.repeat(100);
    const msg = 'Company name must be at most 100 characters';
    expect(await createCompany(tooLong)).toEqual({ success: false, message: msg });
    expect(await renameCompany(String(w.companyA._id), tooLong)).toEqual({ success: false, message: msg });
    expect((await Company.findById(w.companyA._id)).name).toBe('Acme');
    expect((await createCompany(exact)).success).toBe(true);
    expect((await renameCompany(String(w.companyB._id), 'z'.repeat(100))).success).toBe(true);
  });

  it('enforces the name length limit in the model as well', async () => {
    await expect(Company.create({ name: 'q'.repeat(101) })).rejects.toThrow(/longer than the maximum/);
  });
});
