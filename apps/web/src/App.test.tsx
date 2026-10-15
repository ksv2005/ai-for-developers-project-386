import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { consultation, introCall, owner } from './test/fixtures';

type Routes = Record<string, () => Response | Promise<Response>>;

const catalogRoutes: Routes = {
  '/api/owner': () => Response.json(owner),
  '/api/event-types': () => Response.json([introCall, consultation]),
};

function renderApp(path = '/', routes: Routes = catalogRoutes) {
  const fetchMock = vi.fn(async (request: Request) => {
    const handler = routes[new URL(request.url).pathname];
    return handler ? handler() : new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
  return fetchMock;
}

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T09:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the home page copy from the spec', () => {
    renderApp();

    expect(screen.getByText('БЫСТРАЯ ЗАПИСЬ НА ЗВОНОК')).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Calendar' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Забронируйте встречу за минуту: выберите тип события и удобное время.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Записаться →' })).toBeTruthy();

    const features = screen.getByRole('complementary');
    expect(
      within(features).getByRole('heading', { name: 'Возможности' }),
    ).toBeTruthy();
    expect(
      within(features)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      'Выбор типа события и удобного времени для встречи.',
      'Быстрое бронирование с подтверждением и дополнительными заметками.',
      'Управление типами встреч и просмотр предстоящих записей в админке.',
    ]);
  });

  it('opens the booking page from the home call to action', async () => {
    renderApp();

    await userEvent.click(screen.getByRole('link', { name: 'Записаться →' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Записаться' }),
    ).toBeTruthy();
  });

  it('keeps the header navigation on every page', async () => {
    renderApp();
    const nav = () =>
      screen.getByRole('navigation', { name: 'Основная навигация' });

    await userEvent.click(within(nav()).getByRole('link', { name: 'Админка' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Админка' }),
    ).toBeTruthy();
    expect(
      within(nav()).getByRole('link', { name: 'Записаться' }),
    ).toBeTruthy();

    await userEvent.click(
      within(nav()).getByRole('link', { name: 'Записаться' }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Записаться' }),
    ).toBeTruthy();
    expect(within(nav()).getByRole('link', { name: 'Админка' })).toBeTruthy();
  });

  it('shows the header on an unknown route', () => {
    renderApp('/nowhere');

    expect(
      screen.getByRole('heading', { name: 'Страница не найдена' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('navigation', { name: 'Основная навигация' }),
    ).toBeTruthy();
  });

  it('does not call the API from the skeleton pages', () => {
    const fetchMock = renderApp();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('catalog', () => {
    it('shows a loading state until the data arrives', async () => {
      renderApp('/book');

      expect(screen.getByRole('status').textContent).toBe('Загрузка…');
      expect(await screen.findByText('Знакомство')).toBeTruthy();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows the owner profile above the event type cards', async () => {
      renderApp('/book');

      expect(await screen.findByText('Tota Rey')).toBeTruthy();
      expect(screen.getByText('TR')).toBeTruthy();
      expect(screen.getByText('Host')).toBeTruthy();
    });

    it('shows a card with title, description and duration per event type', async () => {
      renderApp('/book');

      const card = await screen.findByRole('link', { name: /Консультация/ });
      expect(within(card).getByText('Разбор вашей задачи')).toBeTruthy();
      expect(within(card).getByText('60 мин')).toBeTruthy();
      expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('opens the time selection for the clicked event type', async () => {
      renderApp('/book');

      await userEvent.click(
        await screen.findByRole('link', { name: /Знакомство/ }),
      );

      expect(
        screen.getByRole('heading', { level: 1, name: 'Выбор времени' }),
      ).toBeTruthy();
    });

    it('shows an empty state when there are no event types', async () => {
      renderApp('/book', {
        ...catalogRoutes,
        '/api/event-types': () => Response.json([]),
      });

      expect(
        await screen.findByText('Нет доступных типов событий.'),
      ).toBeTruthy();
      expect(screen.getByText('Tota Rey')).toBeTruthy();
      expect(screen.queryByRole('link', { name: /\d+ мин/ })).toBeNull();
    });

    it('shows an error state when the server fails', async () => {
      renderApp('/book', {
        ...catalogRoutes,
        '/api/event-types': () =>
          Response.json(
            { statusCode: 500, error: 'Internal Server Error', message: 'x' },
            { status: 500 },
          ),
      });

      expect((await screen.findByRole('alert')).textContent).toContain(
        'Не удалось загрузить',
      );
      expect(screen.queryByText('Tota Rey')).toBeNull();
    });

    it('shows an error state when the network fails', async () => {
      renderApp('/book', {
        ...catalogRoutes,
        '/api/owner': () => Promise.reject(new TypeError('offline')),
      });

      expect(await screen.findByRole('alert')).toBeTruthy();
    });

    it('requests only the owner and the event types', async () => {
      const fetchMock = renderApp('/book');
      await screen.findByText('Знакомство');

      expect(
        fetchMock.mock.calls
          .map(([request]) => new URL(request.url).pathname)
          .sort(),
      ).toEqual(['/api/event-types', '/api/owner']);
    });
  });
});
