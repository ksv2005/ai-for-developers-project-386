import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

function stubFetch(handler: (request: Request) => Response) {
  const fetchMock = vi.fn(async (input: Request) => handler(input));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the page heading', () => {
    stubFetch(() => Response.json({ status: 'ok' }));
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Календарь звонков' }),
    ).toBeTruthy();
  });

  it('shows the API status obtained through the SDK', async () => {
    const fetchMock = stubFetch(() => Response.json({ status: 'ok' }));
    render(<App />);

    expect(await screen.findByText('API: ok')).toBeTruthy();
    const request = fetchMock.mock.calls[0]?.[0];
    expect(request?.method).toBe('GET');
    expect(new URL(request?.url ?? '').pathname).toBe('/api/health');
  });

  it('shows an error when the API is unavailable', async () => {
    stubFetch(() => new Response('boom', { status: 500 }));
    render(<App />);

    expect(await screen.findByText('API недоступен')).toBeTruthy();
  });
});
