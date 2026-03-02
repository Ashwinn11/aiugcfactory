"use client";

import type { AppMode } from "@/lib/types";

const MODES: { key: AppMode; label: string; description: string }[] = [
  { key: "restyle", label: "Restyle Room", description: "New style, same layout" },
  { key: "paint", label: "Paint Walls", description: "Preview a new wall color" },
];

interface ModeTabsProps {
  activeMode: AppMode;
  onModeChange: (mode: AppMode) => void;
}

const MODE_HINTS: Record<AppMode, string> = {
  restyle:
    "Upload any room — furnished or empty. AI will redesign it in your chosen style, transforming furniture, materials, and decor while keeping the layout.",
  paint:
    "Upload any room. AI will change only the wall color and finish — all furniture and decor stay exactly as they are.",
};

export default function ModeTabs({ activeMode, onModeChange }: ModeTabsProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-charcoal rounded-lg p-1 border border-warm-gray/20">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onModeChange(mode.key)}
            className={`flex-1 px-3 py-2.5 rounded-md text-center transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
              activeMode === mode.key
                ? "bg-terracotta/20 border border-terracotta/50 text-cream"
                : "border border-transparent text-warm-gray-light hover:text-cream hover:bg-charcoal-light"
            }`}
          >
            <span className="block text-xs sm:text-sm font-medium">
              {mode.label}
            </span>
            <span className="hidden sm:block text-[10px] text-warm-gray-light mt-0.5">
              {mode.description}
            </span>
          </button>
        ))}
      </div>
      <p className="text-xs text-warm-gray-light leading-relaxed px-1">
        {MODE_HINTS[activeMode]}
      </p>
    </div>
  );
}
