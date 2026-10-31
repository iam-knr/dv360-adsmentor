// Q1: the product is spelled "Adsmetor" in every UI string. "Adsmentor" / "AdsMentor" must not appear in app/,
// components/ or lib/. Exempt: URLs and asset paths (public/brand/adsmentor-*.png), repo names (iam-knr/dv360-adsmentor),
// and the lowercase password deny list in lib/auth/common-passwords.ts.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = ['app', 'components', 'lib'];
const BAD = /Ads[Mm]entor/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mdx?|json)$/.test(name)) out.push(p);
  }
  return out;
}

describe('brand spelling', () => {
  it('never spells the brand "Adsmentor" or "AdsMentor" in UI strings', () => {
    const hits: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          const cleaned = line
            .replace(/https?:\/\/\S+/g, '')
            .replace(/[\w./-]*adsmentor[\w./-]*/g, '')
            .replace(/iam-knr\/dv360-adsmentor/gi, '');
          if (BAD.test(cleaned)) hits.push(`${file}:${i + 1}: ${line.trim()}`);
        });
      }
    }
    expect(hits).toEqual([]);
  });
});
