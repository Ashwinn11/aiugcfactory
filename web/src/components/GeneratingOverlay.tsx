"use client";

export default function GeneratingOverlay({ text }: { text?: string }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-charcoal-light border border-warm-gray/25 rounded-2xl px-8 sm:px-12 py-8 sm:py-10 flex flex-col items-center gap-6 shadow-2xl">
      {/* Animated architectural lines */}
      <div className="relative w-20 h-20">
        <div
          className="absolute inset-0 border border-warm-gray/20 rounded-lg"
          style={{ animation: "glow-pulse 2s ease-in-out infinite" }}
        />
        <div
          className="absolute inset-2 border border-terracotta/30 rounded-md animate-spin"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute inset-4 border border-terracotta/50 rounded-sm animate-spin"
          style={{ animationDuration: "3s", animationDirection: "reverse" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-terracotta rounded-full animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-cream font-medium">
          {text || "Restyling your room"}
        </p>
        <p className="text-xs text-warm-gray-light">
          This usually takes 10 &#8211; 20 seconds
        </p>
      </div>
    </div>
  );
}
