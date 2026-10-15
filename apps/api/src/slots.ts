export const WINDOW_START_MINUTE = 9 * 60;
export const WINDOW_END_MINUTE = 18 * 60;
export const HORIZON_DAYS = 14;

export interface Interval {
  start: string;
  end: string;
}

export interface Slot extends Interval {
  date: string;
  status: 'free' | 'busy';
}

export interface ComputeSlotsInput {
  durationMinutes: number;
  bookings: Interval[];
  now: Date;
  tz: string;
}

const MINUTE = 60_000;

function localParts(ms: number, tz: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(ms);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

function offsetMs(ms: number, tz: string): number {
  const p = localParts(ms, tz);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** UTC instant of the local wall-clock time `minuteOfDay` on the given local date. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  minuteOfDay: number,
  tz: string,
): number {
  const naive = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  const first = naive - offsetMs(naive, tz);
  return naive - offsetMs(first, tz);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function computeSlots({
  durationMinutes,
  bookings,
  now,
  tz,
}: ComputeSlotsInput): Slot[] {
  const busy = bookings.map((b) => ({
    start: Date.parse(b.start),
    end: Date.parse(b.end),
  }));
  const today = localParts(now.getTime(), tz);
  const slots: Slot[] = [];

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const date = `${y}-${pad(m)}-${pad(d)}`;

    for (
      let minute = WINDOW_START_MINUTE;
      minute + durationMinutes <= WINDOW_END_MINUTE;
      minute += durationMinutes
    ) {
      const start = zonedToUtc(y, m, d, minute, tz);
      const end = start + durationMinutes * MINUTE;
      const taken =
        start <= now.getTime() ||
        busy.some((b) => start < b.end && b.start < end);
      slots.push({
        date,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        status: taken ? 'busy' : 'free',
      });
    }
  }
  return slots;
}
