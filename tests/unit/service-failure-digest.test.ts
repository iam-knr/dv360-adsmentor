// A FORBIDDEN service failure that escapes a page renders the 403 page (app/forbidden.tsx), other failures do not.
import { describe, expect, it } from 'vitest';
import { forbidden, notFound, ServiceFailure } from '@/lib/campaigns/service-kit';

describe('ServiceFailure digest', () => {
  it('FORBIDDEN carries the Next.js 403 digest', () => {
    expect(forbidden().digest).toBe('NEXT_HTTP_ERROR_FALLBACK;403');
    expect(forbidden()).toBeInstanceOf(ServiceFailure);
  });
  it('other failures have none', () => {
    expect(notFound().digest).toBeUndefined();
    expect(new ServiceFailure('INVALID').digest).toBeUndefined();
  });
});
