import { useEffect, useState } from 'react';
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';
import type { components } from 'api-client';
import { api } from '../api';
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatMonthShort,
  formatTime,
  timeZoneLabel,
  todayIn,
  weekGrid,
} from '../lib/time';

type Owner = components['schemas']['Owner'];
type EventType = components['schemas']['EventType'];
type Slot = components['schemas']['Slot'];

const HORIZON_DAYS = 14;
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | {
      status: 'ready';
      owner: Owner;
      eventType: EventType;
      slots: Slot[];
      now: Date;
    };

async function load(id: string): Promise<State> {
  try {
    const [owner, eventTypes, slots] = await Promise.all([
      api.GET('/api/owner'),
      api.GET('/api/event-types'),
      api.GET('/api/event-types/{id}/slots', { params: { path: { id } } }),
    ]);
    if (eventTypes.data === undefined || owner.data === undefined) {
      return { status: 'error' };
    }
    const eventType = eventTypes.data.find((item) => item.id === id);
    if (eventType === undefined || slots.response.status === 404) {
      return { status: 'not-found' };
    }
    if (slots.data === undefined) return { status: 'error' };
    return {
      status: 'ready',
      owner: owner.data,
      eventType,
      slots: slots.data,
      now: new Date(),
    };
  } catch {
    return { status: 'error' };
  }
}

export default function BookingPage() {
  const { id = '' } = useParams();
  return <BookingLoader key={id} id={id} />;
}

function BookingLoader({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void load(id).then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return <p role="status">Загрузка…</p>;
  }

  if (state.status === 'error') {
    return (
      <p role="alert" className="card">
        Не удалось загрузить расписание. Попробуйте обновить страницу.
      </p>
    );
  }

  if (state.status === 'not-found') {
    return (
      <section className="card">
        <h1>Не найдено</h1>
        <p>Такого типа события не существует.</p>
        <Link to="/book" className="button">
          К каталогу
        </Link>
      </section>
    );
  }

  return (
    <SlotPicker
      owner={state.owner}
      eventType={state.eventType}
      slots={state.slots}
      now={state.now}
    />
  );
}

interface SlotPickerProps {
  owner: Owner;
  eventType: EventType;
  slots: Slot[];
  now: Date;
}

function SlotPicker({ owner, eventType, slots, now }: SlotPickerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [pickedDate, setPickedDate] = useState<string | null>(
    params.get('date'),
  );
  const [pickedStart, setPickedStart] = useState<string | null>(null);

  const tz = owner.timeZone;
  const tzLabel = timeZoneLabel(tz, now);
  const today = todayIn(tz, now);
  const lastDay = addDays(today, HORIZON_DAYS - 1);
  const inHorizon = (date: string) => date >= today && date <= lastDay;

  const slotsByDate = new Map<string, Slot[]>();
  for (const slot of slots) {
    if (!inHorizon(slot.date)) continue;
    const list = slotsByDate.get(slot.date) ?? [];
    list.push(slot);
    slotsByDate.set(slot.date, list);
  }
  const freeCount = (date: string) =>
    (slotsByDate.get(date) ?? []).filter((s) => s.status === 'free').length;

  const horizonDates = Array.from({ length: HORIZON_DAYS }, (_, i) =>
    addDays(today, i),
  );
  const selectedDate =
    pickedDate !== null && inHorizon(pickedDate) && freeCount(pickedDate) > 0
      ? pickedDate
      : (horizonDates.find((d) => freeCount(d) > 0) ?? null);
  const daySlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];
  const selectedSlot =
    daySlots.find((s) => s.start === pickedStart && s.status === 'free') ??
    null;

  const weeks = weekGrid(today, lastDay);

  return (
    <section>
      <h1>Выбор времени</h1>
      {notice && (
        <p role="alert" className="card notice">
          {notice}
        </p>
      )}
      <div className="picker">
        <aside className="card summary" aria-label="Сводка">
          <h2>{eventType.title}</h2>
          <p className="muted">{eventType.durationMinutes} мин</p>
          <dl>
            <dt>Дата</dt>
            <dd>{selectedDate ? formatDateLong(selectedDate) : '—'}</dd>
            <dt>Время</dt>
            <dd>
              {selectedSlot
                ? `${formatTime(selectedSlot.start, tz)}–${formatTime(selectedSlot.end, tz)} · ${tzLabel}`
                : '—'}
            </dd>
          </dl>
        </aside>

        <div className="card">
          <h2>Выберите дату</h2>
          <div className="calendar">
            {WEEKDAYS.map((name) => (
              <div key={name} className="weekday" aria-hidden="true">
                {name}
              </div>
            ))}
            {weeks.flat().map((date, index) => {
              const day = Number(date.slice(8));
              const monthMark =
                index === 0 || day === 1 ? ` ${formatMonthShort(date)}` : '';
              if (!inHorizon(date)) {
                return (
                  <button
                    key={date}
                    type="button"
                    className="day outside"
                    disabled
                    aria-label={formatDateShort(date)}
                  >
                    <span>
                      {day}
                      {monthMark}
                    </span>
                  </button>
                );
              }
              const free = freeCount(date);
              return (
                <button
                  key={date}
                  type="button"
                  className={`day${date === selectedDate ? ' selected' : ''}`}
                  disabled={free === 0}
                  aria-pressed={date === selectedDate}
                  aria-label={`${formatDateShort(date)}, ${free} св.`}
                  onClick={() => {
                    setPickedDate(date);
                    setPickedStart(null);
                  }}
                >
                  <span>
                    {day}
                    {monthMark}
                  </span>
                  <small>{free} св.</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h2>Время</h2>
          <p className="muted">Часовой пояс: {tzLabel}</p>
          {selectedDate === null ? (
            <p>Нет свободных дат.</p>
          ) : (
            <ul className="slots">
              {daySlots.map((slot) => {
                const free = slot.status === 'free';
                const time = formatTime(slot.start, tz);
                return (
                  <li key={slot.start}>
                    <button
                      type="button"
                      className={`slot${slot.start === selectedSlot?.start ? ' selected' : ''}`}
                      disabled={!free}
                      aria-pressed={slot.start === selectedSlot?.start}
                      onClick={() => setPickedStart(slot.start)}
                    >
                      <span>{time}</span>
                      <small>{free ? 'Свободно' : 'Занято'}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="actions">
        <Link to="/book" className="button secondary">
          Назад
        </Link>
        <button
          type="button"
          className="button"
          disabled={selectedSlot === null}
          onClick={() => {
            if (selectedSlot === null) return;
            void navigate(
              `/book/${eventType.id}/form?start=${encodeURIComponent(selectedSlot.start)}`,
            );
          }}
        >
          Продолжить
        </button>
      </div>
    </section>
  );
}
