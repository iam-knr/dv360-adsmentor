// File storage behind an interface (module 12 4.3 upload flow). The Vercel Blob store is owner item P-08 and is not
// set up yet, so the default is an in-memory store (per server process). `BlobFileStore` is used when
// BLOB_READ_WRITE_TOKEN is present. Only the bytes live here; size and type come from the `Upload` row.
export interface FileStore {
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
}

class MemoryFileStore implements FileStore {
  private files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { bytes, contentType });
    return Promise.resolve();
  }
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    return Promise.resolve(this.files.get(key) ?? null);
  }
}

class BlobFileStore implements FileStore {
  constructor(private readonly token: string) {}
  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const { put } = await import('@vercel/blob');
    await put(key, Buffer.from(bytes), {
      access: 'public',
      contentType,
      token: this.token,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
  async get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
    const { head } = await import('@vercel/blob');
    try {
      const meta = await head(key, { token: this.token });
      const res = await fetch(meta.url);
      if (!res.ok) return null;
      return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: meta.contentType };
    } catch {
      return null;
    }
  }
}

const globalStore = globalThis as unknown as { __creativeFileStore?: FileStore };

/** Memory unless the Blob token exists. The memory store is shared through `globalThis` so Next.js module copies agree. */
export function fileStore(): FileStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) return new BlobFileStore(token);
  return (globalStore.__creativeFileStore ??= new MemoryFileStore());
}

/** Test seam. */
export function setFileStore(store: FileStore | null): void {
  if (store) globalStore.__creativeFileStore = store;
  else delete globalStore.__creativeFileStore;
}
