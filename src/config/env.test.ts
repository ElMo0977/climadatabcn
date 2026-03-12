import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('env', () => {
  it('defaults to live mode and xemaDebug false without proxy support', async () => {
    const mod = await import('./env');

    expect(mod.env).toEqual({
      dataMode: 'live',
      xemaDebug: false,
    });
  });

  it('only accepts mock as an explicit data mode override', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'mock');
    let mod = await import('./env');
    expect(mod.env.dataMode).toBe('mock');

    vi.resetModules();
    vi.stubEnv('VITE_DATA_MODE', 'unexpected');
    mod = await import('./env');
    expect(mod.env.dataMode).toBe('live');
  });

  it('parses xema debug flag from supported truthy values', async () => {
    vi.stubEnv('VITE_DEBUG_XEMA', 'yes');
    const mod = await import('./env');

    expect(mod.env.xemaDebug).toBe(true);
    expect(mod.parseBooleanEnv('on')).toBe(true);
    expect(mod.parseBooleanEnv('false')).toBe(false);
  });
});
