import { useEffect, useState } from 'react';
import type { components } from 'api-client';
import { api } from '../api';
import {
  formatDateLong,
  formatTime,
  timeZoneLabel,
  todayIn,
} from '../lib/time';

type Booking = components['schemas']['Booking'];

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; bookings: Booking[]; timeZone: string };

/** Предстоящие Бронирования всех Типов; порядок и фильтр — на сервере. */
export default function BookingsSection() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const load = async (): Promise<State> => {
      try {
        const [bookings, owner] = await Promise.all([
          api.GET('/api/admin/bookings'),
          api.GET('/api/owner'),
        ]);
        if (bookings.data === undefined || owner.data === undefined) {
          return { status: 'error' };
        }
        return {
          status: 'ready',
          bookings: bookings.data,
          timeZone: owner.data.timeZone,
        };
      } catch {
        return { status: 'error' };
      }
    };
    void load().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-labelledby="bookings-title">
      <div className="section-head">
        <h2 id="bookings-title">Предстоящие встречи</h2>
      </div>

      {state.status === 'loading' && <p role="status">Загрузка…</p>}
      {state.status === 'error' && (
        <p role="alert" className="card">
          Не удалось загрузить встречи. Попробуйте обновить страницу.
        </p>
      )}
      {state.status === 'ready' &&
        (state.bookings.length === 0 ? (
          <p className="card">Предстоящих встреч нет</p>
        ) : (
          <ul className="admin-list">
            {state.bookings.map((booking) => (
              <li key={booking.id} className="card">
                <h3>
                  {booking.eventTitle} · {booking.durationMinutes} мин
                </h3>
                <p>
                  {formatDateLong(
                    todayIn(state.timeZone, new Date(booking.start)),
                  )}
                  , {formatTime(booking.start, state.timeZone)}–
                  {formatTime(booking.end, state.timeZone)}
                </p>
                <p className="muted">
                  {timeZoneLabel(state.timeZone, new Date(booking.start))}
                </p>
                <p>
                  {booking.guestName} · {booking.guestEmail}
                </p>
                {booking.note && <p>{booking.note}</p>}
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
