import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { components } from 'api-client';
import { api } from '../api';
import { fieldOf } from '../lib/fieldErrors';

type EventType = components['schemas']['EventType'];

const FIELDS = ['id', 'title', 'description', 'durationMinutes'] as const;
type Field = (typeof FIELDS)[number];
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_MESSAGES: Record<Field, string> = {
  id: 'Допустимы латиница, цифры и дефис, до 50 символов',
  title: 'Укажите название (до 100 символов)',
  description: 'Описание не принято сервером',
  durationMinutes: 'Длительность — от 5 до 540 минут',
};

const GENERIC_ERROR = 'Проверьте введённые данные.';
const NOT_FOUND = 'Тип не найден';

type List =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; items: EventType[] };

type Mode =
  | { kind: 'idle' }
  | { kind: 'create' }
  | { kind: 'edit'; eventType: EventType }
  | { kind: 'delete'; eventType: EventType };

export default function EventTypesSection() {
  const [list, setList] = useState<List>({ status: 'loading' });
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const { data } = await api.GET('/api/event-types');
      setList(
        data === undefined
          ? { status: 'error' }
          : { status: 'ready', items: data },
      );
    } catch {
      setList({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- начальная загрузка
    void reload();
  }, [reload]);

  /** Тип исчез на сервере: закрыть форму, сообщить и перезагрузить список. */
  const handleNotFound = () => {
    setMode({ kind: 'idle' });
    setNotice(NOT_FOUND);
    void reload();
  };

  const done = () => {
    setMode({ kind: 'idle' });
    setNotice(null);
    void reload();
  };

  return (
    <section aria-labelledby="event-types-title">
      <div className="section-head">
        <h2 id="event-types-title">Типы событий</h2>
        {mode.kind === 'idle' && (
          <button
            type="button"
            className="button"
            onClick={() => {
              setNotice(null);
              setMode({ kind: 'create' });
            }}
          >
            Создать тип
          </button>
        )}
      </div>

      {notice && (
        <p role="alert" className="card notice">
          {notice}
        </p>
      )}

      {mode.kind === 'create' && (
        <EventTypeForm
          onCancel={() => setMode({ kind: 'idle' })}
          onSaved={done}
        />
      )}
      {mode.kind === 'edit' && (
        <EventTypeForm
          key={mode.eventType.id}
          eventType={mode.eventType}
          onCancel={() => setMode({ kind: 'idle' })}
          onSaved={done}
          onNotFound={handleNotFound}
        />
      )}
      {mode.kind === 'delete' && (
        <DeleteConfirm
          eventType={mode.eventType}
          onCancel={() => setMode({ kind: 'idle' })}
          onDeleted={done}
          onNotFound={handleNotFound}
        />
      )}

      {list.status === 'loading' && <p role="status">Загрузка…</p>}
      {list.status === 'error' && (
        <p role="alert" className="card">
          Не удалось загрузить типы событий. Попробуйте обновить страницу.
        </p>
      )}
      {list.status === 'ready' &&
        (list.items.length === 0 ? (
          <p className="card">Типов событий пока нет.</p>
        ) : (
          <ul className="admin-list">
            {list.items.map((eventType) => (
              <li key={eventType.id} className="card">
                <div>
                  <h3>{eventType.title}</h3>
                  <p className="muted">
                    id: <code>{eventType.id}</code> ·{' '}
                    {eventType.durationMinutes} мин
                  </p>
                  <p>{eventType.description}</p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Изменить ${eventType.title}`}
                    onClick={() => {
                      setNotice(null);
                      setMode({ kind: 'edit', eventType });
                    }}
                  >
                    Изменить
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    aria-label={`Удалить ${eventType.title}`}
                    onClick={() => {
                      setNotice(null);
                      setMode({ kind: 'delete', eventType });
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}

interface EventTypeFormProps {
  /** Задан при редактировании: id только для чтения. */
  eventType?: EventType;
  onCancel: () => void;
  onSaved: () => void;
  onNotFound?: () => void;
}

function EventTypeForm({
  eventType,
  onCancel,
  onSaved,
  onNotFound,
}: EventTypeFormProps) {
  const editing = eventType !== undefined;
  const [id, setId] = useState(eventType?.id ?? '');
  const [title, setTitle] = useState(eventType?.title ?? '');
  const [description, setDescription] = useState(eventType?.description ?? '');
  const [duration, setDuration] = useState(
    eventType ? String(eventType.durationMinutes) : '',
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setPending(true);
    const fields = { title, description, durationMinutes: Number(duration) };
    try {
      const { data, error, response } = editing
        ? await api.PUT('/api/event-types/{id}', {
            params: { path: { id: eventType.id } },
            body: fields,
          })
        : await api.POST('/api/event-types', { body: { id, ...fields } });
      if (data !== undefined) {
        onSaved();
      } else if (response.status === 400) {
        const field = fieldOf(error?.message ?? '', FIELDS);
        if (field) setErrors({ [field]: FIELD_MESSAGES[field] });
        else setFormError(GENERIC_ERROR);
      } else if (response.status === 409) {
        setErrors({ id: 'Этот id уже занят' });
      } else if (response.status === 404 && onNotFound) {
        onNotFound();
      } else {
        setFormError('Не удалось сохранить тип. Попробуйте ещё раз.');
      }
    } catch {
      setFormError('Не удалось сохранить тип. Попробуйте ещё раз.');
    } finally {
      setPending(false);
    }
  }

  const fieldProps = (field: Field) => ({
    id: `et-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `et-${field}-error` : undefined,
  });
  const fieldError = (field: Field) =>
    errors[field] ? (
      <p id={`et-${field}-error`} className="field-error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form
      className="card form"
      noValidate
      aria-label={editing ? 'Изменение типа' : 'Новый тип'}
      onSubmit={(e) => void submit(e)}
    >
      <label htmlFor="et-id">Id</label>
      <input
        {...fieldProps('id')}
        value={id}
        readOnly={editing}
        onChange={(e) => setId(e.target.value)}
      />
      {fieldError('id')}

      <label htmlFor="et-title">Название</label>
      <input
        {...fieldProps('title')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {fieldError('title')}

      <label htmlFor="et-description">Описание</label>
      <textarea
        {...fieldProps('description')}
        rows={3}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {fieldError('description')}

      <label htmlFor="et-durationMinutes">Длительность, мин</label>
      <input
        {...fieldProps('durationMinutes')}
        type="number"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
      />
      {fieldError('durationMinutes')}

      {formError && <p role="alert">{formError}</p>}

      <div className="actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="button" disabled={pending}>
          Сохранить
        </button>
      </div>
    </form>
  );
}

interface DeleteConfirmProps {
  eventType: EventType;
  onCancel: () => void;
  onDeleted: () => void;
  onNotFound: () => void;
}

function DeleteConfirm({
  eventType,
  onCancel,
  onDeleted,
  onNotFound,
}: DeleteConfirmProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function confirm() {
    setPending(true);
    setFailed(false);
    try {
      const { response } = await api.DELETE('/api/event-types/{id}', {
        params: { path: { id: eventType.id } },
      });
      if (response.ok) onDeleted();
      else if (response.status === 404) onNotFound();
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="card"
      role="alertdialog"
      aria-label="Подтверждение удаления"
    >
      <p>
        Удалить тип «{eventType.title}»? Существующие бронирования не
        затрагиваются.
      </p>
      {failed && (
        <p role="alert">Не удалось удалить тип. Попробуйте ещё раз.</p>
      )}
      <div className="actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Отмена
        </button>
        <button
          type="button"
          className="button"
          disabled={pending}
          onClick={() => void confirm()}
        >
          Подтвердить удаление
        </button>
      </div>
    </div>
  );
}
