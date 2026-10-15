import { randomUUID } from 'node:crypto';
import type { Interval } from './slots.js';

export interface EventType {
  id: string;
  title: string;
  description: string;
  durationMinutes: number;
}

export type EventTypeInput = Omit<EventType, 'id'>;

export interface Booking extends Interval {
  id: string;
  eventTypeId: string;
  eventTitle: string;
  durationMinutes: number;
  guestName: string;
  guestEmail: string;
  note: string;
}

export type BookingInput = Omit<Booking, 'id'>;

export interface Repository {
  listEventTypes(): EventType[];
  getEventType(id: string): EventType | undefined;
  createEventType(input: EventTypeInput): EventType;
  updateEventType(id: string, input: EventTypeInput): EventType | undefined;
  deleteEventType(id: string): boolean;
  listBookings(): Booking[];
  /** Atomically stores the booking unless it overlaps an existing one; returns undefined on overlap. */
  createBookingIfFree(input: BookingInput): Booking | undefined;
}

export function createInMemoryRepository(): Repository {
  const eventTypes = new Map<string, EventType>();
  const bookings: Booking[] = [];

  return {
    listEventTypes: () => [...eventTypes.values()],
    getEventType: (id) => eventTypes.get(id),
    createEventType(input) {
      const eventType = { id: randomUUID(), ...input };
      eventTypes.set(eventType.id, eventType);
      return eventType;
    },
    updateEventType(id, input) {
      if (!eventTypes.has(id)) return undefined;
      const eventType = { id, ...input };
      eventTypes.set(id, eventType);
      return eventType;
    },
    deleteEventType: (id) => eventTypes.delete(id),
    listBookings: () => [...bookings],
    createBookingIfFree(input) {
      const start = Date.parse(input.start);
      const end = Date.parse(input.end);
      const clash = bookings.some(
        (b) => start < Date.parse(b.end) && Date.parse(b.start) < end,
      );
      if (clash) return undefined;
      const booking = { id: randomUUID(), ...input };
      bookings.push(booking);
      return booking;
    },
  };
}
