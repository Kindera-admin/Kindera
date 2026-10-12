import { describe, it, expect, vi, afterEach } from 'vitest';
import Company from '@/models/Company';
import { actAs } from '../helpers/auth.js';
import { makeWorld } from '../helpers/factories.js';
import {
  listCompanies, createCompany, renameCompany, archiveCompany, restoreCompany, updateCompanyLogo,
} from '@/app/companyActions';

const RAW = 'MongoServerError: connection reset by internal-host-17';

afterEach(() => vi.restoreAllMocks());

// Every company action answers an unexpected failure with a fixed, user-safe message.
describe('company actions never return raw error text (B7)', () => {
  it('listCompanies', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    vi.spyOn(Company, 'find').mockImplementation(() => { throw new Error(RAW); });
    expect(await listCompanies()).toEqual({ success: false, message: 'Could not load companies. Please try again.' });
  });
  it('createCompany', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    vi.spyOn(Company, 'create').mockRejectedValue(new Error(RAW));
    expect(await createCompany('Gamma')).toEqual({ success: false, message: 'Could not create the company. Please try again.' });
  });
  it('renameCompany', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    vi.spyOn(Company, 'findById').mockRejectedValue(new Error(RAW));
    expect(await renameCompany(String(w.companyA._id), 'Acme Two')).toEqual({ success: false, message: 'Could not rename the company. Please try again.' });
  });
  it('archiveCompany and restoreCompany', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    vi.spyOn(Company, 'updateOne').mockRejectedValue(new Error(RAW));
    const safe = { success: false, message: 'Could not update the company. Please try again.' };
    expect(await archiveCompany(String(w.companyA._id))).toEqual(safe);
    expect(await restoreCompany(String(w.companyA._id))).toEqual(safe);
  });
  it('updateCompanyLogo', async () => {
    const w = await makeWorld();
    await actAs(w.spocA);
    vi.spyOn(Company, 'updateOne').mockRejectedValue(new Error(RAW));
    expect(await updateCompanyLogo('https://logo/x.png')).toEqual({ success: false, message: 'Could not update the logo. Please try again.' });
  });
  it('a schema validation failure on rename is answered safely too', async () => {
    const w = await makeWorld();
    await actAs(w.admin);
    const err = Object.assign(new Error('Company validation failed: name: Cast to string failed'), { name: 'ValidationError' });
    vi.spyOn(Company.prototype, 'save').mockRejectedValue(err);
    const res = await renameCompany(String(w.companyA._id), 'Acme Two');
    expect(res.success).toBe(false);
    expect(res.message).not.toMatch(/validation failed|Cast/);
  });
});
