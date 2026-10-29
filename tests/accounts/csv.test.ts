import { describe, expect, it } from 'vitest';
import { csvCell, toCsv } from '@/lib/accounts/csv';
import { checkCapacity, checkEmail, checkName, checkNotes } from '@/lib/accounts/rules';

describe('csv cells are formula safe (T13)', () => {
  it.each(['=1+1', '+1', '-1', '@x', '\tx', '\rx'])('prefixes %j', (v) => {
    expect(csvCell(v).replace(/^"/, '')).toMatch(/^'/);
  });
  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });
  it('leaves plain text alone and writes empty for null', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell(null)).toBe('');
  });
  it('builds rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [['1', '=2']])).toBe("a,b\r\n1,'=2\r\n");
  });
});

describe('ACC field checks', () => {
  it('ACC-001 email', () => {
    expect(checkEmail('a@example.test')).toBeNull();
    expect(checkEmail('nope')).toBe('Enter a valid email address.');
    expect(checkEmail(`${'a'.repeat(250)}@e.test`)).not.toBeNull();
  });
  it('ACC-003 name', () => {
    expect(checkName('')).toBe('Enter a value');
    expect(checkName('x'.repeat(101))).toBe('Use 100 characters or fewer.');
    expect(checkName('Ok')).toBeNull();
  });
  it('ACC-004 notes', () => {
    expect(checkNotes('x'.repeat(501))).toBe('Use 500 characters or fewer.');
    expect(checkNotes(undefined)).toBeNull();
  });
  it('ACC-034 capacity', () => {
    expect(checkCapacity(0, true)).toBe('Use a number from 1 to 60.');
    expect(checkCapacity(61, true)).toBe('Use a number from 1 to 60.');
    expect(checkCapacity(30, false)).toBe('Only a super admin can raise the limit above 25.');
    expect(checkCapacity(30, true)).toBeNull();
    expect(checkCapacity(25, false)).toBeNull();
  });
});
