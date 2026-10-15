import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';

interface Owner {
  name: string;
  timeZone: string;
}

interface Slot {
  date: string;
  start: string;
  status: 'free' | 'busy';
}

interface Booking {
  start: string;
}

const uniqueId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

async function createEventType(
  request: APIRequestContext,
  id: string,
  title: string,
  durationMinutes: number,
) {
  const response = await request.post('/api/event-types', {
    data: { id, title, description: `Описание ${title}`, durationMinutes },
  });
  expect(response.status()).toBe(201);
}

async function freeSlots(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/event-types/${id}/slots`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as Slot[]).filter(
    (slot) => slot.status === 'free',
  );
}

async function getOwner(request: APIRequestContext) {
  return (await (await request.get('/api/owner')).json()) as Owner;
}

const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('ru', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

const formatDateShort = (date: string) =>
  new Intl.DateTimeFormat('ru', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T00:00:00Z`));

test('гость бронирует звонок, встреча видна в админке', async ({
  page,
  request,
}) => {
  const id = uniqueId('e2e-flow');
  const title = `Звонок ${id}`;
  await createEventType(request, id, title, 30);

  const guestName = `Гость ${id}`;
  const guestEmail = `${id}@example.com`;
  const note = `Заметка ${id}`;

  await page.goto('/');
  await page
    .getByRole('link', { name: /Записаться/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Записаться' })).toBeVisible();

  await page.getByRole('link', { name: new RegExp(title) }).click();
  await expect(
    page.getByRole('heading', { name: 'Выбор времени' }),
  ).toBeVisible();

  // Календарь сам выбирает первую дату со свободными Слотами.
  await page
    .getByRole('button', { name: /Свободно/ })
    .first()
    .click();
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(
    page.getByRole('heading', { name: 'Ваши данные' }),
  ).toBeVisible();
  await page.getByLabel('Имя').fill(guestName);
  await page.getByLabel('Email').fill(guestEmail);
  await page.getByLabel('Заметка').fill(note);
  await page.getByRole('button', { name: 'Забронировать' }).click();

  await expect(
    page.getByRole('heading', { name: 'Бронирование подтверждено' }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/book/${id}/done$`));
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('30 мин')).toBeVisible();
  await expect(page.getByText(guestName)).toBeVisible();
  await expect(page.getByText(guestEmail)).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();

  await page.getByRole('link', { name: 'Админка' }).click();
  const upcoming = page.getByRole('region', { name: 'Предстоящие встречи' });
  const item = upcoming.getByRole('listitem').filter({ hasText: title });
  await expect(item).toBeVisible();
  await expect(item).toContainText(guestName);
  await expect(item).toContainText(guestEmail);
  await expect(item).toContainText(note);
});

test('занятое время нельзя забронировать ни тем же, ни другим Типом', async ({
  page,
  request,
}) => {
  const idA = uniqueId('e2e-a');
  const idB = uniqueId('e2e-b');
  await createEventType(request, idA, `Длинный ${idA}`, 60);
  await createEventType(request, idB, `Короткий ${idB}`, 30);
  const owner = await getOwner(request);

  // Берём Слот, после которого в тот же день остаётся ещё свободный Слот Типа A:
  // тогда у Типа B в этот день точно найдутся свободные Слоты.
  const slotsA = await freeSlots(request, idA);
  const slot = slotsA.find((candidate) =>
    slotsA.some(
      (other) => other.date === candidate.date && other.start > candidate.start,
    ),
  );
  if (!slot) throw new Error('Нет подходящего свободного Слота');

  const book = (eventTypeId: string, guest: string) =>
    request.post('/api/bookings', {
      data: {
        eventTypeId,
        start: slot.start,
        guestName: guest,
        guestEmail: `${guest}@example.com`,
      },
    });

  const first = await book(idA, 'first');
  expect(first.status()).toBe(201);
  expect(((await first.json()) as Booking).start).toBe(slot.start);

  expect((await book(idA, 'same-type')).status()).toBe(409);
  expect((await book(idB, 'other-type')).status()).toBe(409);

  await page.goto(`/book/${idB}`);
  await page
    .getByRole('button', {
      name: new RegExp(`^${formatDateShort(slot.date)}, `),
    })
    .click();
  await expectBusy(page, formatTime(slot.start, owner.timeZone));
});

async function expectBusy(page: Page, time: string) {
  const busy = page.getByRole('button', { name: `${time} Занято` });
  await expect(busy).toBeVisible();
  await expect(busy).toBeDisabled();
}
