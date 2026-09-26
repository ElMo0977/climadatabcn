import type { Observation, XemaValidationStatus } from '@/types/weather';

const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60_000;
const MAX_AVERAGE_GAP_MINUTES = 360;

export const DAILY_QUALITY_VARIABLES = [
  'temperature',
  'humidity',
  'precipitation',
  'windSpeed',
  'windSpeedMax',
] as const;

export type DailyQualityVariable = typeof DAILY_QUALITY_VARIABLES[number];
export type DailyCoverageStatus = 'missing' | 'incomplete' | 'partial' | 'complete';
export type DailyValidationStatus = XemaValidationStatus | 'mixed';

export interface VariableDailyQuality {
  coveredSlots: number;
  coverage: number;
  status: DailyCoverageStatus;
  longestMissingGapMinutes: number;
  /** Finite readings whose temporal base cannot establish slot coverage. */
  unresolvedBaseReadings: number;
  /** Counts finite source readings, not occupied slots; overlapping readings remain visible. */
  validationCounts: Record<XemaValidationStatus, number>;
  validationStatus: DailyValidationStatus;
  /** Partial daily totals/maxima are only the minimum observed value. */
  isObservedLowerBound: boolean;
}

export interface DailyQuality {
  dayKey: string;
  expectedSlots: number;
  variables: Record<DailyQualityVariable, VariableDailyQuality>;
}

const madridDateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function madridDayKey(timestampMs: number): string {
  const parts = madridDateFormatter.formatToParts(new Date(timestampMs));
  const get = (type: 'year' | 'month' | 'day') => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function expectedSlotTimes(dayKey: string): number[] {
  const utcMidnight = Date.parse(`${dayKey}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)
    || !Number.isFinite(utcMidnight)
    || new Date(utcMidnight).toISOString().slice(0, 10) !== dayKey) {
    throw new RangeError(`Invalid daily quality day key: ${dayKey}`);
  }

  const slots: number[] = [];
  // Madrid is UTC+1/+2; this wider UTC scan also covers both DST transitions.
  for (let time = utcMidnight - 4 * 3_600_000;
    time < utcMidnight + 28 * 3_600_000;
    time += SLOT_MS) {
    if (madridDayKey(time) === dayKey) slots.push(time);
  }
  return slots;
}

function parseXemaUtcTimestamp(timestamp: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/i.test(timestamp)) {
    return null;
  }
  const explicitUtc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
    ? timestamp
    : `${timestamp}Z`;
  const time = Date.parse(explicitUtc);
  return Number.isFinite(time) && time % SLOT_MS === 0 ? time : null;
}

function newValidationCounts(): Record<XemaValidationStatus, number> {
  return { valid: 0, pending: 0, 'not-started': 0, unknown: 0, unreported: 0 };
}

function validationSummary(counts: Record<XemaValidationStatus, number>): DailyValidationStatus {
  const present = (Object.keys(counts) as XemaValidationStatus[])
    .filter((status) => counts[status] > 0);
  return present.length === 0 ? 'unreported' : present.length === 1 ? present[0] : 'mixed';
}

function longestMissingGap(slots: number[], occupied: Set<number>): number {
  let longest = 0;
  let current = 0;
  for (const time of slots) {
    current = occupied.has(time) ? 0 : current + SLOT_MINUTES;
    longest = Math.max(longest, current);
  }
  return longest;
}

/**
 * Assess one Europe/Madrid calendar day from XEMA subdaily readings. A HO reading
 * occupies its timestamp and the next 30-minute slot; SH occupies one slot.
 * This does not aggregate values and does not alter the legacy Excel path.
 */
export function assessDailyQuality(dayKey: string, readings: Observation[]): DailyQuality {
  const slots = expectedSlotTimes(dayKey);
  const expected = new Set(slots);
  const variables = {} as Record<DailyQualityVariable, VariableDailyQuality>;

  for (const variable of DAILY_QUALITY_VARIABLES) {
    const occupied = new Set<number>();
    const validationCounts = newValidationCounts();
    let unresolvedBaseReadings = 0;

    for (const reading of readings) {
      const value = reading[variable];
      const time = parseXemaUtcTimestamp(reading.timestamp);
      if (typeof value !== 'number' || !Number.isFinite(value) || time === null) continue;

      const base = reading.variableMetadata?.[variable]?.temporalBase ?? 'unreported';
      const proposedSlots = base === 'hourly'
        ? [time, time + SLOT_MS]
        : base === 'half-hourly' ? [time] : [];
      const overlapping = proposedSlots.filter((slot) => expected.has(slot));
      const unresolvedInDay = proposedSlots.length === 0 && madridDayKey(time) === dayKey;
      if (overlapping.length === 0 && !unresolvedInDay) continue;

      const validation = reading.variableMetadata?.[variable]?.validationStatus ?? 'unreported';
      validationCounts[validation] += 1;
      if (unresolvedInDay) unresolvedBaseReadings += 1;
      for (const slot of overlapping) occupied.add(slot);
    }

    const coveredSlots = occupied.size;
    const observedReadings = Object.values(validationCounts).reduce((sum, count) => sum + count, 0);
    const coverage = coveredSlots / slots.length;
    const longestMissingGapMinutes = longestMissingGap(slots, occupied);
    const needsGapLimit = variable === 'temperature' || variable === 'humidity' || variable === 'windSpeed';
    let status: DailyCoverageStatus;
    if (observedReadings === 0) status = 'missing';
    else if (coveredSlots === slots.length) status = 'complete';
    else if (coverage > 0.7 && (!needsGapLimit || longestMissingGapMinutes <= MAX_AVERAGE_GAP_MINUTES)) {
      status = 'partial';
    } else status = 'incomplete';

    variables[variable] = {
      coveredSlots,
      coverage,
      status,
      longestMissingGapMinutes,
      unresolvedBaseReadings,
      validationCounts,
      validationStatus: validationSummary(validationCounts),
      isObservedLowerBound: (variable === 'precipitation' || variable === 'windSpeedMax')
        && observedReadings > 0 && coveredSlots < slots.length,
    };
  }

  return { dayKey, expectedSlots: slots.length, variables };
}
