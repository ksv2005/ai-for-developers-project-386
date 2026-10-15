import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { components } from 'api-client';
import { api } from '../api';

type Owner = components['schemas']['Owner'];
type EventType = components['schemas']['EventType'];

type Catalog =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; owner: Owner; eventTypes: EventType[] };

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

async function loadCatalog(): Promise<Catalog> {
  try {
    const [owner, eventTypes] = await Promise.all([
      api.GET('/api/owner'),
      api.GET('/api/event-types'),
    ]);
    if (owner.data === undefined || eventTypes.data === undefined) {
      return { status: 'error' };
    }
    return {
      status: 'ready',
      owner: owner.data,
      eventTypes: eventTypes.data,
    };
  } catch {
    return { status: 'error' };
  }
}

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<Catalog>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void loadCatalog().then((result) => {
      if (active) setCatalog(result);
    });
    return () => {
      active = false;
    };
  }, []);

  if (catalog.status === 'loading') {
    return <p role="status">Загрузка…</p>;
  }

  if (catalog.status === 'error') {
    return (
      <p role="alert" className="card">
        Не удалось загрузить типы событий. Попробуйте обновить страницу.
      </p>
    );
  }

  const { owner, eventTypes } = catalog;

  return (
    <section>
      <h1>Записаться</h1>
      <div className="owner">
        <span className="avatar" aria-hidden="true">
          {initials(owner.name)}
        </span>
        <div>
          <div className="owner-name">{owner.name}</div>
          <div className="owner-role">Host</div>
        </div>
      </div>
      {eventTypes.length === 0 ? (
        <p className="card">Нет доступных типов событий.</p>
      ) : (
        <ul className="catalog">
          {eventTypes.map((eventType) => (
            <li key={eventType.id}>
              <Link to={`/book/${eventType.id}`} className="card event-card">
                <h2>{eventType.title}</h2>
                <p>{eventType.description}</p>
                <span className="badge">{eventType.durationMinutes} мин</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
