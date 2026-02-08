import { describe, it, expect } from 'vitest';
import { exceedanceIntervals } from './exceedance';

describe('exceedanceIntervals', () => {
  it('returns empty when no observations exceed threshold', () => {
    const obs = [
      { timestamp: '2024-01-01T10:00:00', windSpeedMax: 2 },
      { timestamp: '2024-01-01T11:00:00', windSpeedMax: 3 },
    ];
    expect(exceedanceIntervals(obs, 5)).toEqual([]);
  });

  it('returns one interval when one hour exceeds', () => {
    const obs = [
      { timestamp: '2024-01-01T10:00:00', windSpeedMax: 2 },
      { timestamp: '2024-01-01T11:00:00', windSpeedMax: 6 },
      { timestamp: '2024-01-01T12:00:00', windSpeedMax: 2 },
    ];
    expect(exceedanceIntervals(obs, 5)).toEqual([
      { start: '2024-01-01T11:00:00', end: '2024-01-01T11:00:00' },
    ]);
  });

  it('consolidates contiguous hours into one interval', () => {
    const obs = [
      { timestamp: '2024-01-01T10:00:00', windSpeedMax: 2 },
      { timestamp: '2024-01-01T11:00:00', windSpeedMax: 6 },
      { timestamp: '2024-01-01T12:00:00', windSpeedMax: 7 },
      { timestamp: '2024-01-01T13:00:00', windSpeedMax: 6 },
      { timestamp: '2024-01-01T14:00:00', windSpeedMax: 2 },
    ];
    expect(exceedanceIntervals(obs, 5)).toEqual([
      { start: '2024-01-01T11:00:00', end: '2024-01-01T13:00:00' },
    ]);
  });

  it('sorts by timestamp before computing intervals', () => {
    const obs = [
      { timestamp: '2024-01-01T12:00:00', windSpeedMax: 6 },
      { timestamp: '2024-01-01T11:00:00', windSpeedMax: 6 },
      { timestamp: '2024-01-01T10:00:00', windSpeedMax: 2 },
    ];
    expect(exceedanceIntervals(obs, 5)).toEqual([
      { start: '2024-01-01T11:00:00', end: '2024-01-01T12:00:00' },
    ]);
  });
});
