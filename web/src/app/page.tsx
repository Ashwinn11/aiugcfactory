"use client";

import { useState, useCallback, useRef } from "react";
import ImageUpload from "@/components/ImageUpload";
import StyleSelector from "@/components/StyleSelector";
import ColorPicker from "@/components/ColorPicker";
import ModeTabs from "@/components/ModeTabs";
import BeforeAfter from "@/components/BeforeAfter";
import ChatRefine from "@/components/ChatRefine";
import GeneratingOverlay from "@/components/GeneratingOverlay";
import VariationsGrid from "@/components/VariationsGrid";
import DownloadButton from "@/components/DownloadButton";
import MoodBoard from "@/components/MoodBoard";
import type {
  AppMode,
  ChatMessage,
  Snapshot,
  ConversationTurn,
  ElementFilter,
  MoodBoardData,
} from "@/lib/types";

export default function Home() {
  const [originalImage, setOriginalImage] = useState("");
  const [originalMimeType, setOriginalMimeType] = useState("");
  const [restyledImage, setRestyledImage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentStyle, setCurrentStyle] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Mode
  const [mode, setMode] = useState<AppMode>("restyle");

  // Paint mode state
  const [paintColor, setPaintColor] = useState("");
  const [paintFinish, setPaintFinish] = useState("Matte");

  // Variations
  const [variations, setVariations] = useState<
    { image: string; text?: string }[]
  >([]);
  const [showVariations, setShowVariations] = useState(false);
  const [variationsLoading, setVariationsLoading] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<number | null>(
    null
  );

  // Mood board
  const [moodBoard, setMoodBoard] = useState<MoodBoardData | null>(null);
  const [moodBoardLoading, setMoodBoardLoading] = useState(false);

  // Version history for undo/redo
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const [versionIndex, setVersionIndex] = useState(-1);

  const conversationHistory = useRef<ConversationTurn[]>([]);
  const styleRequestId = useRef(0);

  const resetGenerationState = useCallback(() => {
    setRestyledImage("");
    setChatMessages([]);
    setError("");
    setCurrentStyle("");
    setSuggestions([]);
    setVersions([]);
    setVersionIndex(-1);
    setVariations([]);
    setShowVariations(false);
    setSelectedVariation(null);
    setMoodBoard(null);
    setMoodBoardLoading(false);
    conversationHistory.current = [];
  }, []);

  const handleImageSelected = useCallback(
    (base64: string, mimeType: string) => {
      styleRequestId.current += 1;
      setOriginalImage(base64);
      setOriginalMimeType(mimeType);
      resetGenerationState();
    },
    [resetGenerationState]
  );

  const handleModeChange = useCallback(
    (newMode: AppMode) => {
      setMode(newMode);
      resetGenerationState();
    },
    [resetGenerationState]
  );

  const fetchMoodBoard = useCallback(
    (imageData: string, requestId: number) => {
      setMoodBoardLoading(true);
      void (async () => {
        try {
          const res = await fetch("/api/moodboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageData, mimeType: "image/png" }),
          });
          if (!res.ok || requestId !== styleRequestId.current) return;
          const data = await res.json();
          if (requestId === styleRequestId.current) {
            setMoodBoard(data);
          }
        } catch {
          // Mood board is optional
        } finally {
          if (requestId === styleRequestId.current) {
            setMoodBoardLoading(false);
          }
        }
      })();
    },
    []
  );

  const handleStyleSelected = useCallback(
    async (style: string, customPrompt?: string) => {
      if (!originalImage) return;
      const requestId = ++styleRequestId.current;
      setIsGenerating(true);
      setError("");
      resetGenerationState();
      setCurrentStyle(style);

      try {
        const body: Record<string, string> = {
          image: originalImage,
          mimeType: originalMimeType,
          style,
          mode,
        };
        if (customPrompt) body.customPrompt = customPrompt;

        const res = await fetch("/api/restyle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        if (requestId !== styleRequestId.current) return;
        setRestyledImage(data.image);

        const initialHistory = [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: originalMimeType,
                  data: originalImage,
                },
              },
              {
                text: `Restyle this room in ${style} style.`,
              },
            ],
          },
        ];
        conversationHistory.current = initialHistory;

        const initialMessages: ChatMessage[] = data.text
          ? [{ role: "assistant", text: data.text }]
          : [];
        setChatMessages(initialMessages);

        setVersions([
          {
            image: data.image,
            messages: initialMessages,
            history: [...initialHistory],
          },
        ]);
        setVersionIndex(-1);

        // Fetch suggestions and mood board async
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
            if (!suggestionsRes.ok || requestId !== styleRequestId.current)
              return;
            const suggestionsData = await suggestionsRes.json();
            if (
              requestId === styleRequestId.current &&
              suggestionsData.suggestions
            ) {
              setSuggestions(suggestionsData.suggestions);
            }
          } catch {
            // Suggestions are optional
          }
        })();

        fetchMoodBoard(data.image, requestId);
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
    [originalImage, originalMimeType, mode, resetGenerationState, fetchMoodBoard]
  );

  const handlePaintSelected = useCallback(
    async (colorHex: string, finish: string) => {
      setPaintColor(colorHex);
      setPaintFinish(finish);

      if (!originalImage) return;
      const requestId = ++styleRequestId.current;
      setIsGenerating(true);
      setError("");
      setRestyledImage("");
      setChatMessages([]);
      setSuggestions([]);
      setVersions([]);
      setVersionIndex(-1);
      setVariations([]);
      setShowVariations(false);
      setSelectedVariation(null);
      setMoodBoard(null);
      setCurrentStyle(`${colorHex} ${finish}`);
      conversationHistory.current = [];

      try {
        const res = await fetch("/api/restyle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: originalImage,
            mimeType: originalMimeType,
            mode: "paint",
            colorHex,
            finish,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Generation failed");
        if (requestId !== styleRequestId.current) return;
        setRestyledImage(data.image);
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

  // Track whether user has made chat edits since picking a variation
  const hasEditsAfterVariation =
    variations.length > 0 && selectedVariation !== null && versions.length > 1;

  // Variations
  const handleGenerateVariations = useCallback(async () => {
    if (!originalImage) return;

    // Warn if user has refined since selecting a variation
    if (hasEditsAfterVariation) {
      const confirmed = window.confirm(
        "You have chat edits on this variation. Regenerating will discard them and create 4 fresh options from your original image. Continue?"
      );
      if (!confirmed) return;
    }

    setVariationsLoading(true);
    setShowVariations(true);
    setSelectedVariation(null);
    setVariations([]);

    try {
      const body: Record<string, string> = {
        image: originalImage,
        mimeType: originalMimeType,
        mode,
      };
      if (mode === "paint") {
        body.colorHex = paintColor;
        body.finish = paintFinish;
      } else {
        body.style = currentStyle;
      }

      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setVariations(data.variations || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate variations"
      );
      setShowVariations(false);
    } finally {
      setVariationsLoading(false);
    }
  }, [originalImage, originalMimeType, mode, currentStyle, paintColor, paintFinish, hasEditsAfterVariation]);

  const handleVariationSelect = useCallback(
    (variation: { image: string; text?: string }) => {
      const idx = variations.indexOf(variation);
      setSelectedVariation(idx);
      setRestyledImage(variation.image);
      setShowVariations(false);

      // Reset chat for the selected variation
      const initialMessages: ChatMessage[] = variation.text
        ? [{ role: "assistant", text: variation.text }]
        : [];
      setChatMessages(initialMessages);

      const initialHistory = [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: originalMimeType,
                data: originalImage,
              },
            },
            { text: `Selected variation for ${currentStyle}.` },
          ],
        },
      ];
      conversationHistory.current = initialHistory;

      setVersions([
        {
          image: variation.image,
          messages: initialMessages,
          history: [...initialHistory],
        },
      ]);
      setVersionIndex(-1);

      fetchMoodBoard(variation.image, styleRequestId.current);
    },
    [variations, originalMimeType, originalImage, currentStyle, fetchMoodBoard]
  );

  const handleBackToVariations = useCallback(() => {
    setShowVariations(true);
  }, []);

  const canUndo =
    versionIndex > 0 || (versionIndex === -1 && versions.length > 0);
  const canRedo = versionIndex >= 0 && versionIndex < versions.length - 1;

  const navigateVersion = useCallback(
    (index: number) => {
      const snap = versions[index];
      if (!snap) return;
      setVersionIndex(index);
      setRestyledImage(snap.image);
      setChatMessages(snap.messages);
      conversationHistory.current = [...snap.history];
    },
    [versions]
  );

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const target =
      versionIndex === -1 ? versions.length - 2 : versionIndex - 1;
    if (target >= 0) navigateVersion(target);
  }, [canUndo, versionIndex, versions.length, navigateVersion]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    navigateVersion(versionIndex + 1);
  }, [canRedo, versionIndex, navigateVersion]);

  const handleRefine = useCallback(
    async (message: string, elementFilter?: ElementFilter) => {
      if (!restyledImage) return;

      const currentVersions =
        versionIndex === -1 ? versions : versions.slice(0, versionIndex + 1);

      const snapshot: Snapshot = {
        image: restyledImage,
        messages: [...chatMessages],
        history: [...conversationHistory.current],
      };
      const newVersions = [...currentVersions, snapshot];

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
            elementFilter: elementFilter || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Refinement failed");

        conversationHistory.current.push({
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/png", data: restyledImage } },
            { text: `Edit this room image: ${message}` },
          ],
        });

        const newMessages = data.text
          ? [
              ...chatMessages,
              { role: "user" as const, text: message },
              { role: "assistant" as const, text: data.text },
            ]
          : [...chatMessages, { role: "user" as const, text: message }];

        const resultSnapshot: Snapshot = {
          image: data.image,
          messages: newMessages,
          history: [
            ...conversationHistory.current,
            {
              role: "user",
              parts: [
                {
                  inlineData: { mimeType: "image/png", data: restyledImage },
                },
                { text: `Edit this room image: ${message}` },
              ],
            },
          ],
        };

        conversationHistory.current = resultSnapshot.history;
        setRestyledImage(data.image);
        setChatMessages(newMessages);
        setVersions([...newVersions, resultSnapshot]);
        setVersionIndex(-1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", text: "Failed to refine. Try again." },
        ]);
        setVersions(currentVersions);
      } finally {
        setIsGenerating(false);
      }
    },
    [restyledImage, chatMessages, versions, versionIndex]
  );

  const overlayText = variationsLoading
    ? "Generating variations"
    : restyledImage
      ? "Refining your room"
      : mode === "paint"
        ? "Painting your walls"
        : "Restyling your room";

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
          {/* Mode Tabs */}
          <section className="w-full animate-fade-up">
            <ModeTabs activeMode={mode} onModeChange={handleModeChange} />
          </section>

          {/* Step 1: Upload */}
          <section className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                01
              </span>
              <div className="h-px flex-1 bg-warm-gray/30" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                Upload
              </span>
            </div>
            <p className="text-[11px] text-warm-gray-light/70 mb-4">
              {mode === "paint"
                ? "Upload a photo of any room. AI will change only the wall color."
                : "Upload a photo of any room — furnished or empty. AI will redesign it in your chosen style."}
              {" "}Switching modes keeps your uploaded photo.
            </p>
            <ImageUpload
              onImageSelected={handleImageSelected}
              currentImage={originalImage}
            />
          </section>

          {/* Step 2: Style / Color */}
          {originalImage && (
            <section
              className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6"
              style={{ animationDelay: "40ms" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  02
                </span>
                <div className="h-px flex-1 bg-warm-gray/30" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                  {mode === "paint" ? "Color" : "Style"}
                </span>
              </div>
              <p className="text-[11px] text-warm-gray-light/70 mb-4">
                {mode === "paint"
                  ? "Choose a wall color and finish. AI will repaint only the walls in your photo."
                  : "Pick a design style or describe your own. AI will redesign the room while keeping its layout."}
                {" "}Clicking a {mode === "paint" ? "swatch" : "style"} starts generation immediately.
              </p>
              {mode === "paint" ? (
                <ColorPicker
                  onColorSelected={handlePaintSelected}
                  disabled={isGenerating}
                />
              ) : (
                <StyleSelector
                  onStyleSelected={handleStyleSelected}
                  disabled={isGenerating}
                />
              )}
            </section>
          )}

          {/* Error */}
          {error && (
            <div className="border border-red-900/30 bg-red-950/20 rounded-lg px-5 py-4 text-red-300 text-sm animate-fade-up">
              {error}
            </div>
          )}

          {/* Variations grid */}
          {showVariations && (
            <section
              className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6"
              style={{ animationDelay: "40ms" }}
            >
              <VariationsGrid
                variations={variations}
                isLoading={variationsLoading}
                onSelect={handleVariationSelect}
                selectedIndex={selectedVariation}
              />
            </section>
          )}

          {/* Step 3: Results */}
          {restyledImage && !showVariations && (
            <section
              className="w-full animate-fade-up bg-charcoal-light border border-warm-gray/30 rounded-xl p-4 sm:p-6"
              style={{ animationDelay: "40ms" }}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
                  03
                </span>
                <div className="h-px flex-1 bg-warm-gray/30" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light">
                  {currentStyle}
                </span>
              </div>
              <p className="text-[11px] text-warm-gray-light/70 mb-4">
                {mode === "paint"
                  ? "Drag the slider to compare before and after. To try a different color, just pick another swatch above."
                  : "Drag the slider to compare before and after. Use the chat below to make further changes, or generate 4 alternative versions to choose from."}
              </p>

              <BeforeAfter before={originalImage} after={restyledImage} />

              {/* Controls: Undo/Redo, Download, Generate Variations */}
              {!isGenerating && (
                <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
                  {mode !== "paint" && (
                    <div className="flex items-center gap-2">
                      {variations.length > 0 && (
                        <button
                          onClick={handleBackToVariations}
                          title="Go back to the 2x2 grid to pick a different variation"
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
                          Back to variations
                        </button>
                      )}
                      <button
                        onClick={handleGenerateVariations}
                        disabled={variationsLoading}
                        title={
                          variations.length > 0
                            ? "Discard current variations and generate 4 new ones from scratch"
                            : "Generate 4 different AI interpretations of this style to choose from"
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-sage hover:bg-sage/20 transition-all duration-150 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sage/60"
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
                            d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                          />
                        </svg>
                        {variations.length > 0
                          ? "Regenerate variations"
                          : "Generate 4 variations"}
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <DownloadButton
                      beforeImage={originalImage}
                      afterImage={restyledImage}
                    />

                    {versions.length > 0 && mode !== "paint" && (
                      <>
                        <button
                          onClick={handleUndo}
                          disabled={!canUndo}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-terracotta hover:bg-terracotta/20 transition-all duration-150 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60"
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
                          Undo
                        </button>
                        <button
                          onClick={handleRedo}
                          disabled={!canRedo}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-terracotta hover:bg-terracotta/20 transition-all duration-150 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60"
                        >
                          Redo
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
                              d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
                            />
                          </svg>
                        </button>
                        <span className="text-[10px] text-warm-gray/40 ml-1">
                          {versionIndex === -1
                            ? versions.length
                            : versionIndex + 1}{" "}
                          / {versions.length}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Mood Board — not useful in paint mode since only walls changed */}
              {mode !== "paint" && (moodBoard || moodBoardLoading) && (
                <div className="mt-6">
                  <MoodBoard data={moodBoard} isLoading={moodBoardLoading} />
                </div>
              )}

              {mode !== "paint" && (
                <div className="mt-8">
                  <ChatRefine
                    onSendMessage={handleRefine}
                    messages={chatMessages}
                    isLoading={isGenerating}
                    suggestions={suggestions}
                  />
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Loading modal */}
      {(isGenerating || variationsLoading) && (
        <GeneratingOverlay text={overlayText} />
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
