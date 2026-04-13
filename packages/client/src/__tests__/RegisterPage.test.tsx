import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import RegisterPage from '../pages/RegisterPage';

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function renderRegister() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/lobby" element={<div>Lobby</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillForm(displayName = 'Alice', email = 'alice@test.com', password = 'password123') {
  await userEvent.type(screen.getByLabelText(/display name/i), displayName);
  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.type(screen.getByLabelText(/password/i), password);
}

describe('RegisterPage', () => {
  it('renders all form fields and submit button', () => {
    renderRegister();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('navigates to /lobby on successful registration', async () => {
    mswServer.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ id: '1', email: 'alice@test.com', displayName: 'Alice', isAdmin: false }, { status: 201 }),
      ),
      http.get('/api/auth/me', () =>
        HttpResponse.json({ id: '1', email: 'alice@test.com', displayName: 'Alice', isAdmin: false }),
      ),
    );
    renderRegister();
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() => expect(screen.getByText('Lobby')).toBeInTheDocument());
  });

  it('shows "Email already registered" on 409', async () => {
    mswServer.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ error: 'Email already registered' }, { status: 409 }),
      ),
    );
    renderRegister();
    await fillForm('Bob', 'taken@test.com');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/email already registered/i),
    );
  });

  it('shows generic error on other failures', async () => {
    mswServer.use(
      http.post('/api/auth/register', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 }),
      ),
    );
    renderRegister();
    await fillForm('Eve', 'eve@test.com');
    await userEvent.click(screen.getByRole('button', { name: /register/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/registration failed/i),
    );
  });

  it('has a link to the login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /login/i })).toHaveAttribute('href', '/login');
  });
});
