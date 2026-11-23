import "dotenv/config";

export interface ApiJsonResponse<T = unknown> {
  ok: boolean;
  message: string;
  data: T;
  code?: string;
  errors?: Record<string, string[]>;
}

export const BASE_URL =
  process.env.API_TEST_URL ?? "http://localhost:3000/api/v1";

export async function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    token?: string;
  } = {}
): Promise<{ status: number; body: ApiJsonResponse<T> }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });

  const body = (await res.json()) as ApiJsonResponse<T>;
  return { status: res.status, body };
}