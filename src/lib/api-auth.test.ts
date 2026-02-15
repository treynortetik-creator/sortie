import { describe, it, expect, vi } from 'vitest';
import { getAuthenticatedUser } from './api-auth';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      }),
    },
  })),
}));

describe('getAuthenticatedUser', () => {
  it('returns null when no Authorization header', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
    });
    const user = await getAuthenticatedUser(request);
    expect(user).toBeNull();
  });

  it('returns null when Authorization header is not Bearer', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { Authorization: 'Basic abc123' },
    });
    const user = await getAuthenticatedUser(request);
    expect(user).toBeNull();
  });

  it('returns null when Bearer token is empty', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' },
    });
    const user = await getAuthenticatedUser(request);
    expect(user).toBeNull();
  });

  it('returns null when Supabase env vars are missing', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    const user = await getAuthenticatedUser(request);
    expect(user).toBeNull();

    // Restore
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });
});
