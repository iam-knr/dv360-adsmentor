// Route handlers of app/api/dv/line-items (routes.md 8.6): list, detail, create, update, creative candidates.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/auth/types';
import type { Issue } from '@/lib/validation/types';
import type {
  CreativePickerRow,
  LineItemDetail,
  LiCopySource,
  LiListResult,
} from '@/lib/line-items/types';
import { prisma } from '@/lib/db';
import { parseListParams, resultToHttp } from '@/lib/line-items/api';
import { dropWorld } from '../../db/helpers';
import { addCreative, createLiWorld, userFor, validDraft, type World } from './helpers';

let current: SessionUser | null = null;
vi.mock('@/lib/auth/session', () => ({ getSessionUser: () => Promise.resolve(current) }));

const { GET: list, POST: create } = await import('@/app/api/dv/line-items/route');
const { GET: detail, PUT: update } = await import('@/app/api/dv/line-items/[liId]/route');
const { GET: copySource } = await import('@/app/api/dv/line-items/[liId]/copy-source/route');
const { GET: candidates } = await import('@/app/api/dv/line-items/creative-candidates/route');

let w: World;
const url = (path: string) => `http://localhost/api/dv/line-items${path}`;
const ctx = (liId: string) => ({ params: Promise.resolve({ liId }) });
const read = async <T>(r: Response): Promise<T> => (await r.json()) as T;
const body = (b: unknown) => ({ method: 'POST', body: JSON.stringify(b) });

beforeAll(async () => {
  w = await createLiWorld('liapi');
});
afterAll(async () => {
  await dropWorld(w);
  await prisma.$disconnect();
});
beforeEach(() => {
  current = userFor(w);
});

describe('parseListParams', () => {
  it('needs a scope and an id', () => {
    expect(parseListParams(new URLSearchParams('scope=io')).ok).toBe(false);
    expect(parseListParams(new URLSearchParams('scope=nope&id=1')).ok).toBe(false);
  });
  it('reads filters, sort and page; archived is a status filter (RC-052)', () => {
    const p = parseListParams(
      new URLSearchParams(
        'scope=advertiser&id=a1&status=ARCHIVED&type=DISPLAY,VIDEO&sort=name:desc&page=2&pageSize=999',
      ),
    );
    expect(p).toMatchObject({
      ok: true,
      scope: { kind: 'advertiser', id: 'a1' },
      query: {
        status: ['ARCHIVED'],
        type: ['DISPLAY', 'VIDEO'],
        sort: { field: 'name', dir: 'desc' },
        page: 2,
        pageSize: 200,
      },
    });
  });
  it('rejects unknown status, type and sort', () => {
    for (const q of ['status=GONE', 'type=RADIO', 'sort=budget:asc']) {
      expect(parseListParams(new URLSearchParams(`scope=io&id=1&${q}`)).ok).toBe(false);
    }
  });
});

describe('resultToHttp', () => {
  it('maps codes to statuses', () => {
    const issue = {
      ruleId: 'X',
      severity: 'error' as const,
      path: '',
      message: 'm',
      blocking: true,
    };
    expect(resultToHttp({ ok: true, data: 1 }).status).toBe(200);
    expect(resultToHttp({ ok: true, data: 1 }, 201).status).toBe(201);
    expect(resultToHttp({ ok: false, issues: [issue] }).status).toBe(422);
    expect(resultToHttp({ ok: false, code: 'FORBIDDEN', issues: [] }).status).toBe(403);
    expect(resultToHttp({ ok: false, code: 'NOT_FOUND', issues: [] }).status).toBe(404);
    expect(resultToHttp({ ok: false, code: 'CONFLICT', issues: [] }).status).toBe(409);
  });
});

describe('handlers', () => {
  let liId = '';

  it('401 without a session', async () => {
    current = null;
    expect((await list(new Request(url(`?scope=io&id=${w.ioId}`)))).status).toBe(401);
    expect((await detail(new Request(url('/x')), ctx('x'))).status).toBe(401);
  });

  it('400 on a bad list query', async () => {
    expect((await list(new Request(url('?scope=io')))).status).toBe(400);
  });

  it('POST creates (201), 422 with the catalogue message when the name is empty', async () => {
    const bad = await create(
      new Request(url(''), body({ ioId: w.ioId, value: await validDraft(w, 'DISPLAY', '') })),
    );
    expect(bad.status).toBe(422);
    const badJson = await read<{ issues: Issue[] }>(bad);
    expect(badJson.issues.map((i) => i.ruleId)).toContain('LI-001');

    const res = await create(
      new Request(
        url(''),
        body({ ioId: w.ioId, value: await validDraft(w, 'DISPLAY', 'API line item') }),
      ),
    );
    expect(res.status).toBe(201);
    liId = (await read<{ data: { id: string } }>(res)).data.id;
    expect(liId).toBeTruthy();
  });

  it('POST without ioId is a 400', async () => {
    const res = await create(new Request(url(''), body({ value: {} })));
    expect(res.status).toBe(400);
  });

  it('GET lists the IO and finds the new line item by name', async () => {
    const res = await list(new Request(url(`?scope=io&id=${w.ioId}&q=API%20line%20item`)));
    expect(res.status).toBe(200);
    const data = await read<LiListResult>(res);
    expect(data.rows.map((r) => r.id)).toEqual([liId]);
    expect(data.rows[0]?.status).toBe('DRAFT');
    const campaign = await list(new Request(url(`?scope=campaign&id=${w.campaignId}`)));
    expect((await read<LiListResult>(campaign)).total).toBeGreaterThanOrEqual(2);
  });

  it('GET detail, 404 for an unknown id', async () => {
    const res = await detail(new Request(url(`/${liId}`)), ctx(liId));
    expect(res.status).toBe(200);
    const d = await read<LineItemDetail>(res);
    expect(d.value.name).toBe('API line item');
    expect(d.version).toBe(1);
    expect((await detail(new Request(url('/nope')), ctx('nope'))).status).toBe(404);
  });

  it('PUT saves, 409 on a stale version, 403 for a read-only user', async () => {
    const d = await read<LineItemDetail>(await detail(new Request(url(`/${liId}`)), ctx(liId)));
    const put = (value: unknown, extra: object = {}) =>
      update(
        new Request(url(`/${liId}`), { method: 'PUT', body: JSON.stringify({ value, ...extra }) }),
        ctx(liId),
      );
    const ok = await put({ ...d.value, name: 'API renamed' }, { expectedVersion: d.version });
    expect(ok.status).toBe(200);
    expect((await read<{ data: { version: number } }>(ok)).data.version).toBe(2);
    const stale = await put({ ...d.value, name: 'Late' }, { expectedVersion: d.version });
    expect(stale.status).toBe(409);
    current = userFor(w, 'READ_ONLY');
    expect((await put({ ...d.value, name: 'Forged' })).status).toBe(403);
    const stored = await prisma.lineItem.findUniqueOrThrow({ where: { id: liId } });
    expect(stored.name).toBe('API renamed');
  });

  it('GET copy-source returns settings without the name', async () => {
    const res = await copySource(new Request(url(`/${liId}/copy-source`)), ctx(liId));
    expect(res.status).toBe(200);
    const data = (await read<{ data: LiCopySource }>(res)).data;
    expect(data.type).toBe('DISPLAY');
    expect(data.settings).not.toHaveProperty('name');
  });

  it('GET creative-candidates per IO flags eligibility', async () => {
    const image = await addCreative(w, 'API banner', 'STANDARD_IMAGE');
    const video = await addCreative(w, 'API spot', 'VIDEO_FILE');
    const res = await candidates(
      new Request(url(`/creative-candidates?ioId=${w.ioId}&type=DISPLAY`)),
    );
    expect(res.status).toBe(200);
    const rows = (await read<{ rows: CreativePickerRow[] }>(res)).rows;
    expect(rows.find((r) => r.id === image)?.eligible).toBe(true);
    expect(rows.find((r) => r.id === video)?.eligible).toBe(false);
    expect(
      (await candidates(new Request(url('/creative-candidates?ioId=x&type=YT_ON_CTV')))).status,
    ).toBe(400);
  });
});
