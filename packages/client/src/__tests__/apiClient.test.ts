import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { apiRequest, apiClient } from "../lib/apiClient";

const mswServer = setupServer();
beforeAll(() => mswServer.listen());
afterAll(() => mswServer.close());

describe("apiRequest", () => {
  it("returns parsed JSON on success", async () => {
    mswServer.use(http.get("/api/test", () => HttpResponse.json({ ok: true })));
    const result = await apiRequest<{ ok: boolean }>("/test");
    expect(result).toEqual({ ok: true });
  });

  it("throws with status on 401", async () => {
    mswServer.use(
      http.get("/api/unauth", () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 }),
      ),
    );
    await expect(apiRequest("/unauth")).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("401"),
    });
  });

  it("throws with status on 404", async () => {
    mswServer.use(
      http.get("/api/notfound", () =>
        HttpResponse.json({ error: "Not found" }, { status: 404 }),
      ),
    );
    await expect(apiRequest("/notfound")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("throws with status on 500", async () => {
    mswServer.use(
      http.get("/api/boom", () =>
        HttpResponse.json({ error: "Server error" }, { status: 500 }),
      ),
    );
    await expect(apiRequest("/boom")).rejects.toMatchObject({ status: 500 });
  });

  it("sends POST body as JSON", async () => {
    let captured: unknown;
    mswServer.use(
      http.post("/api/echo", async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ received: true });
      }),
    );
    await apiRequest("/echo", { method: "POST", body: { name: "test" } });
    expect(captured).toEqual({ name: "test" });
  });

  it("sends credentials: include on every request", async () => {
    let credentialsSeen: string | null = null;
    mswServer.use(
      http.get("/api/creds", ({ request }) => {
        credentialsSeen = request.credentials;
        return HttpResponse.json({});
      }),
    );
    await apiRequest("/creds");
    expect(credentialsSeen).toBe("include");
  });
});

describe("apiClient helpers", () => {
  it("apiClient.get delegates to apiRequest GET", async () => {
    mswServer.use(http.get("/api/me", () => HttpResponse.json({ id: "1" })));
    const result = await apiClient.get<{ id: string }>("/me");
    expect(result.id).toBe("1");
  });

  it("apiClient.post delegates to apiRequest POST", async () => {
    mswServer.use(
      http.post("/api/create", async () =>
        HttpResponse.json({ created: true }, { status: 201 }),
      ),
    );
    const result = await apiClient.post<{ created: boolean }>("/create", {
      x: 1,
    });
    expect(result.created).toBe(true);
  });
});
