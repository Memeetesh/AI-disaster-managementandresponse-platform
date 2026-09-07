"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/citizen/Icon";
import { useSupportChat } from "@/lib/queries";
import type { ChatMessage } from "@/lib/chat-api";

const GREETING: ChatMessage = {
  role: "assistant",
  content: "Hi, I'm Saathi. I'm here to listen — no rush. How are you feeling right now?",
};

export function SupportChat({ onClose }: { onClose: () => void }) {
  const chat = useSupportChat();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chat.isPending]);

  function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || chat.isPending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    chat.mutate(
      next.filter((m) => m !== GREETING),
      {
        onSuccess: (res) =>
          setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]),
        onError: () =>
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "I'm having trouble responding right now. If this feels urgent, please call 112, " +
                "iCall on 9152987821, or the Vandrevala Foundation on 1860-2662-345.",
            },
          ]),
      }
    );
  }

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-[560px] max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate2-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-support-50">
              <Icon name="Heart" className="h-5 w-5 text-support-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-900">Talk to Saathi</p>
              <p className="text-[11px] text-slate2-500">A supportive AI companion</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate2-400 transition-colors hover:text-slate2-600">
            <Icon name="X" className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-support-50/60 px-5 py-2 text-[11px] leading-snug text-support-700">
          Saathi is an AI companion — not a human volunteer or a substitute for professional care.
          In a crisis, call <span className="font-semibold">112</span>.
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-navy-700 text-white"
                    : "bg-slate2-100 text-navy-900"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {chat.isPending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate2-100 px-3.5 py-2 text-sm text-slate2-500">
                Saathi is typing…
              </div>
            </div>
          )}
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-slate2-100 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type how you're feeling…"
            maxLength={2000}
            className="input flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || chat.isPending}
            className="btn bg-support-600 text-white hover:bg-support-700 disabled:opacity-50"
            aria-label="Send"
          >
            <Icon name="Send" className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
