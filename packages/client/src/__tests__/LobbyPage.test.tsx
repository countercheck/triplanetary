import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import LobbyPage from "../pages/lobby/LobbyPage";

// Track what was navigated to
const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const CANONICAL_MAP = {
  meta: { name: "Solar System", version: "1.0", hexSize: 30, orientation: "pointy" },
  bodies: {},
  hexes: {},
  bases: {},
};

const MAP_LIST = [{ id: "map-1", name: "Solar System", isCanonical: true }];

const mswServer = setupServer(
  http.get("/api/auth/me", () =>
    HttpResponse.json({
      id: "user-1",
      email: "test@example.com",
      displayName: "Tester",
      isAdmin: false,
    }),
  ),
  http.get("/api/maps", () => HttpResponse.json(MAP_LIST)),
  http.get("/api/maps/map-1", () =>
    HttpResponse.json({ id: "map-1", data: CANONICAL_MAP }),
  ),
  http.get("/games/triplanetary", () =>
    HttpResponse.json({ matches: [] }),
  ),
  http.post("/games/triplanetary/create", () =>
    HttpResponse.json({ matchID: "match-abc" }, { status: 201 }),
  ),
  http.post("/games/triplanetary/match-abc/join", () =>
    HttpResponse.json({ playerCredentials: "creds-xyz" }),
  ),
);

beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());
beforeEach(() => {
  navigateMock.mockReset();
  sessionStorage.clear();
});

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

  it("shows empty state when no matches exist", async () => {
    renderLobby();
    await waitFor(() =>
      expect(screen.getByText("No open games. Create one above!")).toBeInTheDocument(),
    );
  });

  it("lists open matches when matches exist", async () => {
    mswServer.use(
      http.get("/games/triplanetary", () =>
        HttpResponse.json({
          matches: [
            { matchID: "aaaa-1111-2222", players: {}, createdAt: new Date().toISOString() },
          ],
        }),
      ),
    );

    renderLobby();
    await waitFor(() =>
      expect(screen.getByText(/aaaa-111/)).toBeInTheDocument(),
    );
  });

  it("creates a game, stores credentials, and navigates to game room", async () => {
    const user = userEvent.setup();
    renderLobby();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create Game" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Create Game" }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/game/match-abc"));

    const stored = sessionStorage.getItem("bgio-match-abc");
    expect(stored).not.toBeNull();
    const { playerID, credentials } = JSON.parse(stored!) as {
      playerID: string;
      credentials: string;
    };
    expect(playerID).toBe("0");
    expect(credentials).toBe("creds-xyz");
  });

  it("shows error message when game creation fails", async () => {
    mswServer.use(
      http.get("/api/maps", () => HttpResponse.json(MAP_LIST)),
      http.get("/api/maps/map-1", () =>
        HttpResponse.json({ id: "map-1", data: CANONICAL_MAP }),
      ),
      http.post("/games/triplanetary/create", () =>
        HttpResponse.json({ error: "server error" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderLobby();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Create Game" })).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Create Game" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Failed to create game");
  });

  it("joins an existing match, stores credentials, and navigates", async () => {
    mswServer.use(
      http.get("/games/triplanetary", () =>
        HttpResponse.json({
          matches: [
            {
              matchID: "match-xyz",
              players: {},
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      ),
      http.get("/games/triplanetary/match-xyz", () =>
        HttpResponse.json({
          players: [
            { id: 0, name: "Player 1" },
            { id: 1 },
          ],
        }),
      ),
      http.post("/games/triplanetary/match-xyz/join", () =>
        HttpResponse.json({ playerCredentials: "creds-p2" }),
      ),
    );

    const user = userEvent.setup();
    renderLobby();

    const joinBtn = await screen.findByRole("button", { name: "Join" });
    await user.click(joinBtn);

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/game/match-xyz"),
    );

    const stored = sessionStorage.getItem("bgio-match-xyz");
    expect(stored).not.toBeNull();
    const { playerID, credentials } = JSON.parse(stored!) as {
      playerID: string;
      credentials: string;
    };
    expect(playerID).toBe("1");
    expect(credentials).toBe("creds-p2");
  });
});
