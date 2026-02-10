import { describe, expect, it } from 'vitest';
import { startOfDay } from 'date-fns';
import { QUICK_RANGE_PRESETS, buildQuickRangeExcludingToday } from './quickDateRanges';

describe('quick date presets', () => {
  it('uses the same presets for all views (7, 14, 30)', () => {
    expect(QUICK_RANGE_PRESETS.map((p) => p.days)).toEqual([7, 14, 30]);
  });

  it('builds a 7-day range excluding today', () => {
    const now = new Date(2026, 1, 10, 12, 0, 0); // 10 Feb 2026 (local)
    const range = buildQuickRangeExcludingToday(7, now);

    const from = startOfDay(range.from);
    const to = startOfDay(range.to);

    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([2026, 1, 3]);
    expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([2026, 1, 9]);

    const daysInclusive = Math.floor(
      (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
    expect(daysInclusive).toBe(7);
  });
});
