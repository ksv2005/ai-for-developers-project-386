import type { FastifyReply, FastifyRequest } from 'fastify';
import type { components } from 'api-client/schema';
import type { Repository } from './repository.js';
import { computeSlots } from './slots.js';

type Schemas = components['schemas'];

export interface ServiceOptions {
  repository: Repository;
  owner: Schemas['Owner'];
  now: () => Date;
}

type Req<T extends { Body?: unknown; Params?: unknown } = object> =
  FastifyRequest<T>;

const STATUS_TEXT: Record<number, string> = {
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
};

/**
 * Handlers for the operations of packages/contract/openapi.yaml, keyed by
 * operationId. Request validation and routing come from the contract.
 */
export class Service {
  private readonly repository: Repository;
  private readonly owner: Schemas['Owner'];
  private readonly now: () => Date;

  constructor({ repository, owner, now }: ServiceOptions) {
    this.repository = repository;
    this.owner = owner;
    this.now = now;
  }

  private fail(reply: FastifyReply, statusCode: number, message: string) {
    return reply
      .code(statusCode)
      .send({ statusCode, error: STATUS_TEXT[statusCode], message });
  }

  private notFound(reply: FastifyReply) {
    return this.fail(reply, 404, 'Event type not found');
  }

  Api_health = async (): Promise<Schemas['Health']> => ({ status: 'ok' });

  Api_getOwner = async (): Promise<Schemas['Owner']> => this.owner;

  EventTypes_list = async (): Promise<Schemas['EventType'][]> =>
    this.repository.listEventTypes();

  EventTypes_create = async (
    request: Req<{ Body: Schemas['EventTypeCreate'] }>,
    reply: FastifyReply,
  ) => {
    const { id, title, description = '', durationMinutes } = request.body;
    const created = this.repository.createEventType({
      id,
      title,
      description,
      durationMinutes,
    });
    if (!created) {
      return this.fail(reply, 409, 'Event type id is already taken');
    }
    return reply.code(201).send(created);
  };

  EventTypes_update = async (
    request: Req<{ Params: { id: string }; Body: Schemas['EventTypeUpdate'] }>,
    reply: FastifyReply,
  ) => {
    const { title, description = '', durationMinutes } = request.body;
    const updated = this.repository.updateEventType(request.params.id, {
      title,
      description,
      durationMinutes,
    });
    return updated ?? this.notFound(reply);
  };

  EventTypes_delete = async (
    request: Req<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) =>
    this.repository.deleteEventType(request.params.id)
      ? reply.code(204).send()
      : this.notFound(reply);

  EventTypes_slots = async (
    request: Req<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const eventType = this.repository.getEventType(request.params.id);
    if (!eventType) return this.notFound(reply);
    return computeSlots({
      durationMinutes: eventType.durationMinutes,
      bookings: this.repository.listBookings(),
      now: this.now(),
      tz: this.owner.timeZone,
    }).map(({ date, start, end, status }) => ({ date, start, end, status }));
  };

  Bookings_create = async (
    request: Req<{ Body: Schemas['BookingCreate'] }>,
    reply: FastifyReply,
  ) => {
    const {
      eventTypeId,
      start,
      guestName,
      guestEmail,
      note = '',
    } = request.body;
    const eventType = this.repository.getEventType(eventTypeId);
    if (!eventType) return this.notFound(reply);

    const startIso = new Date(start).toISOString();
    // Ignoring existing bookings here: what is left busy is only the past.
    const slot = computeSlots({
      durationMinutes: eventType.durationMinutes,
      bookings: [],
      now: this.now(),
      tz: this.owner.timeZone,
    }).find((s) => s.start === startIso);
    if (!slot || slot.status === 'busy') {
      return this.fail(
        reply,
        422,
        'Start must be the beginning of a future slot within the working window and booking horizon',
      );
    }

    const booking = this.repository.createBookingIfFree({
      eventTypeId,
      eventTitle: eventType.title,
      durationMinutes: eventType.durationMinutes,
      start: slot.start,
      end: slot.end,
      guestName,
      guestEmail,
      note,
    });
    if (!booking) return this.fail(reply, 409, 'This time is already booked');
    return reply.code(201).send(booking);
  };

  AdminBookings_list = async (): Promise<Schemas['Booking'][]> => {
    const nowMs = this.now().getTime();
    return this.repository
      .listBookings()
      .filter((b) => Date.parse(b.end) > nowMs)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  };
}
