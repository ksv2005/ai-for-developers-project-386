import type { FastifyPluginAsync } from 'fastify';
import { type EventTypeInput, type Repository } from './repository.js';
import { computeSlots } from './slots.js';

export interface RoutesOptions {
  repository: Repository;
  ownerTz: string;
  now: () => Date;
}

const eventTypeBody = {
  type: 'object',
  required: ['title', 'durationMinutes'],
  additionalProperties: false,
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', default: '' },
    durationMinutes: { type: 'integer', minimum: 5, maximum: 540 },
  },
} as const;

const bookingBody = {
  type: 'object',
  required: ['eventTypeId', 'start', 'guestName', 'guestEmail'],
  additionalProperties: false,
  properties: {
    eventTypeId: { type: 'string', minLength: 1 },
    start: { type: 'string', format: 'date-time' },
    guestName: { type: 'string', minLength: 1 },
    guestEmail: { type: 'string', format: 'email' },
    note: { type: 'string', default: '' },
  },
} as const;

interface BookingBody {
  eventTypeId: string;
  start: string;
  guestName: string;
  guestEmail: string;
  note: string;
}

export const routes: FastifyPluginAsync<RoutesOptions> = async (
  api,
  { repository, ownerTz, now },
) => {
  const notFound = (what: string) => ({
    statusCode: 404,
    error: 'Not Found',
    message: `${what} not found`,
  });

  api.get('/health', async () => ({ status: 'ok' }));

  api.get('/event-types', async () => repository.listEventTypes());

  api.post<{ Body: EventTypeInput }>(
    '/event-types',
    { schema: { body: eventTypeBody } },
    async (request, reply) =>
      reply.code(201).send(repository.createEventType(request.body)),
  );

  api.put<{ Params: { id: string }; Body: EventTypeInput }>(
    '/event-types/:id',
    { schema: { body: eventTypeBody } },
    async (request, reply) => {
      const updated = repository.updateEventType(
        request.params.id,
        request.body,
      );
      return updated ?? reply.code(404).send(notFound('Event type'));
    },
  );

  api.delete<{ Params: { id: string } }>(
    '/event-types/:id',
    async (request, reply) =>
      repository.deleteEventType(request.params.id)
        ? reply.code(204).send()
        : reply.code(404).send(notFound('Event type')),
  );

  api.get<{ Params: { id: string } }>(
    '/event-types/:id/slots',
    async (request, reply) => {
      const eventType = repository.getEventType(request.params.id);
      if (!eventType) return reply.code(404).send(notFound('Event type'));
      return computeSlots({
        durationMinutes: eventType.durationMinutes,
        bookings: repository.listBookings(),
        now: now(),
        tz: ownerTz,
      }).map(({ date, start, end, status }) => ({ date, start, end, status }));
    },
  );

  api.post<{ Body: BookingBody }>(
    '/bookings',
    { schema: { body: bookingBody } },
    async (request, reply) => {
      const { eventTypeId, start, guestName, guestEmail, note } = request.body;
      const eventType = repository.getEventType(eventTypeId);
      if (!eventType) return reply.code(404).send(notFound('Event type'));

      const startIso = new Date(start).toISOString();
      // Ignoring existing bookings here: what is left busy is only the past.
      const slot = computeSlots({
        durationMinutes: eventType.durationMinutes,
        bookings: [],
        now: now(),
        tz: ownerTz,
      }).find((s) => s.start === startIso);
      if (!slot || slot.status === 'busy') {
        return reply.code(422).send({
          statusCode: 422,
          error: 'Unprocessable Entity',
          message:
            'Start must be the beginning of a future slot within the working window and booking horizon',
        });
      }

      const booking = repository.createBookingIfFree({
        eventTypeId,
        eventTitle: eventType.title,
        durationMinutes: eventType.durationMinutes,
        start: slot.start,
        end: slot.end,
        guestName,
        guestEmail,
        note,
      });
      if (!booking) {
        return reply.code(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: 'This time is already booked',
        });
      }
      return reply.code(201).send(booking);
    },
  );

  api.get('/admin/bookings', async () => {
    const nowMs = now().getTime();
    return repository
      .listBookings()
      .filter((b) => Date.parse(b.end) > nowMs)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  });
};
