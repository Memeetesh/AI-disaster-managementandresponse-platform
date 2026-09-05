import { apiFetch } from "@/lib/api";
import type { Shelter } from "@/types";

export function listShelters(token: string): Promise<Shelter[]> {
  return apiFetch<Shelter[]>("/shelters", {}, token);
}
