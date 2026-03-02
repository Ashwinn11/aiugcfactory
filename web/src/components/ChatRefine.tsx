"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage, ElementFilter } from "@/lib/types";

const ELEMENT_FILTERS: { key: ElementFilter; label: string }[] = [
  { key: null, label: "All" },
  { key: "walls", label: "Walls only" },
  { key: "floor", label: "Floor only" },
  { key: "furniture", label: "Furniture only" },
];

interface ChatRefineProps {
  onSendMessage: (message: string, elementFilter?: ElementFilter) => Promise<void>;
  messages: ChatMessage[];
  isLoading: boolean;
  suggestions: string[];
}

export default function ChatRefine({
  onSendMessage,
  messages,
  isLoading,
  suggestions,
}: ChatRefineProps) {
  const [input, setInput] = useState("");
  const [activeFilter, setActiveFilter] = useState<ElementFilter>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = input.trim();
    if (!msg || isLoading) return;
    const filter = activeFilter;
    setInput("");
    setActiveFilter(null);
    await onSendMessage(msg, filter);
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    const filter = activeFilter;
    setActiveFilter(null);
    onSendMessage(text, filter);
  };

  return (
    <div className="space-y-4 bg-charcoal-light border border-warm-gray/30 rounded-lg p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-warm-gray/30" />
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light font-medium">
          Refine your design
        </h3>
        <div className="h-px flex-1 bg-warm-gray/30" />
      </div>
      <p className="text-[11px] text-warm-gray-light/70">
        Describe what you want to change in plain language. Each edit creates a new version you can undo.
      </p>

      {/* Quick suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light">
            Quick ideas
          </p>
          <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={isLoading}
              className="px-4 py-2 min-h-10 text-sm sm:text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-terracotta hover:bg-terracotta/20 transition-all duration-150 cursor-pointer disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-terracotta/60"
            >
              {s}
            </button>
          ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="space-y-2.5 max-h-52 overflow-y-auto chat-scroll pr-1"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm px-4 py-2.5 max-w-[92%] sm:max-w-[85%] w-fit animate-fade-up ${
                msg.role === "user"
                  ? "ml-auto bg-terracotta/30 text-cream border border-terracotta/50 rounded-2xl rounded-br-sm"
                  : "bg-charcoal text-cream border border-warm-gray/35 rounded-2xl rounded-bl-sm"
              }`}
              style={{ animationDelay: `${i * 24}ms` }}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="bg-charcoal text-warm-gray-light border border-warm-gray/30 rounded-2xl rounded-bl-sm px-4 py-2.5 w-fit text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Element filter pills */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light">
          Focus on
        </p>
        <p className="text-[11px] text-warm-gray-light/70 mb-1">
          Limit your edit to a specific part of the room. &quot;All&quot; lets AI change anything. Resets after each message.
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {ELEMENT_FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              disabled={isLoading}
              className={`px-3 py-1.5 text-[11px] rounded-full border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
                activeFilter === f.key
                  ? "border-terracotta bg-terracotta/20 text-cream"
                  : "border-warm-gray/30 text-warm-gray-light hover:border-warm-gray/50 hover:text-cream"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-stretch sm:items-end">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a change..."
          disabled={isLoading}
          className="flex-1 bg-charcoal border border-warm-gray/40 focus:border-terracotta rounded-md px-3 py-3 text-sm text-cream placeholder:text-warm-gray-light/70 focus:outline-none focus:ring-2 focus:ring-terracotta/40 transition-colors disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="group relative min-w-11 min-h-11 p-2.5 rounded-md bg-terracotta text-cream hover:bg-terracotta-light disabled:bg-warm-gray/40 disabled:text-warm-gray/90 transition-colors cursor-pointer disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60"
        >
          <svg
            className="w-5 h-5 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
