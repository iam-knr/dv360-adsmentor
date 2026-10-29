// Real-time access for the runtime. The pure core never reads the clock; the io layer and server.ts get it from here so
// tests can pass `now` explicitly where it matters.
export const nowMs = (): number => Date.now();
