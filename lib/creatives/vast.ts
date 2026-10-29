// VAST tag check for third-party video and audio (CRE-024). Accepts a URL, or XML of VAST 2, 3 or 4.x. Pure.
export type VastResult =
  | { ok: true; form: 'url' | 'xml'; version: string | null; durationSeconds: number | null }
  | { ok: false };

const VERSION = /<VAST\b[^>]*\bversion\s*=\s*["'](\d+(?:\.\d+)?)["']/i;
const DURATION = /<Duration>\s*(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?\s*<\/Duration>/i;

/** "00:00:15.000" to 15. */
export function parseDuration(text: string): number | null {
  const m = DURATION.exec(text);
  if (!m) return null;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export function parseVast(input: string | null | undefined): VastResult {
  const text = (input ?? '').trim();
  if (!text) return { ok: false };
  if (/^https?:\/\/[^\s/?#]+\S*$/i.test(text)) {
    return { ok: true, form: 'url', version: null, durationSeconds: null };
  }
  if (!text.startsWith('<')) return { ok: false };
  const v = VERSION.exec(text);
  if (!v) return { ok: false };
  const major = Number((v[1] ?? '').split('.')[0]);
  if (![2, 3, 4].includes(major)) return { ok: false };
  if (!/<\/VAST\s*>\s*$/i.test(text)) return { ok: false };
  // Tags must balance: every opened element is closed (self closing and declarations aside).
  const stack: string[] = [];
  for (const m of text.matchAll(/<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g)) {
    const [, close, name, , self] = m;
    if (self) continue;
    if (close) {
      if (stack.pop() !== name) return { ok: false };
    } else stack.push(name!);
  }
  if (stack.length) return { ok: false };
  return { ok: true, form: 'xml', version: v[1] ?? null, durationSeconds: parseDuration(text) };
}
