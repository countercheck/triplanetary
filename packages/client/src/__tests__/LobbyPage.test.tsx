import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import LobbyPage from "../pages/lobby/LobbyPage";

const mswServer = setupServer(
  http.get("/api/auth/me", () =>
    HttpResponse.json({
      id: "user-1",
      email: "test@example.com",
      displayName: "Tester",
      isAdmin: false,
    }),
  ),
  http.get("/games/triplanetary", () => HttpResponse.json({ matches: [] })),
);

beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function renderLobby() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LobbyPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LobbyPage", () => {
  it("renders Create Game button when authenticated", async () => {
    renderLobby();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Create Game" }),
      ).toBeInTheDocument(),
    );
  });
});
