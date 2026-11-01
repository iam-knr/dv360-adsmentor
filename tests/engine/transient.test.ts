import { describe, expect, it } from 'vitest';
import { isTransientError, withTransientRetry } from '@/lib/db/transient';

describe('isTransientError', () => {
  it.each([
    [{ code: 'P2002', message: 'Unique constraint failed on the fields: (`userId`)' }],
    [{ code: 'P2034', message: 'write conflict' }],
    [{ code: '40P01', message: 'x' }],
    [new Error('Timed out fetching a new connection from the connection pool.')],
    [new Error('deadlock detected')],
    [new Error('read ECONNRESET')],
    [new Error('Server has closed the connection.')],
  ])('retries %j', (err) => expect(isTransientError(err)).toBe(true));

  it.each([
    [new Error('seed exploded')],
    [new Error('Reference data is missing')],
    [new Error('Sandbox has no clock')],
    ['text'],
    [null],
  ])('does not retry %j', (err) => expect(isTransientError(err)).toBe(false));
});

describe('withTransientRetry', () => {
  it('repeats a transient error a bounded number of times, then throws it', async () => {
    let n = 0;
    await expect(
      withTransientRetry(
        () => {
          n++;
          return Promise.reject(new Error('deadlock detected'));
        },
        { attempts: 3, baseMs: 1 },
      ),
    ).rejects.toThrow('deadlock detected');
    expect(n).toBe(3);
  });

  it('succeeds when a later attempt does, and never repeats a real error', async () => {
    let n = 0;
    expect(
      await withTransientRetry(
        () => {
          if (++n < 3) return Promise.reject(Object.assign(new Error('x'), { code: 'P2002' }));
          return Promise.resolve('ok');
        },
        { baseMs: 1 },
      ),
    ).toBe('ok');
    let m = 0;
    await expect(
      withTransientRetry(() => {
        m++;
        return Promise.reject(new Error('seed exploded'));
      }),
    ).rejects.toThrow('seed exploded');
    expect(m).toBe(1);
  });
});
