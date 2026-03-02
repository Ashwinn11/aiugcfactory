"use client";

import { useState, useCallback, useRef } from "react";
import ImageUpload from "@/components/ImageUpload";
import StyleSelector from "@/components/StyleSelector";
import BeforeAfter from "@/components/BeforeAfter";
import ChatRefine from "@/components/ChatRefine";
import GeneratingOverlay from "@/components/GeneratingOverlay";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConversationTurn = any;

export default function Home() {
  const [originalImage, setOriginalImage] = useState("");
  const [originalMimeType, setOriginalMimeType] = useState("");
  const [restyledImage, setRestyledImage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentStyle, setCurrentStyle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Undo stack: each entry is a snapshot before a refinement
  const [undoStack, setUndoStack] = useState<
    Array<{ image: string; messages: ChatMessage[]; history: ConversationTurn[] }>
  >([]);

  // User-only history passed to refine API.
  // Server sanitizes history and avoids replaying model thought parts.
  const conversationHistory = useRef<ConversationTurn[]>([]);
  const styleRequestId = useRef(0);

  const handleImageSelected = useCallback(
    (base64: string, mimeType: string) => {
      styleRequestId.current += 1;
      setOriginalImage(base64);
      setOriginalMimeType(mimeType);
      setRestyledImage("");
      setChatMessages([]);
      setError("");
      setCurrentStyle("");
      setSuggestions([]);
      setUndoStack([]);
      conversationHistory.current = [];
    },
    []
  );

  const handleStyleSelected = useCallback(
    async (style: string, customPrompt?: string) => {
      if (!originalImage) return;
      const requestId = ++styleRequestId.current;
      setIsGenerating(true);
      setError("");
      setRestyledImage("");
      setChatMessages([]);
      setCurrentStyle(style);
      setSuggestions([]);
      setUndoStack([]);
      conversationHistory.current = [];

      try {
        const res = await fetch("/api/restyle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: originalImage,
            mimeType: originalMimeType,
            style,
            customPrompt,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        if (requestId !== styleRequestId.current) return;
        setRestyledImage(data.image);

        // Seed user-only history for future refine calls.
        conversationHistory.current = [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: originalMimeType, data: originalImage } },
              { text: `Restyle this room in ${style} style.` },
            ],
          },
        ];

        if (data.text) {
          setChatMessages([{ role: "assistant", text: data.text }]);
        }

        // Fetch suggestions after the image is shown so restyle latency stays low.
        void (async () => {
          try {
            const suggestionsRes = await fetch("/api/suggestions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image: data.image,
                mimeType: "image/png",
                style,
                customPrompt,
              }),
            });

            if (!suggestionsRes.ok || requestId !== styleRequestId.current) return;
            const suggestionsData = await suggestionsRes.json();
            if (requestId === styleRequestId.current && suggestionsData.suggestions) {
              setSuggestions(suggestionsData.suggestions);
            }
          } catch {
            // Suggestions are optional; ignore failures.
          }
        })();
      } catch (err) {
        if (requestId !== styleRequestId.current) return;
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        if (requestId === styleRequestId.current) {
          setIsGenerating(false);
        }
      }
    },
    [originalImage, originalMimeType]
  );

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRestyledImage(prev.image);
    setChatMessages(prev.messages);
    conversationHistory.current = prev.history;
    setUndoStack((stack) => stack.slice(0, -1));
  }, [undoStack]);

  const handleRefine = useCallback(
    async (message: string) => {
      if (!restyledImage) return;

      // Snapshot current state for undo
      setUndoStack((stack) => [
        ...stack,
        {
          image: restyledImage,
          messages: chatMessages,
          history: [...conversationHistory.current],
        },
      ]);

      setChatMessages((prev) => [...prev, { role: "user", text: message }]);
      setIsGenerating(true);
      setError("");

      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            history: conversationHistory.current,
            message,
            currentImage: restyledImage,
            currentImageMimeType: "image/png",
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Refinement failed");

        // Append user-only refine turn; server composes full prompt.
        conversationHistory.current.push({
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: restyledImage } },
            { text: `Edit this room image: ${message}` },
          ],
        });

        setRestyledImage(data.image);
        if (data.text) {
          setChatMessages((prev) => [
            ...prev,
            { role: "assistant", text: data.text },
          ]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Failed to refine. Try again." },
        ]);
      } finally {
        setIsGenerating(false);
      }
    },
    [restyledImage, chatMessages]
  );

  return (
    <main className="min-h-screen bg-charcoal flex flex-col">
      {/* Header */}
      <header className="border-b border-warm-gray/25 bg-charcoal-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-cream">
              Room Restyler
            </h1>
            <p className="text-warm-gray-light text-sm mt-1 font-light">
              Reimagine any space in a new design language
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-warm-gray-light text-[10px] uppercase tracking-[0.15em]">
            <div className="w-1.5 h-1.5 rounded-full bg-sage/60" />
            Powered by Gemini
          </div>
        </div>
      </header>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="w-full space-y-6 sm:space-y-10">
          {/* Step 1: Upload */}
          <section className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                01
              </span>
              <div className="h-px flex-1 bg-warm-gray/30" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                Upload
              </span>
            </div>
            <ImageUpload
              onImageSelected={handleImageSelected}
              currentImage={originalImage}
            />
          </section>

          {/* Step 2: Style */}
          {originalImage && (
            <section className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6" style={{ animationDelay: "40ms" }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  02
                </span>
                <div className="h-px flex-1 bg-warm-gray/30" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                  Style
                </span>
              </div>
              <StyleSelector
                onStyleSelected={handleStyleSelected}
                disabled={isGenerating}
              />
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="border border-red-900/30 bg-red-950/20 rounded-lg px-5 py-4 text-red-300 text-sm animate-fade-up">
              {error}
            </div>
          )}

          {/* Step 3: Results */}
          {restyledImage && (
            <section className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6" style={{ animationDelay: "40ms" }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  03
                </span>
                <div className="h-px flex-1 bg-warm-gray/30" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                  {currentStyle}
                </span>
              </div>

              <BeforeAfter before={originalImage} after={restyledImage} />

              {/* Undo button */}
              {undoStack.length > 0 && !isGenerating && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-terracotta hover:bg-terracotta/20 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-terracotta/60"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
                      />
                    </svg>
                    Undo last change
                  </button>
                </div>
              )}

              <div className="mt-8">
                <ChatRefine
                  onSendMessage={handleRefine}
                  messages={chatMessages}
                  isLoading={isGenerating}
                  suggestions={suggestions}
                />
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Loading modal */}
      {isGenerating && (
        <GeneratingOverlay
          text={restyledImage ? "Refining your room" : "Restyling your room"}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-warm-gray/25 mt-auto bg-charcoal-light">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-warm-gray-light">
          <span>Room Restyler</span>
          <span>AI Interior Design</span>
        </div>
      </footer>
    </main>
  );
}
