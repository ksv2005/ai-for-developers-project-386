import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { components } from 'api-client';
import App from './App';
import { consultation, introCall, owner } from './test/fixtures';

type EventType = components['schemas']['EventType'];
/** Тела запросов: сам Request к моменту проверки уже прочитан. */
const bodies = new WeakMap<Request, unknown>();

type Handler = (request: Request) => Response | Promise<Response>;

/** Подменённый API: хранит Типы в памяти, поведение можно переопределить. */
function renderAdmin(
  initial: EventType[] = [introCall, consultation],
  overrides: Record<string, Handler> = {},
) {
  let items = [...initial];
  const routes: Record<string, Handler> = {
    'GET /api/owner': () => Response.json(owner),
    'GET /api/event-types': () => Response.json(items),
    'POST /api/event-types': async (request) => {
      const body = (await request.json()) as EventType;
      items = [...items, body];
      return Response.json(body, { status: 201 });
    },
    ...overrides,
  };
  const fetchMock = vi.fn(async (request: Request) => {
    if (request.body) bodies.set(request, await request.clone().json());
    const { pathname } = new URL(request.url);
    const exact = routes[`${request.method} ${pathname}`];
    if (exact) return exact(request);
    const id = pathname.split('/').pop();
    if (pathname.startsWith('/api/event-types/') && id) {
      const key = `${request.method} /api/event-types/${id}`;
      if (routes[key]) return routes[key](request);
      if (request.method === 'PUT') {
        const body = (await request.json()) as Partial<EventType>;
        items = items.map((item) =>
          item.id === id ? { ...item, ...body } : item,
        );
        return Response.json(items.find((item) => item.id === id));
      }
      if (request.method === 'DELETE') {
        items = items.filter((item) => item.id !== id);
        return new Response(null, { status: 204 });
      }
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <App />
    </MemoryRouter>,
  );
  return fetchMock;
}

const text = (element: HTMLElement | undefined) => element?.textContent ?? '';
const input = (label: string) =>
  screen.getByLabelText(label) as HTMLInputElement;
const described = (label: string) => {
  const id = input(label).getAttribute('aria-describedby');
  return id ? (document.getElementById(id)?.textContent ?? '') : '';
};

const apiError = (status: number, message = '') =>
  Response.json({ statusCode: status, error: '', message }, { status });

const calls = (fetchMock: ReturnType<typeof renderAdmin>, method: string) =>
  fetchMock.mock.calls
    .map(([request]) => request)
    .filter((request) => request.method === method);

async function fillNew(id: string, title: string, minutes: string) {
  await userEvent.click(
    await screen.findByRole('button', { name: 'Создать тип' }),
  );
  await userEvent.type(screen.getByLabelText('Id'), id);
  await userEvent.type(screen.getByLabelText('Название'), title);
  await userEvent.type(screen.getByLabelText('Описание'), 'Описание типа');
  await userEvent.type(screen.getByLabelText('Длительность, мин'), minutes);
}

const save = () =>
  userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

describe('admin event types', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T06:00:00Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the owner name and the list of types', async () => {
    renderAdmin();
    expect(text(await screen.findByLabelText('Владелец'))).toBe('Tota Rey');
    const items = await screen.findAllByRole('listitem');
    expect(items.length).toBe(2);
    expect(text(items[0])).toContain('Знакомство');
    expect(text(items[0])).toContain('intro');
    expect(text(items[0])).toContain('Короткий звонок, чтобы познакомиться');
    expect(text(items[0])).toContain('15 мин');
  });

  it('creates a type and refreshes the list', async () => {
    const fetchMock = renderAdmin([introCall]);
    await fillNew('deep-dive', 'Глубокий разбор', '90');
    await save();

    expect(await screen.findByText('Глубокий разбор')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
    expect(bodies.get(calls(fetchMock, 'POST')[0]!)).toEqual({
      id: 'deep-dive',
      title: 'Глубокий разбор',
      description: 'Описание типа',
      durationMinutes: 90,
    });
  });

  it('reports a taken id at the id field on 409', async () => {
    renderAdmin([introCall], {
      'POST /api/event-types': () => apiError(409, 'exists'),
    });
    await fillNew('intro', 'Дубль', '30');
    await save();

    expect(described('Id')).toBe('Этот id уже занят');
    expect(input('Id').getAttribute('aria-invalid')).toBe('true');
    expect(input('Название').value).toBe('Дубль');
  });

  it('puts a 400 on the offending field, or a generic text', async () => {
    let message = 'body/durationMinutes must be >= 5';
    renderAdmin([], {
      'POST /api/event-types': () => apiError(400, message),
    });
    await fillNew('x', 'Тип', '1');
    await save();
    expect(described('Длительность, мин')).toBe(
      'Длительность — от 5 до 540 минут',
    );

    message = 'something odd';
    await save();
    expect(text(await screen.findByRole('alert'))).toBe(
      'Проверьте введённые данные.',
    );
  });

  it('edits a type without changing its id', async () => {
    const fetchMock = renderAdmin();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Изменить Консультация' }),
    );
    expect(input('Id').value).toBe('consultation');
    expect(input('Id').readOnly).toBe(true);

    const title = screen.getByLabelText('Название');
    await userEvent.clear(title);
    await userEvent.type(title, 'Большая консультация');
    await save();

    expect(await screen.findByText('Большая консультация')).toBeTruthy();
    const [put] = calls(fetchMock, 'PUT');
    expect(new URL(put!.url).pathname).toBe('/api/event-types/consultation');
    expect(bodies.get(put!)).toEqual({
      title: 'Большая консультация',
      description: 'Разбор вашей задачи',
      durationMinutes: 60,
    });
  });

  it('says "Тип не найден" and reloads on 404 while editing', async () => {
    const fetchMock = renderAdmin([introCall, consultation], {
      'PUT /api/event-types/intro': () => apiError(404, 'gone'),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Изменить Знакомство' }),
    );
    const before = calls(fetchMock, 'GET').length;
    await save();

    expect(text(await screen.findByRole('alert'))).toBe('Тип не найден');
    expect(calls(fetchMock, 'GET').length).toBeGreaterThan(before);
  });

  it('deletes only after confirmation', async () => {
    const fetchMock = renderAdmin();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Удалить Знакомство' }),
    );
    const dialog = screen.getByRole('alertdialog');
    expect(calls(fetchMock, 'DELETE').length).toBe(0);

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Отмена' }),
    );
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(calls(fetchMock, 'DELETE').length).toBe(0);
    expect(screen.getByText('Знакомство')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Удалить Знакомство' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Подтвердить удаление' }),
    );

    await vi.waitFor(() => expect(screen.queryByText('Знакомство')).toBeNull());
    expect(calls(fetchMock, 'DELETE').length).toBe(1);
    expect(screen.getByText('Консультация')).toBeTruthy();
  });

  it('says "Тип не найден" and reloads on 404 while deleting', async () => {
    renderAdmin([introCall], {
      'DELETE /api/event-types/intro': () => apiError(404, 'gone'),
    });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Удалить Знакомство' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Подтвердить удаление' }),
    );
    expect(text(await screen.findByRole('alert'))).toBe('Тип не найден');
  });
});
