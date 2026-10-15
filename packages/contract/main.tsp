import "@typespec/http";
import "@typespec/openapi3";

using TypeSpec.Http;

@service(#{ title: "Календарь звонков API" })
@server("/", "Same origin")
namespace CallBooking;

/** Идентификатор Типа события: задаёт Владелец, уникален, виден Гостю в адресе, не меняется. */
@pattern("^[a-z0-9-]{1,50}$")
@minLength(1)
@maxLength(50)
scalar EventTypeId extends string;

/** Профиль Владельца: имя и часовой пояс, в котором показывается всё время. */
model Owner {
  /** Имя Владельца. */
  name: string;

  /** IANA-имя часового пояса Владельца, например Europe/Moscow. */
  timeZone: string;
}

/** Вид звонка. */
model EventType {
  id: EventTypeId;

  @minLength(1)
  @maxLength(100)
  title: string;

  description: string;

  /** Длительность в минутах. */
  @minValue(5)
  @maxValue(540)
  durationMinutes: int32;
}

/** Создание Типа события: id задаёт Владелец. */
model EventTypeCreate {
  id: EventTypeId;

  @minLength(1)
  @maxLength(100)
  title: string;

  description?: string = "";

  @minValue(5)
  @maxValue(540)
  durationMinutes: int32;
}

/** Изменение Типа события: id не меняется и в теле не принимается. */
model EventTypeUpdate {
  @minLength(1)
  @maxLength(100)
  title: string;

  description?: string = "";

  @minValue(5)
  @maxValue(540)
  durationMinutes: int32;
}

/** Интервал в Рабочем окне; свободный или занятый. */
model Slot {
  /** Календарная дата в часовом поясе Владельца (YYYY-MM-DD). */
  @format("date")
  date: string;

  start: utcDateTime;
  end: utcDateTime;
  status: SlotStatus;
}

enum SlotStatus {
  free,
  busy,
}

/** Создание Бронирования. */
model BookingCreate {
  eventTypeId: EventTypeId;

  /** Начало Слота. */
  start: utcDateTime;

  @minLength(1)
  guestName: string;

  @format("email")
  guestEmail: string;

  note?: string = "";
}

/** Подтверждённое Бронирование со снимком Типа события. */
model Booking {
  id: string;
  eventTypeId: EventTypeId;
  eventTitle: string;
  durationMinutes: int32;
  start: utcDateTime;
  end: utcDateTime;
  guestName: string;
  guestEmail: string;
  note: string;
}

model Health {
  status: "ok";
}

/** Единый формат ошибки. */
model ApiError {
  statusCode: int32;
  error: string;
  message: string;

  /** Код ошибки валидации схемы (только для 400). */
  code?: string;
}

@error
model BadRequest {
  @statusCode _: 400;
  ...ApiError;
}

@error
model NotFound {
  @statusCode _: 404;
  ...ApiError;
}

@error
model Conflict {
  @statusCode _: 409;
  ...ApiError;
}

@error
model Unprocessable {
  @statusCode _: 422;
  ...ApiError;
}

@route("/api")
namespace Api {
  @route("/health")
  @tag("service")
  @get
  op health(): Health;

  @route("/owner")
  @tag("owner")
  @get
  op getOwner(): Owner;

  @route("/event-types")
  @tag("event-types")
  interface EventTypes {
    /** Список Типов событий. */
    @get list(): EventType[];

    /** Создать Тип события; id задаёт Владелец. */
    @post create(@body body: EventTypeCreate): {
      @statusCode _: 201;
      @body body: EventType;
    } | BadRequest | Conflict;

    /** Изменить Тип события (id не меняется). */
    @put @route("/{id}") update(
      @path id: EventTypeId,
      @body body: EventTypeUpdate,
    ): EventType | BadRequest | NotFound;

    /** Удалить Тип события; существующие Бронирования не затрагиваются. */
    @delete @route("/{id}") delete(@path id: EventTypeId): {
      @statusCode _: 204;
    } | NotFound;

    /** Слоты Типа события на весь Горизонт бронирования (плоский массив). */
    @get @route("/{id}/slots") slots(@path id: EventTypeId): Slot[] | NotFound;
  }

  @route("/bookings")
  @tag("bookings")
  interface Bookings {
    /** Забронировать Слот. */
    @post create(@body body: BookingCreate): {
      @statusCode _: 201;
      @body body: Booking;
    } | BadRequest | NotFound | Conflict | Unprocessable;
  }

  @route("/admin/bookings")
  @tag("admin")
  interface AdminBookings {
    /** Предстоящие Бронирования по возрастанию начала. */
    @get list(): Booking[];
  }
}
