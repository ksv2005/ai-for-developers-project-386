import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { buildSlots, consultation, introCall, owner } from './test/fixtures';

type Routes = Record<string, () => Response | Promise<Response>>;

function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location">{pathname + search}</div>;
}

function renderApp(path: string, routes: Routes) {
  const fetchMock = vi.fn(async (request: Request) => {
    const handler = routes[new URL(request.url).pathname];
    return handler ? handler() : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <LocationProbe />
    </MemoryRouter>,
  );
  return fetchMock;
}

function routesWith(
  slots: ReturnType<typeof buildSlots>,
  ownerProfile = owner,
): Routes {
  return {
    '/api/owner': () => Response.json(ownerProfile),
    '/api/event-types': () => Response.json([introCall, consultation]),
    '/api/event-types/consultation/slots': () => Response.json(slots),
  };
}

// Сегодня (в Москве) — чт 15.10.2026; Горизонт — 15.10–28.10.
const moscowSlots = (isBusy?: (date: string, hhmm: string) => boolean) =>
  buildSlots({
    from: '2026-10-15',
    days: 14,
    durationMinutes: 60,
    utcOffsetHours: 3,
    isBusy,
  });

const dayButton = (name: RegExp | string) =>
  screen.getByRole('button', { name });

describe('slot picker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T06:00:00Z')); // 09:00 в Москве
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('loads data only through the three API endpoints', async () => {
    const fetchMock = renderApp(
      '/book/consultation',
      routesWith(moscowSlots()),
    );
    await screen.findByRole('heading', { name: 'Выбор времени' });

    expect(
      fetchMock.mock.calls
        .map(([request]) => new URL(request.url).pathname)
        .sort(),
    ).toEqual([
      '/api/event-types',
      '/api/event-types/consultation/slots',
      '/api/owner',
    ]);
  });

  it('shows a loading state, then the summary with the event type', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));

    expect(screen.getByRole('status').textContent).toBe('Загрузка…');
    const summary = await screen.findByRole('complementary', {
      name: 'Сводка',
    });
    expect(within(summary).getByText('Консультация')).toBeTruthy();
    expect(within(summary).getByText('60 мин')).toBeTruthy();
  });

  it('lays out whole Mon–Sun weeks covering the horizon with free counts', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    // 15.10 — четверг, 28.10 — среда: 12.10–01.11, три недели, 21 ячейка.
    expect(
      screen.getAllByRole('button', { name: /октября|ноября/ }),
    ).toHaveLength(21);
    // 9 часовых Слотов в день.
    expect(dayButton('15 октября, 9 св.')).toBeTruthy();
    expect(dayButton('28 октября, 9 св.')).toBeTruthy();
  });

  it('greys out and disables dates outside the horizon', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    for (const label of [
      '12 октября',
      '14 октября',
      '29 октября',
      '1 ноября',
    ]) {
      const button = dayButton(label) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      expect(button.className).toContain('outside');
      expect(button.textContent).not.toContain('св.');
    }
  });

  it('disables dates with no free slots and selects the first date with free ones', async () => {
    const slots = moscowSlots((date) => date <= '2026-10-16');
    renderApp('/book/consultation', routesWith(slots));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    expect((dayButton('15 октября, 0 св.') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((dayButton('16 октября, 0 св.') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(dayButton('17 октября, 9 св.').getAttribute('aria-pressed')).toBe(
      'true',
    );
    const summary = screen.getByRole('complementary', { name: 'Сводка' });
    expect(within(summary).getByText('суббота, 17 октября')).toBeTruthy();
  });

  it('shows slots of the selected date with statuses and blocks busy ones', async () => {
    const slots = moscowSlots(
      (date, hhmm) => date === '2026-10-15' && hhmm < '11:00',
    );
    renderApp('/book/consultation', routesWith(slots));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    expect(dayButton('15 октября, 7 св.').getAttribute('aria-pressed')).toBe(
      'true',
    );
    const busy = screen.getByRole('button', { name: /09:00\s*Занято/ });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    const free = screen.getByRole('button', { name: /11:00\s*Свободно/ });
    expect((free as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(busy);
    expect(
      (screen.getByRole('button', { name: 'Продолжить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('enables Continue only after picking a free slot and shows it in the summary with the zone', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });
    const next = () =>
      screen.getByRole('button', { name: 'Продолжить' }) as HTMLButtonElement;
    const summary = screen.getByRole('complementary', { name: 'Сводка' });

    expect(next().disabled).toBe(true);
    expect(within(summary).getAllByText('—')).toHaveLength(1);

    await userEvent.click(
      screen.getByRole('button', { name: /12:00\s*Свободно/ }),
    );

    expect(next().disabled).toBe(false);
    expect(
      within(summary).getByText('12:00–13:00 · Europe/Moscow (GMT+3)'),
    ).toBeTruthy();
    expect(
      screen.getByText(/Часовой пояс: Europe\/Moscow \(GMT\+3\)/),
    ).toBeTruthy();
  });

  it('resets the chosen slot when another date is picked', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    await userEvent.click(
      screen.getByRole('button', { name: /12:00\s*Свободно/ }),
    );
    await userEvent.click(dayButton('20 октября, 9 св.'));

    const summary = screen.getByRole('complementary', { name: 'Сводка' });
    expect(within(summary).getByText('вторник, 20 октября')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Продолжить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('goes back to the catalog', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    await userEvent.click(screen.getByRole('link', { name: 'Назад' }));

    expect(screen.getByTestId('location').textContent).toBe('/book');
  });

  it('continues to the form stub with the chosen slot', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots()));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    await userEvent.click(
      screen.getByRole('button', { name: /10:00\s*Свободно/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Продолжить' }));

    expect(
      screen.getByRole('heading', { name: 'Форма бронирования' }),
    ).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe(
      '/book/consultation/form?start=2026-10-15T07%3A00%3A00.000Z',
    );
  });

  it('shows times in the owner zone, not the browser zone', async () => {
    const tokyo = { name: 'Tota Rey', timeZone: 'Asia/Tokyo' };
    vi.setSystemTime(new Date('2026-10-15T00:30:00Z')); // 09:30 в Токио
    const slots = buildSlots({
      from: '2026-10-15',
      days: 14,
      durationMinutes: 60,
      utcOffsetHours: 9,
    });
    renderApp('/book/consultation', routesWith(slots, tokyo));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    expect(
      screen.getByRole('button', { name: /09:00\s*Свободно/ }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Часовой пояс: Asia\/Tokyo \(GMT\+9\)/),
    ).toBeTruthy();
  });

  describe('day boundary', () => {
    it('builds the grid and "today" in the owner zone near UTC midnight', async () => {
      // 18.10 21:30 UTC (вс) — в Москве уже пн 19.10 00:30.
      vi.setSystemTime(new Date('2026-10-18T21:30:00Z'));
      const slots = buildSlots({
        from: '2026-10-19',
        days: 14,
        durationMinutes: 60,
        utcOffsetHours: 3,
      });
      renderApp('/book/consultation', routesWith(slots));
      await screen.findByRole('heading', { name: 'Выбор времени' });

      // Горизонт 19.10–01.11 — ровно две недели; воскресенье 18.10 в сетку не входит.
      expect(
        screen.getAllByRole('button', { name: /октября|ноября/ }),
      ).toHaveLength(14);
      expect(screen.queryByRole('button', { name: /^18 октября/ })).toBeNull();
      expect(dayButton('19 октября, 9 св.').getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(dayButton('1 ноября, 9 св.')).toBeTruthy();
    });

    it('does not shift the grid when the owner zone is behind UTC', async () => {
      // 19.10 01:30 UTC (пн) — в Нью-Йорке ещё вс 18.10 21:30 (EDT, UTC−4).
      vi.setSystemTime(new Date('2026-10-19T01:30:00Z'));
      const slots = buildSlots({
        from: '2026-10-18',
        days: 14,
        durationMinutes: 60,
        utcOffsetHours: -4,
      });
      renderApp(
        '/book/consultation',
        routesWith(slots, { name: 'Tota Rey', timeZone: 'America/New_York' }),
      );
      await screen.findByRole('heading', { name: 'Выбор времени' });

      // Горизонт 18.10 (вс) – 31.10 (сб): три недели, пн 12.10 – вс 01.11.
      expect(
        screen.getAllByRole('button', { name: /октября|ноября/ }),
      ).toHaveLength(21);
      expect(dayButton('18 октября, 9 св.').getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(
        (dayButton('19 октября, 9 св.') as HTMLButtonElement).disabled,
      ).toBe(false);
      expect((dayButton('1 ноября') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it('shows "not found" for an unknown event type', async () => {
    renderApp('/book/missing', routesWith(moscowSlots()));

    expect(
      await screen.findByRole('heading', { name: 'Не найдено' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Продолжить' })).toBeNull();
  });

  it('shows "not found" when the slots endpoint answers 404', async () => {
    renderApp('/book/consultation', {
      ...routesWith(moscowSlots()),
      '/api/event-types/consultation/slots': () =>
        Response.json({ statusCode: 404 }, { status: 404 }),
    });

    expect(
      await screen.findByRole('heading', { name: 'Не найдено' }),
    ).toBeTruthy();
  });

  it('shows an error state when the server fails', async () => {
    renderApp('/book/consultation', {
      ...routesWith(moscowSlots()),
      '/api/event-types/consultation/slots': () =>
        Response.json({ statusCode: 500 }, { status: 500 }),
    });

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Не удалось загрузить',
    );
  });

  it('shows an error state when the network fails', async () => {
    renderApp('/book/consultation', {
      ...routesWith(moscowSlots()),
      '/api/owner': () => Promise.reject(new TypeError('offline')),
    });

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('handles a horizon without any free dates', async () => {
    renderApp('/book/consultation', routesWith(moscowSlots(() => true)));
    await screen.findByRole('heading', { name: 'Выбор времени' });

    expect(screen.getByText('Нет свободных дат.')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Продолжить' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
