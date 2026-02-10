import { addDays, startOfDay } from 'date-fns';
import type { DateRange, Observation } from '@/types/weather';

export interface DailyCoverage {
  expectedDays: string[];
  availableDays: string[];
  missingDays: string[];
  expectedCount: number;
  availableCount: number;
  missingCount: number;
}

export function toLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildExpectedDayKeys(range: DateRange): string[] {
  const from = startOfDay(range.from);
  const to = startOfDay(range.to);
  if (from.getTime() > to.getTime()) return [];

  const days: string[] = [];
  let current = from;
  while (current.getTime() <= to.getTime()) {
    days.push(toLocalDayKey(current));
    current = addDays(current, 1);
  }
  return days;
}

export function getObservedDayKeys(observations: Observation[]): string[] {
  return Array.from(
    new Set(observations.map((o) => o.timestamp.slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))),
  ).sort();
}

export function computeDailyCoverage(range: DateRange, observations: Observation[]): DailyCoverage {
  const expectedDays = buildExpectedDayKeys(range);
  const expectedSet = new Set(expectedDays);
  const availableDays = getObservedDayKeys(observations).filter((day) => expectedSet.has(day));
  const availableSet = new Set(availableDays);
  const missingDays = expectedDays.filter((day) => !availableSet.has(day));

  return {
    expectedDays,
    availableDays,
    missingDays,
    expectedCount: expectedDays.length,
    availableCount: availableDays.length,
    missingCount: missingDays.length,
  };
}
