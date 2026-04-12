import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import LoginPage from '../pages/LoginPage';

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lobby" element={<div>Lobby</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  it('renders email, password fields and submit button', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('navigates to /lobby on successful login', async () => {
    mswServer.use(
      http.post('/api/auth/login', () => HttpResponse.json({ id: '1', email: 'a@a.com', displayName: 'Alice', isAdmin: false })),
      http.get('/api/auth/me', () => HttpResponse.json({ id: '1', email: 'a@a.com', displayName: 'Alice', isAdmin: false })),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'a@a.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() => expect(screen.getByText('Lobby')).toBeInTheDocument());
  });

  it('shows error message on failed login', async () => {
    mswServer.use(
      http.post('/api/auth/login', () => HttpResponse.json({ error: 'Invalid' }, { status: 401 })),
    );
    renderLogin();
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@bad.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /login/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i),
    );
  });

  it('has a link to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');
  });
});
