// Metadata read from uploaded bytes without any decoding library (module 12 K2, K3). Pure.
import { unzipSync } from 'fflate';

export interface Dimensions {
  width: number;
  height: number;
}

/** Width and height from the header of a PNG, GIF or JPEG; null when the bytes are none of them. */
export function imageDimensions(b: Uint8Array): Dimensions | null {
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) {
    return { width: b[6]! | (b[7]! << 8), height: b[8]! | (b[9]! << 8) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1]!;
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return { height: (b[i + 5]! << 8) | b[i + 6]!, width: (b[i + 7]! << 8) | b[i + 8]! };
      }
      i += 2 + ((b[i + 2]! << 8) | b[i + 3]!);
    }
  }
  return null;
}

/** Content type from the first bytes, so a renamed file is not trusted (module 12 Q2: MIME sniffing, no scanning). */
export function sniffType(b: Uint8Array): string | null {
  const s = (from: number, text: string) =>
    [...text].every((c, i) => b[from + i] === c.charCodeAt(0));
  if (b.length > 3 && b[0] === 0x89 && s(1, 'PNG')) return 'image/png';
  if (b.length > 2 && s(0, 'GIF')) return 'image/gif';
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b.length > 3 && s(0, 'PK') && b[2] === 3 && b[3] === 4) return 'application/zip';
  if (b.length > 11 && s(4, 'ftyp')) return s(8, 'qt') ? 'video/quicktime' : 'video/mp4';
  if (b.length > 3 && s(0, 'OggS')) return 'audio/ogg';
  if (b.length > 2 && (s(0, 'ID3') || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)))
    return 'audio/mpeg';
  if (b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3)
    return 'video/webm';
  return null;
}

/** Duration in whole seconds from the `mvhd` box of an MP4 or MOV; null when none is found. */
export function mp4Duration(b: Uint8Array): number | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const at = (i: number) => String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
  const scan = (start: number, end: number): number | null => {
    let i = start;
    while (i + 8 <= end) {
      let size = v.getUint32(i);
      const type = at(i + 4);
      if (size === 1 && i + 16 <= end) size = Number(v.getBigUint64(i + 8));
      if (size < 8) return null;
      if (type === 'moov') return scan(i + 8, Math.min(end, i + size));
      if (type === 'mvhd') {
        const version = b[i + 8];
        const base = i + 8 + 4;
        const [scale, dur] =
          version === 1
            ? [v.getUint32(base + 16), Number(v.getBigUint64(base + 20))]
            : [v.getUint32(base + 8), v.getUint32(base + 12)];
        return scale > 0 ? Math.round(dur / scale) : null;
      }
      i += size;
    }
    return null;
  };
  return scan(0, b.length);
}

export interface Html5Info {
  /** Exactly one HTML entry file. */
  entryHtml: boolean;
  entryName: string | null;
  size: Dimensions | null;
}

/** HTML5 zip: one entry HTML file, and `<meta name="ad.size" content="width=300,height=250">` when present. */
export function html5Info(zip: Uint8Array): Html5Info | null {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip, { filter: (f) => /\.html?$/i.test(f.name) });
  } catch {
    return null;
  }
  const names = Object.keys(files);
  if (names.length !== 1) return { entryHtml: false, entryName: null, size: null };
  const text = new TextDecoder().decode(files[names[0]!]);
  const m = /<meta[^>]*name=["']ad\.size["'][^>]*content=["']width=(\d+),\s*height=(\d+)["']/i.exec(
    text,
  );
  return {
    entryHtml: true,
    entryName: names[0]!,
    size: m ? { width: Number(m[1]), height: Number(m[2]) } : null,
  };
}
