import type { components } from 'api-client';

export const owner: components['schemas']['Owner'] = {
  name: 'Tota Rey',
  timeZone: 'Europe/Moscow',
};

export const introCall: components['schemas']['EventType'] = {
  id: 'intro',
  title: 'Знакомство',
  description: 'Короткий звонок, чтобы познакомиться',
  durationMinutes: 15,
};

export const consultation: components['schemas']['EventType'] = {
  id: 'consultation',
  title: 'Консультация',
  description: 'Разбор вашей задачи',
  durationMinutes: 60,
};

type Slot = components['schemas']['Slot'];

interface BuildSlotsOptions {
  /** Первая дата `YYYY-MM-DD` в поясе Владельца. */
  from: string;
  days: number;
  durationMinutes: number;
  /** Смещение пояса Владельца от UTC в часах (без перехода на летнее время). */
  utcOffsetHours: number;
  /** Рабочее окно 09:00–18:00; по умолчанию все Слоты свободны. */
  isBusy?: (date: string, hhmm: string) => boolean;
}

/** Плоский массив Слотов Рабочего окна, как его отдаёт API. */
export function buildSlots({
  from,
  days,
  durationMinutes,
  utcOffsetHours,
  isBusy = () => false,
}: BuildSlotsOptions): Slot[] {
  const slots: Slot[] = [];
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const date = new Date(fromMs + i * 86_400_000).toISOString().slice(0, 10);
    for (let m = 9 * 60; m + durationMinutes <= 18 * 60; m += durationMinutes) {
      const startMs =
        Date.parse(`${date}T00:00:00Z`) +
        m * 60_000 -
        utcOffsetHours * 3_600_000;
      const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      slots.push({
        date,
        start: new Date(startMs).toISOString(),
        end: new Date(startMs + durationMinutes * 60_000).toISOString(),
        status: isBusy(date, hhmm) ? 'busy' : 'free',
      });
    }
  }
  return slots;
}

type Booking = components['schemas']['Booking'];

/** Бронирование «Консультации» на 15.10.2026 10:00 МСК, как его отдаёт API. */
export const consultationBooking: Booking = {
  id: 'booking-1',
  eventTypeId: 'consultation',
  eventTitle: 'Консультация',
  durationMinutes: 60,
  start: '2026-10-15T07:00:00.000Z',
  end: '2026-10-15T08:00:00.000Z',
  guestName: 'Анна Гость',
  guestEmail: 'anna@example.com',
  note: 'Хочу обсудить проект',
};

/** Бронирование «Знакомства» на 16.10.2026 11:30 МСК, без заметки. */
export const introBooking: Booking = {
  id: 'booking-2',
  eventTypeId: 'intro',
  eventTitle: 'Знакомство',
  durationMinutes: 15,
  start: '2026-10-16T08:30:00.000Z',
  end: '2026-10-16T08:45:00.000Z',
  guestName: 'Борис Гость',
  guestEmail: 'boris@example.com',
  note: '',
};

/** Бронирование Типа, которого больше нет: показывается по снимку. */
export const deletedTypeBooking: Booking = {
  id: 'booking-3',
  eventTypeId: 'workshop',
  eventTitle: 'Воркшоп (удалён)',
  durationMinutes: 90,
  start: '2026-10-17T12:00:00.000Z',
  end: '2026-10-17T13:30:00.000Z',
  guestName: 'Вера Гость',
  guestEmail: 'vera@example.com',
  note: 'Приду с командой',
};
