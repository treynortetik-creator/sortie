import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rateLimit } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows requests under the limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = rateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it('allows exactly maxRequests within window', () => {
    const key = `test-exact-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, 3, 60_000);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;
    // Fill up the limit
    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 60_000);
    }
    // Next should be blocked
    const result = rateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('allows requests after window expires', () => {
    const key = `test-expire-${Date.now()}`;
    const now = Date.now();

    // Mock Date.now to simulate time passing
    vi.spyOn(Date, 'now').mockReturnValue(now);

    for (let i = 0; i < 3; i++) {
      rateLimit(key, 3, 1000);
    }

    // Move time forward past the window
    vi.spyOn(Date, 'now').mockReturnValue(now + 1500);

    const result = rateLimit(key, 3, 1000);
    expect(result.allowed).toBe(true);
  });

  it('uses separate limits per key', () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;

    // Fill up key1
    for (let i = 0; i < 2; i++) {
      rateLimit(key1, 2, 60_000);
    }

    // key2 should still be allowed
    const result = rateLimit(key2, 2, 60_000);
    expect(result.allowed).toBe(true);

    // key1 should be blocked
    const result2 = rateLimit(key1, 2, 60_000);
    expect(result2.allowed).toBe(false);
  });
});
