// ============================================================
// Polyfill global WebSocket for Node.js environments
//
// In Node < 22 or serverless/container runtimes, SupabaseClient
// eagerly instantiates RealtimeClient in its constructor, which
// throws "Node.js 20 detected without native WebSocket support"
// even when the worker only uses PostgreSQL REST/RPC operations.
//
// This MUST be imported before any @supabase/* module is loaded
// so that globalThis.WebSocket is guaranteed to be defined before
// ESM static import evaluations.
// ============================================================

export class StubWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly readyState = 3;
  readonly url = '';
  readonly protocol = '';
  onopen = null;
  onmessage = null;
  onclose = null;
  onerror = null;
  constructor() {}
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = StubWebSocket as unknown as typeof WebSocket;
}

