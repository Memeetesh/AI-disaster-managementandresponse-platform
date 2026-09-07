import { apiFetch } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  source: "llm" | "fallback" | "error";
}

export function sendSupportChat(
  messages: ChatMessage[],
  token: string
): Promise<ChatResponse> {
  return apiFetch<ChatResponse>(
    "/chat/support",
    { method: "POST", body: JSON.stringify({ messages }) },
    token
  );
}
