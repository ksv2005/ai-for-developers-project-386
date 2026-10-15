import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import {
  buildSlots,
  consultation,
  consultationBooking,
  introCall,
  owner,
} from './test/fixtures';

const START = '2026-10-15T07:00:00.000Z'; // 10:00 в Москве

// Сегодня (в Москве) — чт 15.10.2026; Горизонт — 15.10–28.10.
const slots = (isBusy?: (date: string, hhmm: string) => boolean) =>
  buildSlots({
    from: '2026-10-15',
    days: 14,
    durationMinutes: 60,
    utcOffsetHours: 3,
    isBusy,
  });

type Handler = (request: Request) => Response | Promise<Response>;

function renderApp(path: string, overrides: Record<string, Handler> = {}) {
  const routes: Record<string, Handler> = {
    '/api/owner': () => Response.json(owner),
    '/api/event-types': () => Response.json([introCall, consultation]),
    '/api/event-types/consultation/slots': () => Response.json(slots()),
    ...overrides,
  };
  const fetchMock = vi.fn(async (request: Request) => {
    const handler = routes[new URL(request.url).pathname];
    return handler ? handler(request) : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return fetchMock;
}

const formPath = `/book/consultation/form?start=${encodeURIComponent(START)}`;

async function fillForm(
  name = 'Анна Гость',
  email = 'anna@example.com',
  note = '',
) {
  await userEvent.type(await screen.findByLabelText('Имя'), name);
  await userEvent.type(screen.getByLabelText('Email'), email);
  if (note) await userEvent.type(screen.getByLabelText(/Заметка/), note);
}

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: 'Забронировать' }));

const error = (status: number, message = '') =>
  Response.json({ statusCode: status, error: '', message }, { status });

describe('booking form', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T06:00:00Z')); // 09:00 в Москве
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the summary in the owner zone above the form', async () => {
    renderApp(formPath);

    const summary = await screen.findByRole('complementary', {
      name: 'Сводка',
    });
    expect(within(summary).getByText('Консультация')).toBeTruthy();
    expect(within(summary).getByText('60 мин')).toBeTruthy();
    expect(within(summary).getByText('четверг, 15 октября')).toBeTruthy();
    expect(
      within(summary).getByText('10:00 · Europe/Moscow (GMT+3)'),
    ).toBeTruthy();
  });

  it('books a slot through the SDK and shows the server snapshot', async () => {
    const fetchMock = renderApp(formPath, {
      '/api/bookings': () =>
        Response.json(consultationBooking, { status: 201 }),
    });
    await fillForm('Анна Гость', 'anna@example.com', 'Хочу обсудить проект');
    await submit();

    expect(
      await screen.findByRole('heading', { name: 'Бронирование подтверждено' }),
    ).toBeTruthy();
    for (const text of [
      'Консультация',
      '60 мин',
      'четверг, 15 октября',
      '10:00–11:00 · Europe/Moscow (GMT+3)',
      'Анна Гость',
      'anna@example.com',
      'Хочу обсудить проект',
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }

    const post = fetchMock.mock.calls
      .map(([request]) => request)
      .find((request) => request.method === 'POST');
    expect(new URL(post!.url).pathname).toBe('/api/bookings');
    expect(await post!.json()).toEqual({
      eventTypeId: 'consultation',
      start: START,
      guestName: 'Анна Гость',
      guestEmail: 'anna@example.com',
      note: 'Хочу обсудить проект',
    });

    await userEvent.click(screen.getByRole('link', { name: 'Записаться ещё' }));
    expect(
      await screen.findByRole('heading', { name: 'Записаться' }),
    ).toBeTruthy();
  });

  it('returns to the picker on 409 with reloaded slots and the same date', async () => {
    let slotCalls = 0;
    renderApp('/book/consultation?date=2026-10-17', {
      '/api/event-types/consultation/slots': () => {
        slotCalls += 1;
        // После конфликта 10:00 в субботу 17.10 занято.
        return Response.json(
          slots(
            (date, hhmm) =>
              slotCalls > 1 && date === '2026-10-17' && hhmm === '10:00',
          ),
        );
      },
      '/api/bookings': () => error(409, 'Slot is already booked'),
    });

    await userEvent.click(
      await screen.findByRole('button', { name: /10:00\s*Свободно/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await fillForm();
    await submit();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Это время уже занято',
    );
    expect(screen.getByRole('heading', { name: 'Выбор времени' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '17 октября, 8 св.' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('button', { name: /10:00\s*Занято/ })).toBeTruthy();
  });

  it('returns to the picker on 422 with a clear message', async () => {
    renderApp(formPath, {
      '/api/bookings': () =>
        error(422, 'Start must be the beginning of a slot'),
    });
    await fillForm();
    await submit();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'стал недоступен',
    );
    expect(screen.getByRole('heading', { name: 'Выбор времени' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: '15 октября, 9 св.' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('shows a server validation error next to the field on 400', async () => {
    renderApp(formPath, {
      '/api/bookings': () =>
        error(400, 'body/guestEmail must match format "email"'),
    });
    await fillForm('Анна Гость', 'not-an-email');
    await submit();

    const email = screen.getByLabelText('Email');
    await vi.waitFor(() =>
      expect(email.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(screen.getByText('Укажите корректный email')).toBeTruthy();
    expect(
      screen.getByLabelText('Имя').getAttribute('aria-invalid'),
    ).toBeNull();
    // Остаёмся на форме с введёнными данными.
    expect((screen.getByLabelText('Имя') as HTMLInputElement).value).toBe(
      'Анна Гость',
    );
  });

  it('shows "not found" when the booking answers 404', async () => {
    renderApp(formPath, { '/api/bookings': () => error(404) });
    await fillForm();
    await submit();

    expect(
      await screen.findByRole('heading', { name: 'Не найдено' }),
    ).toBeTruthy();
  });

  it('shows "not found" for an unknown event type', async () => {
    renderApp(`/book/missing/form?start=${encodeURIComponent(START)}`);

    expect(
      await screen.findByRole('heading', { name: 'Не найдено' }),
    ).toBeTruthy();
  });

  it('goes back to the picker keeping the chosen date', async () => {
    renderApp('/book/consultation');

    await userEvent.click(
      await screen.findByRole('button', { name: '17 октября, 9 св.' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /10:00\s*Свободно/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    await userEvent.click(await screen.findByRole('link', { name: 'Назад' }));

    expect(
      (
        await screen.findByRole('button', { name: '17 октября, 9 св.' })
      ).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('asks to pick a time when start is missing', async () => {
    renderApp('/book/consultation/form');

    expect(
      await screen.findByRole('heading', { name: 'Время не выбрано' }),
    ).toBeTruthy();
  });
});
