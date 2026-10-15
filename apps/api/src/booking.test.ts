import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const NOW = new Date('2026-10-15T08:00:00Z');

describe('booking API', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp({ ownerTz: 'UTC', now: () => NOW });
  });

  afterEach(async () => {
    await app.close();
  });

  let nextId = 0;

  async function createType(body: object = {}) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/event-types',
      payload: {
        id: `type-${++nextId}`,
        title: 'Intro',
        durationMinutes: 30,
        ...body,
      },
    });
    return response.json<{ id: string }>();
  }

  function book(payload: object) {
    return app.inject({ method: 'POST', url: '/api/bookings', payload });
  }

  const guest = { guestName: 'Ann', guestEmail: 'ann@example.com' };

  describe('event types', () => {
    it('creates, lists, updates and deletes event types', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/api/event-types',
        payload: {
          id: 'intro',
          title: 'Intro',
          description: 'Hi',
          durationMinutes: 15,
        },
      });
      expect(created.statusCode).toBe(201);
      const { id } = created.json<{ id: string }>();
      expect(id).toBe('intro');

      const updated = await app.inject({
        method: 'PUT',
        url: `/api/event-types/${id}`,
        payload: { title: 'Deep dive', durationMinutes: 60 },
      });
      expect(updated.statusCode).toBe(200);

      const list = await app.inject({ method: 'GET', url: '/api/event-types' });
      expect(list.json()).toEqual([
        { id, title: 'Deep dive', description: '', durationMinutes: 60 },
      ]);

      const removed = await app.inject({
        method: 'DELETE',
        url: `/api/event-types/${id}`,
      });
      expect(removed.statusCode).toBe(204);
      expect(
        (await app.inject({ method: 'GET', url: '/api/event-types' })).json(),
      ).toEqual([]);
    });

    it.each([
      { id: 'a', title: '', durationMinutes: 30 },
      { id: 'a', title: 'x'.repeat(101), durationMinutes: 30 },
      { id: 'a', title: 'Intro', durationMinutes: 4 },
      { id: 'a', title: 'Intro', durationMinutes: 541 },
      { id: 'a', title: 'Intro', durationMinutes: 1.5 },
      { id: 'a', durationMinutes: 30 },
      { title: 'Intro', durationMinutes: 30 },
      { id: '', title: 'Intro', durationMinutes: 30 },
      { id: 'Intro', title: 'Intro', durationMinutes: 30 },
      { id: 'a b', title: 'Intro', durationMinutes: 30 },
      { id: 'a'.repeat(51), title: 'Intro', durationMinutes: 30 },
    ])('rejects invalid event type %j with 400', async (payload) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/event-types',
        payload,
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an already taken event type id with 409', async () => {
      await createType({ id: 'intro' });
      const response = await app.inject({
        method: 'POST',
        url: '/api/event-types',
        payload: { id: 'intro', title: 'Other', durationMinutes: 15 },
      });
      expect(response.statusCode).toBe(409);
      expect(
        (await app.inject({ method: 'GET', url: '/api/event-types' })).json(),
      ).toHaveLength(1);
    });

    it('does not change the id on update', async () => {
      await createType({ id: 'intro' });
      const response = await app.inject({
        method: 'PUT',
        url: '/api/event-types/intro',
        payload: { id: 'other', title: 'x', durationMinutes: 30 },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: 'intro', title: 'x' });
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/event-types/other/slots',
          })
        ).statusCode,
      ).toBe(404);
    });

    it('returns 404 when updating an unknown event type', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/event-types/nope',
        payload: { title: 'x', durationMinutes: 30 },
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/owner', () => {
    it('returns the owner profile', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/owner' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ name: 'Владелец', timeZone: 'UTC' });
    });

    it('uses the configured name and time zone', async () => {
      const custom = buildApp({
        ownerName: 'Ann',
        ownerTz: 'Asia/Tokyo',
        now: () => NOW,
      });
      const response = await custom.inject({
        method: 'GET',
        url: '/api/owner',
      });
      await custom.close();
      expect(response.json()).toEqual({ name: 'Ann', timeZone: 'Asia/Tokyo' });
    });
  });

  describe('slots', () => {
    it('lists slots for the whole horizon with free/busy status', async () => {
      const { id } = await createType({ durationMinutes: 60 });
      const response = await app.inject({
        method: 'GET',
        url: `/api/event-types/${id}/slots`,
      });

      expect(response.statusCode).toBe(200);
      const slots =
        response.json<{ date: string; start: string; status: string }[]>();
      expect(slots).toHaveLength(14 * 9);
      expect(slots[0]).toEqual({
        date: '2026-10-15',
        start: '2026-10-15T09:00:00.000Z',
        end: '2026-10-15T10:00:00.000Z',
        status: 'free',
      });
    });

    it('returns 404 for an unknown event type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/event-types/nope/slots',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/bookings', () => {
    it('creates a booking with a snapshot of the event type and busies the slot', async () => {
      const { id } = await createType({ title: 'Intro', durationMinutes: 30 });
      const response = await book({
        eventTypeId: id,
        start: '2026-10-16T09:00:00.000Z',
        note: 'hello',
        ...guest,
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        eventTypeId: id,
        eventTitle: 'Intro',
        durationMinutes: 30,
        start: '2026-10-16T09:00:00.000Z',
        end: '2026-10-16T09:30:00.000Z',
        guestName: 'Ann',
        guestEmail: 'ann@example.com',
        note: 'hello',
      });

      const slots = (
        await app.inject({ method: 'GET', url: `/api/event-types/${id}/slots` })
      ).json<{ start: string; status: string }[]>();
      expect(
        slots.find((s) => s.start === '2026-10-16T09:00:00.000Z')?.status,
      ).toBe('busy');
    });

    it('rejects an overlapping booking of another event type with 409', async () => {
      const long = await createType({ durationMinutes: 60 });
      const short = await createType({ durationMinutes: 15 });
      await book({
        eventTypeId: long.id,
        start: '2026-10-16T09:00:00.000Z',
        ...guest,
      });

      const clash = await book({
        eventTypeId: short.id,
        start: '2026-10-16T09:45:00.000Z',
        ...guest,
      });
      const adjacent = await book({
        eventTypeId: short.id,
        start: '2026-10-16T10:00:00.000Z',
        ...guest,
      });

      expect(clash.statusCode).toBe(409);
      expect(adjacent.statusCode).toBe(201);
    });

    it.each([
      ['in the past', '2026-10-15T07:00:00.000Z'],
      ['starting now', '2026-10-15T08:00:00.000Z'],
      ['before the working window', '2026-10-16T08:30:00.000Z'],
      ['ending after the working window', '2026-10-16T17:45:00.000Z'],
      ['beyond the horizon', '2026-10-29T09:00:00.000Z'],
      ['off the slot grid', '2026-10-16T09:10:00.000Z'],
    ])('rejects a booking %s with 422', async (_name, start) => {
      const { id } = await createType({ durationMinutes: 30 });
      const response = await book({ eventTypeId: id, start, ...guest });
      expect(response.statusCode).toBe(422);
    });

    it('returns 404 for an unknown event type', async () => {
      const response = await book({
        eventTypeId: 'nope',
        start: '2026-10-16T09:00:00.000Z',
        ...guest,
      });
      expect(response.statusCode).toBe(404);
    });

    it.each([
      { guestName: '', guestEmail: 'ann@example.com' },
      { guestName: 'Ann', guestEmail: 'not-an-email' },
      { guestName: 'Ann' },
    ])('rejects malformed guest data %j with 400', async (data) => {
      const { id } = await createType();
      const response = await book({
        eventTypeId: id,
        start: '2026-10-16T09:00:00.000Z',
        ...data,
      });
      expect(response.statusCode).toBe(400);
    });

    it('rejects an invalid start with 400', async () => {
      const { id } = await createType();
      const response = await book({
        eventTypeId: id,
        start: 'tomorrow',
        ...guest,
      });
      expect(response.statusCode).toBe(400);
    });

    it('keeps bookings unchanged after the event type is edited or deleted', async () => {
      const { id } = await createType({ title: 'Intro', durationMinutes: 30 });
      await book({
        eventTypeId: id,
        start: '2026-10-16T09:00:00.000Z',
        ...guest,
      });
      await app.inject({
        method: 'PUT',
        url: `/api/event-types/${id}`,
        payload: { title: 'Renamed', durationMinutes: 60 },
      });
      await app.inject({ method: 'DELETE', url: `/api/event-types/${id}` });

      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/bookings',
      });
      expect(list.json()).toMatchObject([
        {
          eventTitle: 'Intro',
          durationMinutes: 30,
          end: '2026-10-16T09:30:00.000Z',
        },
      ]);
    });
  });

  describe('GET /api/admin/bookings', () => {
    it('lists upcoming bookings sorted by start and hides past ones', async () => {
      const { id } = await createType({ durationMinutes: 60 });
      await book({
        eventTypeId: id,
        start: '2026-10-17T09:00:00.000Z',
        ...guest,
      });
      await book({
        eventTypeId: id,
        start: '2026-10-16T09:00:00.000Z',
        ...guest,
      });

      const list = await app.inject({
        method: 'GET',
        url: '/api/admin/bookings',
      });
      expect(list.json<{ start: string }[]>().map((b) => b.start)).toEqual([
        '2026-10-16T09:00:00.000Z',
        '2026-10-17T09:00:00.000Z',
      ]);
    });
  });
});
