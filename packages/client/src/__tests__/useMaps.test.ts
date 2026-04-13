import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createElement } from "react";
import { useMaps, useMap, useCreateMap, useUpdateMap } from "../hooks/useMaps";
import type { MapSummary, MapDetail } from "../hooks/useMaps";
import type { HexData } from "@triplanetary/shared";

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function wrapper(qc: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

const BLANK: HexData = {
  meta: { name: "Test", version: "1.0", hexSize: 48, orientation: "pointy" },
  bodies: {},
  hexes: {},
  bases: {},
};

const MAP_SUMMARY: MapSummary = {
  id: "abc",
  name: "Test Map",
  version: "1.0",
  isCanonical: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MAP_DETAIL: MapDetail = { ...MAP_SUMMARY, data: BLANK };

describe("useMaps", () => {
  it("fetches map list", async () => {
    mswServer.use(
      http.get("/api/maps", () => HttpResponse.json([MAP_SUMMARY])),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useMaps(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0]!.id).toBe("abc");
  });
});

describe("useMap", () => {
  it("fetches map detail when id is provided", async () => {
    mswServer.use(
      http.get("/api/maps/abc", () => HttpResponse.json(MAP_DETAIL)),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useMap("abc"), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe("abc");
  });

  it("does not fetch when id is null", async () => {
    let called = false;
    mswServer.use(
      http.get("/api/maps/:id", () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useMap(null), { wrapper: wrapper(qc) });
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });

  it("does not fetch when id is empty string", async () => {
    let called = false;
    mswServer.use(
      http.get("/api/maps/", () => {
        called = true;
        return HttpResponse.json({});
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useMap(""), { wrapper: wrapper(qc) });
    await new Promise((r) => setTimeout(r, 50));
    expect(called).toBe(false);
  });
});

describe("useCreateMap", () => {
  it("posts to /api/maps and invalidates maps query", async () => {
    let listCallCount = 0;
    mswServer.use(
      http.post("/api/maps", async () =>
        HttpResponse.json(MAP_DETAIL, { status: 201 }),
      ),
      http.get("/api/maps", () => {
        listCallCount++;
        return HttpResponse.json([MAP_SUMMARY]);
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Prime the cache
    const { result: listResult } = renderHook(() => useMaps(), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    const countBefore = listCallCount;

    const { result } = renderHook(() => useCreateMap(), {
      wrapper: wrapper(qc),
    });
    await act(async () => {
      await result.current.mutateAsync({
        name: "New",
        version: "1.0",
        data: BLANK,
      });
    });

    // Cache should have been invalidated, triggering a refetch
    await waitFor(() => expect(listCallCount).toBeGreaterThan(countBefore));
  });
});

describe("useUpdateMap", () => {
  it("puts to /api/maps/:id and invalidates that map query", async () => {
    let detailCallCount = 0;
    mswServer.use(
      http.put("/api/maps/abc", async () => HttpResponse.json(MAP_DETAIL)),
      http.get("/api/maps/abc", () => {
        detailCallCount++;
        return HttpResponse.json(MAP_DETAIL);
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // Prime the cache
    const { result: mapResult } = renderHook(() => useMap("abc"), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(mapResult.current.isSuccess).toBe(true));
    const countBefore = detailCallCount;

    const { result } = renderHook(() => useUpdateMap("abc"), {
      wrapper: wrapper(qc),
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "Updated" });
    });

    await waitFor(() => expect(detailCallCount).toBeGreaterThan(countBefore));
  });
});
