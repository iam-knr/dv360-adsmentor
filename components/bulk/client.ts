'use client';
// Fetch helpers of the bulk components. Every call returns the parsed body and never throws on a rule failure.
import type { BulkEntityKey } from '@/lib/bulk/entities';
import type { BulkParams, BulkResponse } from '@/lib/bulk/types';

export const ENTITY_PATH: Record<BulkEntityKey, string> = {
  campaign: 'campaigns',
  insertionOrder: 'insertion-orders',
  lineItem: 'line-items',
};

export type Outcome<T> = { ok: true; data: T } | { ok: false; message: string };

async function post<T>(url: string, body: unknown): Promise<Outcome<T>> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as { data?: T; issues?: { message: string }[]; message?: string };
    if (res.ok && json.data !== undefined) return { ok: true, data: json.data };
    return { ok: false, message: json.issues?.[0]?.message ?? json.message ?? 'Something went wrong. Try again.' };
  } catch {
    return { ok: false, message: 'Something went wrong. Try again.' };
  }
}

export const runBulkRequest = (entity: BulkEntityKey, ids: string[], params: BulkParams) =>
  post<BulkResponse>(`/api/dv/${ENTITY_PATH[entity]}/bulk`, { ids, params });

export interface PickItem {
  id: string;
  label: string;
  detail?: string;
}

export async function fetchOptions(advertiserId: string, kind: 'creatives' | 'templates' | 'deals' | 'dealGroups'): Promise<PickItem[]> {
  const res = await fetch(`/api/dv/bulk-options?advertiserId=${encodeURIComponent(advertiserId)}&kind=${kind}`);
  const json = (await res.json().catch(() => ({}))) as { data?: PickItem[] };
  return json.data ?? [];
}

export const requestDownload = (body: unknown) => post<{ jobId: string }>('/api/dv/sdf/download', body);

export async function uploadSdf(advertiserId: string, files: File[]): Promise<Outcome<{ jobId: string; status: string; perFile: { entity: string; rows: number; succeeded: number; failed: number; warnings: number }[]; fileErrors: { file: string; ruleId: string; message: string }[]; euDefaulted: number }>> {
  const form = new FormData();
  form.set('advertiserId', advertiserId);
  for (const f of files) form.append('files', f);
  try {
    const res = await fetch('/api/dv/sdf/upload', { method: 'POST', body: form });
    const json = (await res.json().catch(() => ({}))) as { data?: never; issues?: { message: string }[]; message?: string };
    if (res.ok && json.data) return { ok: true, data: json.data };
    return { ok: false, message: json.issues?.[0]?.message ?? json.message ?? 'Something went wrong. Try again.' };
  } catch {
    return { ok: false, message: 'Something went wrong. Try again.' };
  }
}
