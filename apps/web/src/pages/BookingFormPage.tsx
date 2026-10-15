import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import type { components } from 'api-client';
import { api } from '../api';
import { fieldOf } from '../lib/fieldErrors';
import {
  formatDateLong,
  formatTime,
  timeZoneLabel,
  todayIn,
} from '../lib/time';

type Owner = components['schemas']['Owner'];
type EventType = components['schemas']['EventType'];
type Booking = components['schemas']['Booking'];

type FieldErrors = Partial<Record<Field, string>>;

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; owner: Owner; eventType: EventType };

async function load(id: string): Promise<State> {
  try {
    const [owner, eventTypes] = await Promise.all([
      api.GET('/api/owner'),
      api.GET('/api/event-types'),
    ]);
    if (owner.data === undefined || eventTypes.data === undefined) {
      return { status: 'error' };
    }
    const eventType = eventTypes.data.find((item) => item.id === id);
    if (eventType === undefined) return { status: 'not-found' };
    return { status: 'ready', owner: owner.data, eventType };
  } catch {
    return { status: 'error' };
  }
}

function EventTypeNotFound() {
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

const FIELDS = ['guestName', 'guestEmail', 'note'] as const;
type Field = (typeof FIELDS)[number];

const FIELD_MESSAGES: Record<Field, string> = {
  guestName: 'Укажите имя',
  guestEmail: 'Укажите корректный email',
  note: 'Заметка не принята сервером',
};

export default function BookingFormPage() {
  const { id = '' } = useParams();
  return <BookingFormLoader key={id} id={id} />;
}

function BookingFormLoader({ id }: { id: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [params] = useSearchParams();
  const start = params.get('start') ?? '';

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
        Не удалось загрузить данные. Попробуйте обновить страницу.
      </p>
    );
  }
  if (state.status === 'not-found') return <EventTypeNotFound />;

  if (Number.isNaN(Date.parse(start))) {
    return (
      <section className="card">
        <h1>Время не выбрано</h1>
        <p>Сначала выберите время звонка.</p>
        <Link to={`/book/${id}`} className="button">
          Выбрать время
        </Link>
      </section>
    );
  }

  return (
    <BookingForm
      owner={state.owner}
      eventType={state.eventType}
      start={start}
    />
  );
}

interface BookingFormProps {
  owner: Owner;
  eventType: EventType;
  start: string;
}

function BookingForm({ owner, eventType, start }: BookingFormProps) {
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [notFound, setNotFound] = useState(false);

  const tz = owner.timeZone;
  const startDate = new Date(start);
  const date = todayIn(tz, startDate);
  const tzLabel = timeZoneLabel(tz, startDate);
  const backToPicker = `/book/${eventType.id}?date=${date}`;

  if (notFound) return <EventTypeNotFound />;

  if (booking !== null) {
    return <Confirmation booking={booking} owner={owner} />;
  }

  const returnToPicker = (notice: string) =>
    navigate(backToPicker, { state: { notice } });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setPending(true);
    try {
      const result = await api.POST('/api/bookings', {
        body: {
          eventTypeId: eventType.id,
          start,
          guestName,
          guestEmail,
          note,
        },
      });
      const { data, error, response } = result;
      if (data !== undefined) {
        setBooking(data);
      } else if (response.status === 400) {
        const field = fieldOf(error?.message ?? '', FIELDS);
        if (field) setErrors({ [field]: FIELD_MESSAGES[field] });
        else setFormError('Проверьте введённые данные.');
      } else if (response.status === 404) {
        setNotFound(true);
      } else if (response.status === 409) {
        void returnToPicker('Это время уже занято. Выберите другое.');
      } else if (response.status === 422) {
        void returnToPicker(
          'Этот слот стал недоступен. Выберите другое время.',
        );
      } else {
        setFormError('Не удалось создать бронирование. Попробуйте ещё раз.');
      }
    } catch {
      setFormError('Не удалось создать бронирование. Попробуйте ещё раз.');
    } finally {
      setPending(false);
    }
  }

  const fieldProps = (field: Field) => ({
    id: field,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${field}-error` : undefined,
  });
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <section>
      <h1>Ваши данные</h1>
      <aside className="card summary" aria-label="Сводка">
        <h2>{eventType.title}</h2>
        <p className="muted">{eventType.durationMinutes} мин</p>
        <dl>
          <dt>Дата</dt>
          <dd>{formatDateLong(date)}</dd>
          <dt>Время</dt>
          <dd>{`${formatTime(start, tz)} · ${tzLabel}`}</dd>
        </dl>
      </aside>

      <form className="card form" noValidate onSubmit={(e) => void submit(e)}>
        <label htmlFor="guestName">Имя</label>
        <input
          {...fieldProps('guestName')}
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          autoComplete="name"
        />
        {fieldError('guestName')}

        <label htmlFor="guestEmail">Email</label>
        <input
          {...fieldProps('guestEmail')}
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          autoComplete="email"
        />
        {fieldError('guestEmail')}

        <label htmlFor="note">Заметка (необязательно)</label>
        <textarea
          {...fieldProps('note')}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {fieldError('note')}

        {formError && <p role="alert">{formError}</p>}

        <div className="actions">
          <Link to={backToPicker} className="button secondary">
            Назад
          </Link>
          <button type="submit" className="button" disabled={pending}>
            Забронировать
          </button>
        </div>
      </form>
    </section>
  );
}

function Confirmation({ booking, owner }: { booking: Booking; owner: Owner }) {
  const tz = owner.timeZone;
  const start = new Date(booking.start);
  return (
    <section className="card">
      <h1>Бронирование подтверждено</h1>
      <h2>{booking.eventTitle}</h2>
      <p className="muted">{booking.durationMinutes} мин</p>
      <dl>
        <dt>Дата</dt>
        <dd>{formatDateLong(todayIn(tz, start))}</dd>
        <dt>Время</dt>
        <dd>
          {`${formatTime(booking.start, tz)}–${formatTime(booking.end, tz)} · ${timeZoneLabel(tz, start)}`}
        </dd>
        <dt>Имя</dt>
        <dd>{booking.guestName}</dd>
        <dt>Email</dt>
        <dd>{booking.guestEmail}</dd>
        {booking.note !== '' && (
          <>
            <dt>Заметка</dt>
            <dd>{booking.note}</dd>
          </>
        )}
      </dl>
      <Link to="/book" className="button">
        Записаться ещё
      </Link>
    </section>
  );
}
