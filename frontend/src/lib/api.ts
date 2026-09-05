import type { ApiErrorBody } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractMessage(body: unknown): string {
  const detail = (body as ApiErrorBody | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail[0].msg;
  return "Something went wrong. Please try again.";
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError(res.status, extractMessage(body));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Thin fetch wrapper: attaches the JWT (if present), parses JSON, and
 * normalizes backend errors into ApiError. The frontend never talks to the
 * database or any external API directly — everything goes through FastAPI.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  return handleResponse<T>(res);
}

/**
 * Same as apiFetch but for multipart/form-data (file uploads) — the
 * Content-Type header (with its boundary) is left for the browser to set,
 * never fixed to "application/json" here.
 */
export async function apiFetchForm<T>(
  path: string,
  formData: FormData,
  token?: string | null,
  method: string = "POST"
): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { method, body: formData, headers });
  return handleResponse<T>(res);
}
