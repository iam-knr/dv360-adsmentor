import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { html5Info, imageDimensions, mp4Duration, sniffType } from '@/lib/creatives/media';

function png(w: number, h: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

function mp4(seconds: number, scale = 1000): Uint8Array {
  const mvhd = new Uint8Array(108);
  const v = new DataView(mvhd.buffer);
  v.setUint32(0, 108);
  mvhd.set([0x6d, 0x76, 0x68, 0x64], 4);
  v.setUint32(20, scale);
  v.setUint32(24, seconds * scale);
  const moov = new Uint8Array(8 + mvhd.length);
  new DataView(moov.buffer).setUint32(0, moov.length);
  moov.set([0x6d, 0x6f, 0x6f, 0x76], 4);
  moov.set(mvhd, 8);
  const ftyp = new Uint8Array(16);
  new DataView(ftyp.buffer).setUint32(0, 16);
  ftyp.set([0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 4);
  const out = new Uint8Array(ftyp.length + moov.length);
  out.set(ftyp);
  out.set(moov, ftyp.length);
  return out;
}

describe('media metadata', () => {
  it('reads PNG and GIF dimensions', () => {
    expect(imageDimensions(png(300, 250))).toEqual({ width: 300, height: 250 });
    const gif = new Uint8Array(13);
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x2c, 0x01, 0xfa, 0x00]);
    expect(imageDimensions(gif)).toEqual({ width: 300, height: 250 });
    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('reads JPEG dimensions from the first frame header', () => {
    const jpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x5a, 0x00, 0x78, 0x03,
    ]);
    expect(imageDimensions(jpg)).toEqual({ width: 120, height: 90 });
  });
  it('sniffs the type from the bytes, not the name', () => {
    expect(sniffType(png(1, 1))).toBe('image/png');
    expect(sniffType(mp4(5))).toBe('video/mp4');
    expect(sniffType(zipSync({ 'index.html': strToU8('<html></html>') }))).toBe('application/zip');
    expect(sniffType(new Uint8Array([0, 1, 2, 3, 4]))).toBeNull();
  });
  it('reads the duration of an mp4', () => {
    expect(mp4Duration(mp4(5))).toBe(5);
    expect(mp4Duration(mp4(30, 600))).toBe(30);
    expect(mp4Duration(new Uint8Array(40))).toBeNull();
  });
  it('reads an HTML5 zip: one entry file, size meta', () => {
    const html = '<html><head><meta name="ad.size" content="width=300,height=250"></head></html>';
    expect(html5Info(zipSync({ 'index.html': strToU8(html), 'a.png': png(1, 1) }))).toEqual({
      entryHtml: true,
      entryName: 'index.html',
      size: { width: 300, height: 250 },
    });
    expect(html5Info(zipSync({ 'a.html': strToU8('x'), 'b.html': strToU8('y') }))?.entryHtml).toBe(
      false,
    );
    expect(html5Info(zipSync({ 'a.png': png(1, 1) }))?.entryHtml).toBe(false);
    expect(html5Info(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
