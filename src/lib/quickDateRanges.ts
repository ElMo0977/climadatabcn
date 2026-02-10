import { endOfDay, startOfDay, subDays } from 'date-fns';
import type { DateRange } from '@/types/weather';

export type QuickRangeKey = '7d' | '14d' | '30d';

export const QUICK_RANGE_PRESETS = [
  { key: '7d', label: '7 días', days: 7 },
  { key: '14d', label: '14 días', days: 14 },
  { key: '30d', label: '30 días', days: 30 },
] as const;

function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildQuickRangeExcludingToday(
  days: number,
  now: Date = new Date(),
): DateRange {
  const today = startOfDay(now);
  const to = endOfDay(subDays(today, 1));
  const from = startOfDay(subDays(today, days));
  return { from, to };
}

export function getActiveQuickRangeKey(
  dateRange: DateRange,
  now: Date = new Date(),
): QuickRangeKey | null {
  const currentFrom = toLocalDayKey(startOfDay(dateRange.from));
  const currentTo = toLocalDayKey(startOfDay(dateRange.to));

  for (const preset of QUICK_RANGE_PRESETS) {
    const candidate = buildQuickRangeExcludingToday(preset.days, now);
    const candidateFrom = toLocalDayKey(startOfDay(candidate.from));
    const candidateTo = toLocalDayKey(startOfDay(candidate.to));
    if (candidateFrom === currentFrom && candidateTo === currentTo) {
      return preset.key;
    }
  }

  return null;
}
