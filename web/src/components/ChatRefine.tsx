"use client";

import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

interface ChatRefineProps {
  onSendMessage: (message: string) => Promise<void>;
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
    setInput("");
    await onSendMessage(msg);
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    onSendMessage(text);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-warm-gray/10" />
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-warm-gray font-medium">
          Refine your design
        </h3>
        <div className="h-px flex-1 bg-warm-gray/10" />
      </div>

      {/* Quick suggestions when no messages yet */}
      {messages.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs text-warm-gray border border-warm-gray/15 rounded-full hover:border-warm-gray/40 hover:text-cream transition-all duration-200 cursor-pointer disabled:opacity-30"
            >
              {s}
            </button>
          ))}
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
              className={`text-sm px-4 py-2.5 max-w-[85%] w-fit animate-fade-up ${
                msg.role === "user"
                  ? "ml-auto bg-terracotta/15 text-cream border border-terracotta/20 rounded-2xl rounded-br-sm"
                  : "bg-charcoal-light text-warm-gray-light border border-warm-gray/10 rounded-2xl rounded-bl-sm"
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {msg.text}
            </div>
          ))}
          {isLoading && (
            <div className="bg-charcoal-light text-warm-gray border border-warm-gray/10 rounded-2xl rounded-bl-sm px-4 py-2.5 w-fit text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-warm-gray/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe a change..."
          disabled={isLoading}
          className="flex-1 bg-transparent border-b border-warm-gray/20 focus:border-terracotta px-0 py-3 text-sm text-cream placeholder:text-warm-gray/30 focus:outline-none transition-colors disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="group relative p-2.5 text-warm-gray hover:text-terracotta disabled:text-warm-gray/20 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          <svg
            className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
