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

  // Full Gemini conversation history for multi-turn refinement
  const conversationHistory = useRef<ConversationTurn[]>([]);

  const handleImageSelected = useCallback(
    (base64: string, mimeType: string) => {
      setOriginalImage(base64);
      setOriginalMimeType(mimeType);
      setRestyledImage("");
      setChatMessages([]);
      setError("");
      setCurrentStyle("");
      setSuggestions([]);
      conversationHistory.current = [];
    },
    []
  );

  const handleStyleSelected = useCallback(
    async (style: string, customPrompt?: string) => {
      if (!originalImage) return;
      setIsGenerating(true);
      setError("");
      setRestyledImage("");
      setChatMessages([]);
      setCurrentStyle(style);
      setSuggestions([]);
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
        setRestyledImage(data.image);

        // Seed conversation history with the initial restyle exchange.
        // Model parts include thought_signatures required by gemini-3.1-flash
        // for multi-turn — we must pass them back verbatim.
        conversationHistory.current = [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: originalMimeType, data: originalImage } },
              { text: `Restyle this room in ${style} style.` },
            ],
          },
          {
            role: "model",
            parts: data.modelParts,
          },
        ];

        if (data.suggestions) {
          setSuggestions(data.suggestions);
        }
        if (data.text) {
          setChatMessages([{ role: "assistant", text: data.text }]);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [originalImage, originalMimeType]
  );

  const handleRefine = useCallback(
    async (message: string) => {
      if (!restyledImage) return;
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

        // Append this exchange to conversation history.
        // Use raw modelParts to preserve thought_signatures.
        conversationHistory.current.push(
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/png", data: restyledImage } },
              { text: `Edit this room image: ${message}. Keep the same room layout and camera angle. Make only the requested changes. Photorealistic result.` },
            ],
          },
          {
            role: "model",
            parts: data.modelParts,
          }
        );

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
    [restyledImage]
  );

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-warm-gray/10">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-cream">
              Room Restyler
            </h1>
            <p className="text-warm-gray text-sm mt-1 font-light">
              Reimagine any space in a new design language
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-warm-gray/40 text-[10px] uppercase tracking-[0.15em]">
            <div className="w-1.5 h-1.5 rounded-full bg-sage/60" />
            Powered by Gemini
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="space-y-10">
          {/* Step 1: Upload */}
          <section className="animate-fade-up">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                01
              </span>
              <div className="h-px flex-1 bg-warm-gray/10" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray/40">
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
            <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  02
                </span>
                <div className="h-px flex-1 bg-warm-gray/10" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray/40">
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

          {/* Generating */}
          {isGenerating && !restyledImage && (
            <section className="border border-warm-gray/10 rounded-lg animate-fade-up">
              <GeneratingOverlay />
            </section>
          )}

          {/* Step 3: Results */}
          {restyledImage && (
            <section className="animate-fade-up" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  03
                </span>
                <div className="h-px flex-1 bg-warm-gray/10" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray/40">
                  {currentStyle}
                </span>
              </div>

              <BeforeAfter before={originalImage} after={restyledImage} />

              {isGenerating && (
                <div className="mt-6 border border-warm-gray/10 rounded-lg">
                  <GeneratingOverlay text="Refining your room" />
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

      {/* Footer */}
      <footer className="border-t border-warm-gray/5 mt-20">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-warm-gray/30">
          <span>Room Restyler</span>
          <span>AI Interior Design</span>
        </div>
      </footer>
    </main>
  );
}
