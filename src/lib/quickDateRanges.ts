import { endOfDay, startOfDay, subDays } from 'date-fns';
import type { DateRange } from '@/types/weather';

export const QUICK_RANGE_PRESETS = [
  { label: '7 días', days: 7 },
  { label: '14 días', days: 14 },
  { label: '30 días', days: 30 },
] as const;

export function buildQuickRangeExcludingToday(
  days: number,
  now: Date = new Date(),
): DateRange {
  const today = startOfDay(now);
  const to = endOfDay(subDays(today, 1));
  const from = startOfDay(subDays(today, days));
  return { from, to };
}
