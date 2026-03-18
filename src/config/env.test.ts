import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env', () => {
  it('defaults to xemaDebug false and timeout 40000', async () => {
    const mod = await import('./env');

    expect(mod.env).toEqual({
      xemaDebug: false,
      xemaHttpTimeoutMs: 40000,
    });
  });

  it('parses xema debug flag from supported truthy values', async () => {
    vi.stubEnv('VITE_DEBUG_XEMA', 'yes');
    const mod = await import('./env');

    expect(mod.env.xemaDebug).toBe(true);
    expect(mod.parseBooleanEnv('on')).toBe(true);
    expect(mod.parseBooleanEnv('false')).toBe(false);
  });

  it('parses xema timeout and falls back for invalid values', async () => {
    vi.stubEnv('VITE_XEMA_HTTP_TIMEOUT_MS', '45000');
    let mod = await import('./env');
    expect(mod.env.xemaHttpTimeoutMs).toBe(45000);

    vi.resetModules();
    vi.stubEnv('VITE_XEMA_HTTP_TIMEOUT_MS', '250');
    mod = await import('./env');
    expect(mod.env.xemaHttpTimeoutMs).toBe(40000);
    expect(mod.parseIntegerEnv('1200', 40000, { min: 1000 })).toBe(1200);
    expect(mod.parseIntegerEnv('oops', 40000)).toBe(40000);
  });
});
