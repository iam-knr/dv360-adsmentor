import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { GET } from '@/app/api/health/route';

describe('database health', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('answers select 1', async () => {
    const rows = await prisma.$queryRaw<{ one: number }[]>`select 1 as one`;
    expect(rows[0]?.one).toBe(1);
  });

  it('reads and writes AppMeta', async () => {
    await prisma.appMeta.upsert({
      where: { key: 'sanity' },
      create: { key: 'sanity', value: 'a' },
      update: { value: 'a' },
    });
    await prisma.appMeta.update({ where: { key: 'sanity' }, data: { value: 'b' } });
    const row = await prisma.appMeta.findUnique({ where: { key: 'sanity' } });
    expect(row?.value).toBe('b');
  });

  it('health route returns ok and db true', async () => {
    const res = await GET();
    const body = (await res.json()) as { ok: boolean; db: boolean; version: string };
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, db: true });
    expect(typeof body.version).toBe('string');
  });
});
