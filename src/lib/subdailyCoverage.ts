import { addMinutes } from 'date-fns';
import type { DateRange, Observation } from '@/types/weather';

export interface SubdailyCoverage {
  expectedSlots: string[];
  availableSlots: string[];
  missingSlots: string[];
  missingIntervals: MissingInterval[];
  largestGap: MissingInterval | null;
  expectedCount: number;
  availableCount: number;
  missingCount: number;
}

export interface MissingInterval {
  start: string;
  end: string;
  missingCount: number;
}

function toLocalHalfHourKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function floorToHalfHour(date: Date): Date {
  const copy = new Date(date);
  copy.setSeconds(0, 0);
  copy.setMinutes(copy.getMinutes() < 30 ? 0 : 30);
  return copy;
}

export function buildExpectedHalfHourKeys(range: DateRange): string[] {
  const from = floorToHalfHour(new Date(range.from));
  const to = floorToHalfHour(new Date(range.to));
  if (from.getTime() > to.getTime()) return [];

  const slots: string[] = [];
  let current = from;
  while (current.getTime() <= to.getTime()) {
    slots.push(toLocalHalfHourKey(current));
    current = addMinutes(current, 30);
  }
  return slots;
}

export function getObservedHalfHourKeys(observations: Observation[]): string[] {
  const out: string[] = [];
  for (const o of observations) {
    const dt = new Date(o.timestamp);
    if (Number.isNaN(dt.getTime())) continue;
    out.push(toLocalHalfHourKey(floorToHalfHour(dt)));
  }
  return Array.from(new Set(out)).sort();
}

export function buildMissingIntervals(
  expectedSlots: string[],
  availableSet: Set<string>,
): MissingInterval[] {
  const intervals: MissingInterval[] = [];
  let idx = 0;

  while (idx < expectedSlots.length) {
    if (availableSet.has(expectedSlots[idx])) {
      idx += 1;
      continue;
    }

    const startIdx = idx;
    while (idx + 1 < expectedSlots.length && !availableSet.has(expectedSlots[idx + 1])) {
      idx += 1;
    }
    const endIdx = idx;

    intervals.push({
      start: expectedSlots[startIdx],
      end: expectedSlots[endIdx],
      missingCount: endIdx - startIdx + 1,
    });

    idx += 1;
  }

  return intervals;
}

export function computeSubdailyCoverage(range: DateRange, observations: Observation[]): SubdailyCoverage {
  const expectedSlots = buildExpectedHalfHourKeys(range);
  const expectedSet = new Set(expectedSlots);
  const availableSlots = getObservedHalfHourKeys(observations).filter((s) => expectedSet.has(s));
  const availableSet = new Set(availableSlots);
  const missingSlots = expectedSlots.filter((s) => !availableSet.has(s));
  const missingIntervals = buildMissingIntervals(expectedSlots, availableSet);
  const largestGap = missingIntervals.reduce<MissingInterval | null>(
    (currentLargest, interval) => {
      if (!currentLargest || interval.missingCount > currentLargest.missingCount) {
        return interval;
      }
      return currentLargest;
    },
    null,
  );

  return {
    expectedSlots,
    availableSlots,
    missingSlots,
    missingIntervals,
    largestGap,
    expectedCount: expectedSlots.length,
    availableCount: availableSlots.length,
    missingCount: missingSlots.length,
  };
}
