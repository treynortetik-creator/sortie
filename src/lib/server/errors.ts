export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message, code: e.code, retryable: e.retryable }, { status: e.status });
  }
  // Never leak internals or upstream bodies (they can echo request data) to the client.
  console.error('[sortie] unexpected error:', e instanceof Error ? e.message : 'unknown');
  return Response.json({ error: 'Something went wrong on the server.', code: 'internal', retryable: true }, { status: 500 });
}
