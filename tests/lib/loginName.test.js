import { describe, it, expect } from 'vitest';
import { loginSlug, employeeLogin, accountRowsFromSheet } from '@/lib/loginName';

describe('loginSlug', () => {
  it('is the prefix generated team logins use', () => {
    expect(loginSlug('Microsoft')).toBe('microsoft');
    expect(loginSlug('Tata Consultancy Services!')).toBe('tata-consultancy-services');
    expect(loginSlug('日本企業')).toBe('team');
  });
});

describe('employeeLogin (R7)', () => {
  it('prefixes the employee ID with the company slug', () => {
    expect(employeeLogin('microsoft', '1001')).toBe('microsoft-1001');
    expect(employeeLogin('microsoft', 1001)).toBe('microsoft-1001');
  });
  it('trims and lowercases, keeps [a-z0-9._-] and collapses anything else to one dash', () => {
    expect(employeeLogin('microsoft', '  EMP/10 05#  ')).toBe('microsoft-emp-10-05');
    expect(employeeLogin('microsoft', 'A_b.C-9')).toBe('microsoft-a_b.c-9');
    expect(employeeLogin('microsoft', 'José 7')).toBe('microsoft-jos-7');
  });
  it('gives nothing for an ID that is blank or has no usable character', () => {
    for (const id of [undefined, null, '', '   ', '###', {}, ['1']]) expect(employeeLogin('microsoft', id)).toBeNull();
  });
});

describe('accountRowsFromSheet (R7)', () => {
  it('maps ID, Employee ID or Emp ID to employeeId and keeps Email/Username as the username', () => {
    expect(accountRowsFromSheet([
      { Name: 'A', ID: '1001', Email: 'a@x.com' },
      { 'Employee Name': 'B', 'Employee ID': '1002', Username: 'bee' },
      { 'Full Name': 'C', 'Emp ID': '1003' },
      { Name: 'D', Email: 'd@x.com' },
    ])).toEqual([
      { name: 'A', employeeId: '1001', username: 'a@x.com', email: 'a@x.com' },
      { name: 'B', employeeId: '1002', username: 'bee', email: undefined },
      { name: 'C', employeeId: '1003', username: undefined, email: undefined },
      { name: 'D', employeeId: undefined, username: 'd@x.com', email: 'd@x.com' },
    ]);
  });
  it('drops rows without a name', () => {
    expect(accountRowsFromSheet([{ ID: '1' }, { Name: '', ID: '2' }, { Name: 'E' }]).map((r) => r.name)).toEqual(['E']);
  });
});
