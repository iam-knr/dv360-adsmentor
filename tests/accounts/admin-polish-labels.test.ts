import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  isPlaceholderEmail,
} from '@/lib/accounts/audit-labels';
import { FAILED_SANDBOX_MESSAGE, formatElapsed, sandboxStateLabel } from '@/lib/sandbox/labels';
import { homeHrefFor, backLabelFor } from '@/lib/auth/home-href';

describe('S8 sandbox state vocabulary', () => {
  it('maps database and view states to Queued, Building, Ready, Failed', () => {
    expect(sandboxStateLabel('PENDING')).toBe('Queued');
    expect(sandboxStateLabel('QUEUED')).toBe('Queued');
    expect(sandboxStateLabel('SEEDING')).toBe('Building');
    expect(sandboxStateLabel('BACKFILLING')).toBe('Building');
    expect(sandboxStateLabel('BUILDING')).toBe('Building');
    expect(sandboxStateLabel('READY')).toBe('Ready');
    expect(sandboxStateLabel('FAILED')).toBe('Failed');
    expect(sandboxStateLabel(undefined)).toBe('Not created');
    expect(sandboxStateLabel('NOT_CREATED')).toBe('Not created');
  });
});

describe('S4 audit action labels', () => {
  it('has a plain label for every code and none shows an underscore code', () => {
    for (const [code, label] of Object.entries(AUDIT_ACTION_LABELS)) {
      expect(label, code).not.toMatch(/_/);
      expect(label, code).not.toBe(code);
    }
    expect(auditActionLabel('ACCOUNT_ARCHIVED')).toBe('Archived account');
    expect(auditActionLabel('PASSWORD_CHANGED')).toBe('Changed password');
    expect(auditActionLabel('SANDBOX_REBUILT')).toBe('Rebuilt sandbox');
  });
  it('turns an unknown code into words', () => {
    expect(auditActionLabel('SOMETHING_NEW')).toBe('Something new');
  });
  it('knows placeholder addresses', () => {
    expect(isPlaceholderEmail('archived-ab12@example.invalid')).toBe(true);
    expect(isPlaceholderEmail('a@example.com')).toBe(false);
  });
});

describe('S1 and S9 text', () => {
  it('has an admin readable failure message with no developer wording', () => {
    expect(FAILED_SANDBOX_MESSAGE).toContain('Try Retry');
    expect(FAILED_SANDBOX_MESSAGE).not.toMatch(/db:seed|global seed/);
  });
  it('formats elapsed time', () => {
    expect(formatElapsed(42_000)).toBe('42s');
    expect(formatElapsed(65_000)).toBe('1m 05s');
    expect(formatElapsed(-5)).toBe('0s');
  });
});

describe('S3 home links', () => {
  it('sends a Super admin to the accounts list and a student home', () => {
    expect(homeHrefFor('super_admin')).toBe('/manage/accounts');
    expect(backLabelFor('super_admin')).toBe('Back to accounts');
    expect(homeHrefFor('user')).toBe('/');
    expect(backLabelFor('user')).toBe('Back to home');
  });
});
