"use client";

import { useState } from "react";

const STYLES = [
  {
    name: "Modern Minimalist",
    description: "Clean lines, neutral tones, minimal furniture",
    tag: "MINIMAL",
  },
  {
    name: "Japandi",
    description: "Japanese + Scandinavian, warm wood, simple forms",
    tag: "HYBRID",
  },
  {
    name: "Bohemian",
    description: "Colorful textiles, plants, eclectic mix",
    tag: "ECLECTIC",
  },
  {
    name: "Industrial",
    description: "Exposed brick, metal accents, raw concrete",
    tag: "RAW",
  },
  {
    name: "Mid-Century Modern",
    description: "Retro furniture, warm colors, organic shapes",
    tag: "RETRO",
  },
  {
    name: "Coastal",
    description: "Light blues, whites, natural textures",
    tag: "ORGANIC",
  },
];

interface StyleSelectorProps {
  onStyleSelected: (style: string, customPrompt?: string) => void;
  disabled?: boolean;
}

export default function StyleSelector({
  onStyleSelected,
  disabled,
}: StyleSelectorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [customStyle, setCustomStyle] = useState("");

  const handleSelect = (style: (typeof STYLES)[number]) => {
    setSelected(style.name);
    setCustomStyle("");
    onStyleSelected(style.name);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {STYLES.map((style, i) => (
          <button
            key={style.name}
            onClick={() => handleSelect(style)}
            disabled={disabled}
            className={`group relative text-left p-4 sm:p-5 min-h-28 rounded-lg border transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed animate-fade-up focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
              selected === style.name
                ? "border-terracotta bg-terracotta/20 shadow-[0_0_20px_rgba(196,101,58,0.2)]"
                : "border-warm-gray/30 hover:border-warm-gray/60 bg-charcoal-light hover:bg-[#35302d]"
            }`}
            style={{ animationDelay: `${i * 35}ms` }}
          >
            {/* Selection indicator */}
            {selected === style.name && (
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-terracotta" />
            )}

            <span className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light font-medium">
              {style.tag}
            </span>
            <h3 className="font-display text-base text-cream mt-2 leading-tight">
              {style.name}
            </h3>
            <p className="text-xs text-cream/85 mt-1.5 leading-relaxed">
              {style.description}
            </p>

            {/* Bottom accent line on hover */}
            <div
              className={`absolute bottom-0 left-4 right-4 h-px transition-all duration-250 ${
                selected === style.name
                  ? "bg-terracotta"
                  : "bg-transparent group-hover:bg-warm-gray/30"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Custom style input */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-charcoal-light border border-warm-gray/30 rounded-lg p-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Describe your own style..."
            value={customStyle}
            onChange={(e) => setCustomStyle(e.target.value)}
            disabled={disabled}
            className="w-full bg-transparent border-b border-warm-gray/40 focus:border-terracotta px-0 py-3 text-sm text-cream placeholder:text-warm-gray-light/70 focus:outline-none transition-colors disabled:opacity-40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && customStyle.trim()) {
                setSelected(null);
                onStyleSelected("Custom", customStyle.trim());
              }
            }}
          />
        </div>
        <button
          onClick={() => {
            if (customStyle.trim()) {
              setSelected(null);
              onStyleSelected("Custom", customStyle.trim());
            }
          }}
          disabled={disabled || !customStyle.trim()}
          className="w-full sm:w-auto px-5 py-3 min-h-11 bg-terracotta text-cream text-xs uppercase tracking-[0.15em] font-medium hover:bg-terracotta-light disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-terracotta/60"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
