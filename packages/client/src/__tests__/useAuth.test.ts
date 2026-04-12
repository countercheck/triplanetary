import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createElement } from "react";
import { useAuth } from "../hooks/useAuth";

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

function wrapper(qc: QueryClient) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children);
  }
  return Wrapper;
}

describe("useAuth", () => {
  it("returns user data when authenticated", async () => {
    const user = {
      id: "1",
      email: "a@a.com",
      displayName: "Alice",
      isAdmin: false,
    };
    mswServer.use(http.get("/api/auth/me", () => HttpResponse.json(user)));
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(user);
  });

  it("surfaces error with status when unauthenticated (401)", async () => {
    mswServer.use(
      http.get("/api/auth/me", () =>
        HttpResponse.json({ error: "Not authenticated" }, { status: 401 }),
      ),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as { status?: number })?.status).toBe(401);
  });

  it("does not retry on failure", async () => {
    let callCount = 0;
    mswServer.use(
      http.get("/api/auth/me", () => {
        callCount++;
        return HttpResponse.json({ error: "fail" }, { status: 401 });
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(callCount).toBe(1);
  });

  it("caches result within staleTime (single network call for two renders)", async () => {
    let callCount = 0;
    mswServer.use(
      http.get("/api/auth/me", () => {
        callCount++;
        return HttpResponse.json({
          id: "2",
          email: "b@b.com",
          displayName: "Bob",
          isAdmin: false,
        });
      }),
    );
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result: r1 } = renderHook(() => useAuth(), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(r1.current.isSuccess).toBe(true));

    const { result: r2 } = renderHook(() => useAuth(), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    expect(callCount).toBe(1);
  });
});
