import type { Observation, WeatherStats } from '@/types/weather';
import { calculateStats } from './weatherUtils';
import {
  assessDailyQuality,
  DAILY_QUALITY_VARIABLES,
  madridDayKey,
  parseXemaUtcTimestamp,
  validationSummary,
  type DailyQuality,
  type DailyQualityVariable,
} from './dailyQuality';

const SLOT_MS = 30 * 60_000;

export interface WebDailyObservations {
  data: Observation[];
  qualityByDay: Record<string, DailyQuality>;
}

interface SlotValue {
  value: number;
  isHalfHourly: boolean;
  time: number;
}

function round1(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

function localTime(time: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(time));
}

function sanitizeBoundaryTotals(readings: Observation[]): Observation[] {
  const precipitationSlotCounts = new Map<number, number>();
  for (const reading of readings) {
    const time = parseXemaUtcTimestamp(reading.timestamp);
    if (time === null || typeof reading.precipitation !== 'number'
      || !Number.isFinite(reading.precipitation)) continue;
    const base = reading.variableMetadata?.precipitation?.temporalBase;
    if (base !== 'hourly' && base !== 'half-hourly') continue;
    const slots = base === 'hourly'
      ? [time, time + SLOT_MS] : [time];
    for (const slot of slots) {
      precipitationSlotCounts.set(slot, (precipitationSlotCounts.get(slot) ?? 0) + 1);
    }
  }

  return readings.map((reading) => {
    const time = parseXemaUtcTimestamp(reading.timestamp);
    if (time === null) return reading;
    const straddlesMidnight = madridDayKey(time) !== madridDayKey(time + SLOT_MS);
    const hourlyPrecipitation = reading.variableMetadata?.precipitation?.temporalBase === 'hourly';
    const overlapsPrecipitation = hourlyPrecipitation && [time, time + SLOT_MS]
      .some((slot) => (precipitationSlotCounts.get(slot) ?? 0) > 1);
    // An hourly total cannot be split across local days or reconciled with an
    // overlapping total. Drop it from both the value and coverage assessment.
    const precipitation = hourlyPrecipitation && (straddlesMidnight || overlapsPrecipitation)
      ? null : reading.precipitation;
    const windSpeedMax = straddlesMidnight
      && reading.variableMetadata?.windSpeedMax?.temporalBase === 'hourly'
      ? null : reading.windSpeedMax;
    return precipitation === reading.precipitation && windSpeedMax === reading.windSpeedMax
      ? reading : { ...reading, precipitation, windSpeedMax };
  });
}

/** Web-only aggregation; the legacy Excel aggregation remains unchanged. */
export function buildWebDailyObservations(
  selectedDays: string[],
  readings: Observation[],
): WebDailyObservations {
  const selected = new Set(selectedDays);
  const safeReadings = sanitizeBoundaryTotals(readings);
  const qualityByDay: Record<string, DailyQuality> = {};
  const slotsByDay = new Map<string, Record<DailyQualityVariable, Map<number, SlotValue>>>();

  for (const day of selectedDays) {
    qualityByDay[day] = assessDailyQuality(day, safeReadings);
    slotsByDay.set(day, Object.fromEntries(
      DAILY_QUALITY_VARIABLES.map((variable) => [variable, new Map<number, SlotValue>()]),
    ) as Record<DailyQualityVariable, Map<number, SlotValue>>);
  }

  // Exclusion from value/coverage must not erase provenance. Each finite HO
  // source reading still carries its own validation state on every local day
  // intersected by its two slots, even when the total/max cannot be assigned.
  readings.forEach((reading, index) => {
    const time = parseXemaUtcTimestamp(reading.timestamp);
    if (time === null) return;
    for (const variable of ['precipitation', 'windSpeedMax'] as const) {
      const original = reading[variable];
      if (typeof original !== 'number' || !Number.isFinite(original)
        || safeReadings[index][variable] !== null) continue;
      const validation = reading.variableMetadata?.[variable]?.validationStatus ?? 'unreported';
      for (const day of new Set([madridDayKey(time), madridDayKey(time + SLOT_MS)])) {
        const quality = qualityByDay[day]?.variables[variable];
        if (!quality) continue;
        quality.validationCounts[validation] += 1;
        quality.validationStatus = validationSummary(quality.validationCounts);
        if (quality.status === 'missing') quality.status = 'incomplete';
      }
    }
  });

  for (const reading of safeReadings) {
    const time = parseXemaUtcTimestamp(reading.timestamp);
    if (time === null) continue;

    for (const variable of DAILY_QUALITY_VARIABLES) {
      const value = reading[variable];
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const base = reading.variableMetadata?.[variable]?.temporalBase;
      // Quality records an unresolved reading, but it has no defensible slot
      // and must not alter a daily value or an otherwise usable KPI.
      if (base !== 'hourly' && base !== 'half-hourly') continue;
      const isHalfHourly = base === 'half-hourly';
      const times = base === 'hourly' ? [time, time + SLOT_MS] : [time];
      for (const slotTime of times) {
        const day = madridDayKey(slotTime);
        if (!selected.has(day)) continue;
        // A complete HO total/max belongs to one day; never split it over midnight.
        if ((variable === 'precipitation' || variable === 'windSpeedMax')
          && base === 'hourly' && madridDayKey(time) !== madridDayKey(time + SLOT_MS)) continue;
        const slotMap = slotsByDay.get(day)![variable];
        const existing = slotMap.get(slotTime);
        if (!existing || (isHalfHourly && !existing.isHalfHourly)) {
          slotMap.set(slotTime, { value, isHalfHourly, time });
        }
      }
    }
  }

  const data: Observation[] = [];
  for (const day of selectedDays) {
    const slots = slotsByDay.get(day)!;
    if (DAILY_QUALITY_VARIABLES.every((variable) => slots[variable].size === 0)) continue;
    const average = (variable: DailyQualityVariable): number | null => {
      const values = [...slots[variable].values()].map(({ value }) => value);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    const precipitationReadings = new Map<number, number>();
    for (const slot of slots.precipitation.values()) precipitationReadings.set(slot.time, slot.value);
    const precipitation = precipitationReadings.size
      ? [...precipitationReadings.values()].reduce((sum, value) => sum + value, 0) : null;
    const gusts = [...slots.windSpeedMax.values()];
    const maxGust = gusts.length ? Math.max(...gusts.map(({ value }) => value)) : null;
    const maxGustSlot = gusts.find(({ value }) => value === maxGust);
    const humidity = average('humidity');
    data.push({
      timestamp: day,
      temperature: round1(average('temperature')),
      humidity: humidity === null ? null : Math.round(humidity),
      precipitation: round1(precipitation),
      windSpeed: round1(average('windSpeed')),
      windSpeedMax: round1(maxGust),
      windGustTime: maxGustSlot ? localTime(maxGustSlot.time) : null,
      windDirection: null,
    });
  }

  return { data, qualityByDay };
}

/** Exclude unreliable days per variable without hiding usable values in other columns. */
export function calculateQualityAwareDailyStats(
  data: Observation[],
  qualityByDay: Record<string, DailyQuality>,
): WeatherStats {
  const usable = (day: string, variable: DailyQualityVariable): boolean => {
    const status = qualityByDay[day]?.variables[variable].status;
    return status === 'complete' || status === 'partial';
  };
  const masked = data.map((day) => ({
    ...day,
    temperature: usable(day.timestamp, 'temperature') ? day.temperature : null,
    humidity: usable(day.timestamp, 'humidity') ? day.humidity : null,
    precipitation: usable(day.timestamp, 'precipitation') ? day.precipitation : null,
    windSpeed: usable(day.timestamp, 'windSpeed') ? day.windSpeed : null,
    windSpeedMax: usable(day.timestamp, 'windSpeedMax') ? day.windSpeedMax : null,
  }));
  const stats = calculateStats(masked);
  const gusts = masked.map((day) => day.windSpeedMax)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return {
    ...stats,
    maxWindSpeed: gusts.length ? Math.round(Math.max(...gusts) * 10) / 10 : null,
    // This count describes chart/table rows, not a meteorological variable.
    dataPoints: data.length,
  };
}
