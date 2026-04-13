import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import MapEditorPage from "../pages/admin/MapEditorPage";
import type { MapDetail } from "../hooks/useMaps";
import type { HexData } from "@triplanetary/shared";

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

const BLANK: HexData = {
  meta: { name: "New Map", version: "1.0", hexSize: 48, orientation: "pointy" },
  bodies: {},
  hexes: {},
  bases: {},
};

const SAVED_MAP: MapDetail = {
  id: "map-1",
  name: "Saved Map",
  version: "1.0",
  isCanonical: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  data: { ...BLANK, meta: { ...BLANK.meta, name: "Saved Map" } },
};

function renderEditor(search = "") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/map-editor${search}`]}>
        <Routes>
          <Route path="/admin/map-editor" element={<MapEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MapEditorPage", () => {
  it("renders the editor header with default map name", () => {
    renderEditor();
    expect(screen.getByText("Map Editor")).toBeInTheDocument();
    expect(screen.getByText("New Map")).toBeInTheDocument();
  });

  it("Save button is disabled when map is not dirty", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("loads an existing map when ?id= is present", async () => {
    mswServer.use(
      http.get("/api/maps/map-1", () => HttpResponse.json(SAVED_MAP)),
    );
    renderEditor("?id=map-1");
    await waitFor(() =>
      expect(screen.getByText("Saved Map")).toBeInTheDocument(),
    );
  });

  it("calls POST /api/maps on save for new map and updates URL", async () => {
    const user = userEvent.setup();
    let posted = false;
    mswServer.use(
      http.post("/api/maps", async () => {
        posted = true;
        return HttpResponse.json(
          { ...SAVED_MAP, id: "new-map-id" },
          { status: 201 },
        );
      }),
      // Handle the GET that fires after setSearchParams updates the URL
      http.get("/api/maps/new-map-id", () =>
        HttpResponse.json({ ...SAVED_MAP, id: "new-map-id" }),
      ),
    );
    const { container } = renderEditor();

    // Switch to asteroid mode so hex clicks dirty the map
    await user.click(screen.getByRole("radio", { name: /asteroid/i }));
    const polygon = container.querySelector("polygon");
    await user.click(polygon!);

    // Save button becomes enabled once the map is dirty
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(posted).toBe(true));
    // After setSearchParams({ id: "new-map-id" }), useMap fires GET /api/maps/new-map-id
    // and loads the saved map — confirming the URL was updated
    await waitFor(() =>
      expect(screen.getByText("Saved Map")).toBeInTheDocument(),
    );
  });

  it("shows Export button that is always enabled", () => {
    renderEditor();
    expect(screen.getByRole("button", { name: /export/i })).toBeEnabled();
  });

  it("calls PUT /api/maps/:id on save for existing map", async () => {
    const user = userEvent.setup();
    let putCalled = false;
    mswServer.use(
      http.get("/api/maps/map-1", () => HttpResponse.json(SAVED_MAP)),
      http.put("/api/maps/map-1", async () => {
        putCalled = true;
        return HttpResponse.json(SAVED_MAP);
      }),
    );
    const { container } = renderEditor("?id=map-1");
    await waitFor(() =>
      expect(screen.getByText("Saved Map")).toBeInTheDocument(),
    );
    expect(putCalled).toBe(false); // no spurious PUT on load

    // Switch to asteroid mode and click a hex to dirty the map
    await user.click(screen.getByRole("radio", { name: /asteroid/i }));
    const polygon = container.querySelector("polygon");
    await user.click(polygon!);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(putCalled).toBe(true));
  });
});
