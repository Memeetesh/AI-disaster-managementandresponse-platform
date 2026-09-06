import { apiFetch } from "@/lib/api";
import type { AuthResponse, User } from "@/types";

export function registerCitizen(input: {
  name: string;
  phone: string;
  email?: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function login(input: { phone: string; password: string }): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function fetchMe(token: string): Promise<User> {
  return apiFetch<User>("/auth/me", {}, token);
}
