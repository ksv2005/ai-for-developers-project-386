// Всё время показывается в часовом поясе Владельца (ADR-0002); пояс браузера не используется.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Календарная дата `YYYY-MM-DD` момента `now` в часовом поясе `timeZone`. */
export function todayIn(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function formatIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatIso(parseDate(date).getTime() + days * DAY_MS);
}

/** Номер дня недели с понедельника: 0 — Пн, 6 — Вс. */
export function weekdayIndex(date: string): number {
  return (parseDate(date).getUTCDay() + 6) % 7;
}

/** Даты от понедельника недели с `first` до воскресенья недели с `last`. */
export function weekGrid(first: string, last: string): string[][] {
  const start = addDays(first, -weekdayIndex(first));
  const end = addDays(last, 6 - weekdayIndex(last));
  const weeks: string[][] = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)));
  }
  return weeks;
}

// Календарная дата не привязана к моменту, поэтому форматируем её якорем UTC.
const dateLong = new Intl.DateTimeFormat('ru', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const dateShort = new Intl.DateTimeFormat('ru', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
});
const monthShort = new Intl.DateTimeFormat('ru', {
  timeZone: 'UTC',
  month: 'short',
});

export function formatDateLong(date: string): string {
  return dateLong.format(parseDate(date));
}

export function formatDateShort(date: string): string {
  return dateShort.format(parseDate(date));
}

export function formatMonthShort(date: string): string {
  return monthShort.format(parseDate(date));
}

export function formatTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('ru', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

/** Подпись пояса, например «Europe/Moscow (GMT+3)». */
export function timeZoneLabel(timeZone: string, at: Date): string {
  const offset = new Intl.DateTimeFormat('ru', {
    timeZone,
    timeZoneName: 'shortOffset',
  })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  return offset ? `${timeZone} (${offset})` : timeZone;
}
