import { createApiClient } from 'api-client';
import { useEffect, useState } from 'react';

const api = createApiClient();

type Status = 'loading' | 'ok' | 'unavailable';

function App() {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    api
      .GET('/api/health')
      .then(({ data }) => active && setStatus(data ? 'ok' : 'unavailable'))
      .catch(() => active && setStatus('unavailable'));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <h1>Календарь звонков</h1>
      {status === 'ok' && <p>API: ok</p>}
      {status === 'unavailable' && <p>API недоступен</p>}
    </main>
  );
}

export default App;
