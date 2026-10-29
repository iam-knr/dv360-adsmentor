// Negative keyword list parser (module 15 4.1, KW-002..004): one per line or separated by commas, trimmed, lower
// case, de-duplicated.
import { RESOURCE_LIMITS } from './limits';

export interface ParsedKeywords {
  keywords: string[];
  duplicates: number;
  /** Keywords over 80 characters (KW-004), by position in `keywords`. */
  tooLong: { index: number; text: string }[];
}

export function parseKeywords(input: string | readonly string[]): ParsedKeywords {
  const parts = (typeof input === 'string' ? [input] : input).flatMap((chunk) =>
    chunk.split(/[\r\n,]+/),
  );
  const keywords: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  for (const part of parts) {
    const kw = part.trim().toLowerCase();
    if (!kw) continue;
    if (seen.has(kw)) {
      duplicates += 1;
      continue;
    }
    seen.add(kw);
    keywords.push(kw);
  }
  const tooLong = keywords
    .map((text, index) => ({ index, text }))
    .filter((k) => k.text.length > RESOURCE_LIMITS.KEYWORD_LENGTH_MAX);
  return { keywords, duplicates, tooLong };
}
