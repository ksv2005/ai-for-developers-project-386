import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

function renderApp(path = '/') {
  const fetchMock = vi.fn(async () => Response.json({}));
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
      screen.getByRole('heading', { level: 1, name: 'Записаться' }),
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
      screen.getByRole('heading', { level: 1, name: 'Записаться' }),
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
});
