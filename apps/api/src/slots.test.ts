import { describe, expect, it } from 'vitest';
import { computeSlots } from './slots.js';

const base = { tz: 'UTC', now: new Date('2026-10-15T00:00:00Z'), bookings: [] };

describe('computeSlots', () => {
  it('cuts the 09:00–18:00 window into slots of the event type duration', () => {
    const slots = computeSlots({ ...base, durationMinutes: 60 });
    const today = slots.filter((s) => s.date === '2026-10-15');

    expect(today).toHaveLength(9);
    expect(today[0]).toEqual({
      date: '2026-10-15',
      start: '2026-10-15T09:00:00.000Z',
      end: '2026-10-15T10:00:00.000Z',
      status: 'free',
    });
    expect(today[8]?.end).toBe('2026-10-15T18:00:00.000Z');
  });

  it('covers 14 calendar dates including weekends, today being day 1', () => {
    const slots = computeSlots({ ...base, durationMinutes: 15 });
    const dates = [...new Set(slots.map((s) => s.date))];

    expect(dates).toHaveLength(14);
    expect(dates[0]).toBe('2026-10-15');
    expect(dates[13]).toBe('2026-10-28');
    expect(slots).toHaveLength(14 * 36);
  });

  it('drops the incomplete tail that would not fit the window', () => {
    const slots = computeSlots({ ...base, durationMinutes: 25 });
    const today = slots.filter((s) => s.date === '2026-10-15');

    expect(today).toHaveLength(21);
    expect(today[20]?.end).toBe('2026-10-15T17:45:00.000Z');
  });

  it('marks slots that have not strictly started in the future as busy', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    const today = computeSlots({ ...base, now, durationMinutes: 60 }).filter(
      (s) => s.date === '2026-10-15',
    );

    expect(today.map((s) => s.status)).toEqual([
      'busy', // 09:00
      'busy', // 10:00 starts exactly now
      'free',
      'free',
      'free',
      'free',
      'free',
      'free',
      'free',
    ]);
  });

  it('marks slots overlapping a booking of any duration as busy, edges excluded', () => {
    const bookings = [
      { start: '2026-10-16T09:30:00.000Z', end: '2026-10-16T10:00:00.000Z' },
    ];
    const day = computeSlots({ ...base, bookings, durationMinutes: 15 }).filter(
      (s) => s.date === '2026-10-16',
    );
    const status = (hhmm: string) =>
      day.find((s) => s.start === `2026-10-16T${hhmm}:00.000Z`)?.status;

    expect(status('09:15')).toBe('free');
    expect(status('09:30')).toBe('busy');
    expect(status('09:45')).toBe('busy');
    expect(status('10:00')).toBe('free');
  });

  it('uses the owner time zone for dates and window boundaries', () => {
    // 2026-10-15T21:30Z is already 2026-10-16 00:30 in Moscow (UTC+3)
    const now = new Date('2026-10-15T21:30:00Z');
    const slots = computeSlots({
      ...base,
      tz: 'Europe/Moscow',
      now,
      durationMinutes: 60,
    });

    expect(slots[0]).toEqual({
      date: '2026-10-16',
      start: '2026-10-16T06:00:00.000Z',
      end: '2026-10-16T07:00:00.000Z',
      status: 'free',
    });
  });

  it('follows local time across a DST change', () => {
    // US clocks go back on 2026-11-01: New York is UTC-4 before, UTC-5 after
    const now = new Date('2026-10-30T00:00:00Z');
    const slots = computeSlots({
      ...base,
      tz: 'America/New_York',
      now,
      durationMinutes: 60,
    });
    const first = (date: string) => slots.find((s) => s.date === date)?.start;

    expect(first('2026-10-31')).toBe('2026-10-31T13:00:00.000Z');
    expect(first('2026-11-02')).toBe('2026-11-02T14:00:00.000Z');
  });
});
