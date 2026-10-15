import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { components } from 'api-client';
import App from './App';
import {
  consultationBooking,
  deletedTypeBooking,
  introBooking,
  owner,
} from './test/fixtures';

type Booking = components['schemas']['Booking'];

function renderAdmin(bookings: Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (pathname === '/api/owner') return Response.json(owner);
      if (pathname === '/api/event-types') return Response.json([]);
      if (pathname === '/api/admin/bookings') return bookings;
      return new Response(null, { status: 404 });
    }),
  );
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>,
  );
}

const ok = (bookings: Booking[]) => Response.json(bookings);
const section = () =>
  screen.findByRole('region', { name: 'Предстоящие встречи' });
const text = (element: HTMLElement | undefined) => element?.textContent ?? '';

describe('admin upcoming bookings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T06:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lists bookings of different types in server order with all fields', async () => {
    renderAdmin(ok([consultationBooking, introBooking]));
    const region = await section();
    const items = await within(region).findAllByRole('listitem');

    expect(items.length).toBe(2);
    const first = text(items[0]);
    expect(first).toContain('Консультация · 60 мин');
    expect(first).toContain('четверг, 15 октября, 10:00–11:00');
    expect(first).toContain('Europe/Moscow (GMT+3)');
    expect(first).toContain('Анна Гость');
    expect(first).toContain('anna@example.com');
    expect(first).toContain('Хочу обсудить проект');

    const second = text(items[1]);
    expect(second).toContain('Знакомство · 15 мин');
    expect(second).toContain('пятница, 16 октября, 11:30–11:45');
    expect(second).toContain('boris@example.com');
  });

  it('shows a booking of a deleted type by its snapshot', async () => {
    renderAdmin(ok([deletedTypeBooking]));
    const [item] = await within(await section()).findAllByRole('listitem');

    expect(text(item)).toContain('Воркшоп (удалён) · 90 мин');
    expect(text(item)).toContain('суббота, 17 октября, 15:00–16:30');
    expect(text(item)).toContain('Приду с командой');
  });

  it('says there are no upcoming meetings', async () => {
    renderAdmin(ok([]));
    expect(
      await within(await section()).findByText('Предстоящих встреч нет'),
    ).toBeTruthy();
  });

  it('shows a load error', async () => {
    renderAdmin(new Response(null, { status: 500 }));
    expect(text(await within(await section()).findByRole('alert'))).toContain(
      'Не удалось загрузить встречи',
    );
  });
});
