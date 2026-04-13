const BASE = "/api";

export async function apiRequest<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: options?.method ?? "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(options?.body !== undefined
      ? { body: JSON.stringify(options.body) }
      : {}),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`${res.status} ${res.statusText}`), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "POST", body }),
};
