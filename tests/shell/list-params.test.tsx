// useListParams parse and serialise round trip (routes.md 6.1, 6.2, 6.4).
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isDateParam,
  LIST_DEFAULTS,
  parseListParams,
  serializeListParams,
  type ListParams,
} from '@/lib/hooks/list-params';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => '/p/1/a/2/cs',
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
}));

const { useListParams } = await import('@/lib/hooks/useListParams');

const full: ListParams = {
  d: '20260101:20260131',
  q: 'diwali sale',
  f: { status: ['ACTIVE', 'PAUSED'], type: ['DISPLAY'] },
  sort: [
    { field: 'name', dir: 'asc' },
    { field: 'impressions', dir: 'desc' },
  ],
  rows: 50,
  page: 3,
  cv: 'c_view1',
  seg: 'budgetType',
};

describe('list params', () => {
  it('round trips every key: d, q, f.*, sort, rows, page, cv, seg', () => {
    const qs = serializeListParams(full);
    expect(qs.toString()).toBe(
      'd=20260101%3A20260131&q=diwali+sale&f.status=ACTIVE&f.status=PAUSED&f.type=DISPLAY' +
        '&sort=name%3Aasc%2Cimpressions%3Adesc&rows=50&page=3&cv=c_view1&seg=budgetType',
    );
    const back = parseListParams(qs);
    expect(back.dirty).toBe(false);
    expect(back.params).toEqual(full);
    expect(serializeListParams(back.params).toString()).toBe(qs.toString());
  });

  it('defaults give an empty query and parse back to the defaults', () => {
    expect(serializeListParams(LIST_DEFAULTS).toString()).toBe('');
    expect(parseListParams(new URLSearchParams())).toEqual({ params: LIST_DEFAULTS, dirty: false });
  });

  it('per page defaults are left out of the URL (status Active chip)', () => {
    const defaults = { d: 'YESTERDAY', f: { status: ['ACTIVE'] } };
    const parsed = parseListParams(new URLSearchParams(), defaults).params;
    expect(parsed.d).toBe('YESTERDAY');
    expect(parsed.f).toEqual({ status: ['ACTIVE'] });
    expect(serializeListParams(parsed, defaults).toString()).toBe('');
    const removed = { ...parsed, f: { status: ['*'] } };
    expect(serializeListParams(removed, defaults).toString()).toBe('f.status=*');
    expect(parseListParams(new URLSearchParams('f.status=*'), defaults).params.f).toEqual({
      status: ['*'],
    });
  });

  it('keeps unrelated params such as sim_as and replaces stale list keys', () => {
    const qs = serializeListParams(
      { ...LIST_DEFAULTS, page: 2 },
      {},
      new URLSearchParams('sim_as=u1&page=9&f.old=x&sim_panel=channel:3'),
    );
    expect(qs.toString()).toBe('sim_as=u1&sim_panel=channel%3A3&page=2');
  });

  it.each([
    ['d=NOT_A_RANGE', 'd'],
    ['d=20260231:20260301', 'd'],
    ['d=20260301:20260201', 'd'],
    ['rows=30', 'rows'],
    ['page=0', 'page'],
    ['page=abc', 'page'],
    ['sort=name', 'sort'],
    ['sort=name:up', 'sort'],
    ['cv=unknown', 'cv'],
    ['seg=1bad', 'seg'],
    ['f.=x', 'f'],
    ['f.status=', 'f'],
  ])('bad value %s falls back to the default and marks the URL dirty', (query, key) => {
    const { params, dirty } = parseListParams(new URLSearchParams(query));
    expect(dirty).toBe(true);
    expect(params[key as keyof ListParams]).toEqual(LIST_DEFAULTS[key as keyof ListParams]);
  });

  it('accepts every date form of routes.md 6.1', () => {
    for (const v of ['YESTERDAY', 'LIFETIME', '90D_TODAY', '7D_YESTERDAY', '20260101:20260101']) {
      expect(isDateParam(v), v).toBe(true);
    }
    for (const v of ['0D_TODAY', 'yesterday', '2026-01-01:2026-01-02', '20260101']) {
      expect(isDateParam(v), v).toBe(false);
    }
  });
});

describe('useListParams', () => {
  beforeEach(() => {
    nav.replace.mockReset();
  });

  it('reads the URL and writes changes back, resetting the page', () => {
    nav.search = 'q=a&page=4&sim_as=u1';
    const { result } = renderHook(() => useListParams());
    expect(result.current.params.q).toBe('a');
    expect(result.current.params.page).toBe(4);
    expect(nav.replace).not.toHaveBeenCalled();
    act(() => result.current.update({ f: { status: ['PAUSED'] } }));
    expect(nav.replace).toHaveBeenCalledWith('/p/1/a/2/cs?sim_as=u1&q=a&f.status=PAUSED', {
      scroll: false,
    });
    act(() => result.current.update({ page: 2 }));
    expect(nav.replace).toHaveBeenLastCalledWith('/p/1/a/2/cs?sim_as=u1&q=a&page=2', {
      scroll: false,
    });
  });

  it('cleans a bad URL with router.replace (routes.md 6.4)', () => {
    nav.search = 'rows=7&q=x';
    renderHook(() => useListParams());
    expect(nav.replace).toHaveBeenCalledWith('/p/1/a/2/cs?q=x', { scroll: false });
  });
});
