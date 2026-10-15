import { useEffect, useState } from 'react';
import type { components } from 'api-client';
import { api } from '../api';
import EventTypesSection from '../admin/EventTypesSection';

type Owner = components['schemas']['Owner'];

type OwnerState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; owner: Owner };

/** Страница Владельца; секции независимы — в #16 рядом добавится список Бронирований. */
export default function AdminPage() {
  const [state, setState] = useState<OwnerState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    const load = async (): Promise<OwnerState> => {
      try {
        const { data } = await api.GET('/api/owner');
        return data ? { status: 'ready', owner: data } : { status: 'error' };
      } catch {
        return { status: 'error' };
      }
    };
    void load().then((result) => {
      if (active) setState(result);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="admin">
      <header className="admin-head">
        <h1>Админка</h1>
        {state.status === 'ready' && (
          <p className="muted" aria-label="Владелец">
            {state.owner.name}
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert">Не удалось загрузить профиль Владельца.</p>
        )}
      </header>
      <EventTypesSection />
    </div>
  );
}
