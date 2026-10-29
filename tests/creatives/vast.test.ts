import { describe, expect, it } from 'vitest';
import { parseDuration, parseVast } from '@/lib/creatives/vast';

const xml = (version: string, extra = '') =>
  `<?xml version="1.0"?><VAST version="${version}"><Ad id="1"><InLine><Creatives><Creative><Linear>${extra}<MediaFiles/></Linear></Creative></Creatives></InLine></Ad></VAST>`;

describe('VAST', () => {
  it.each(['2.0', '3.0', '4.0', '4.2'])('accepts version %s', (v) => {
    expect(parseVast(xml(v)).ok).toBe(true);
  });
  it('rejects version 1 and 5', () => {
    expect(parseVast(xml('1.0')).ok).toBe(false);
    expect(parseVast(xml('5.0')).ok).toBe(false);
  });
  it('accepts a URL, rejects empty and plain text', () => {
    expect(parseVast('https://ads.example.com/vast?id=1')).toEqual({
      ok: true,
      form: 'url',
      version: null,
      durationSeconds: null,
    });
    expect(parseVast('')).toEqual({ ok: false });
    expect(parseVast('not a tag')).toEqual({ ok: false });
    expect(parseVast('ftp://ads.example.com')).toEqual({ ok: false });
  });
  it('rejects malformed XML', () => {
    expect(parseVast('<VAST version="3.0"><Ad></VAST>').ok).toBe(false);
    expect(parseVast('<VAST version="3.0"><Ad></Ad>').ok).toBe(false);
    expect(parseVast('<VAST><Ad/></VAST>').ok).toBe(false);
  });
  it('parses the duration', () => {
    const r = parseVast(xml('3.0', '<Duration>00:00:15.000</Duration>'));
    expect(r).toMatchObject({ ok: true, version: '3.0', durationSeconds: 15 });
    expect(parseDuration('<Duration>01:02:03</Duration>')).toBe(3723);
    expect(parseDuration('<nothing/>')).toBeNull();
  });
});
