import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { AdminGuard } from '../components/AdminGuard';

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function renderWithAdmin(isAdmin: boolean) {
  mswServer.use(
    http.get('/api/auth/me', () =>
      HttpResponse.json({ id: '1', email: 'a@a.com', displayName: 'A', isAdmin }),
    ),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/map-editor']}>
        <Routes>
          <Route
            path="/admin/map-editor"
            element={<AdminGuard><div>Admin Content</div></AdminGuard>}
          />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminGuard', () => {
  it('renders children when user is admin', async () => {
    renderWithAdmin(true);
    await waitFor(() => expect(screen.getByText('Admin Content')).toBeInTheDocument());
  });

  it('redirects to / when user is not admin', async () => {
    renderWithAdmin(false);
    await waitFor(() => expect(screen.getByText('Home')).toBeInTheDocument());
  });

  it('renders nothing while loading auth', () => {
    mswServer.use(http.get('/api/auth/me', () => new Promise(() => {}))); // never resolves
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/admin/map-editor']}>
          <Routes>
            <Route
              path="/admin/map-editor"
              element={<AdminGuard><div>Admin Content</div></AdminGuard>}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument();
  });
});
