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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STYLES.map((style, i) => (
          <button
            key={style.name}
            onClick={() => handleSelect(style)}
            disabled={disabled}
            className={`group relative text-left p-5 rounded-lg border transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed animate-fade-up ${
              selected === style.name
                ? "border-terracotta bg-terracotta/8 shadow-[0_0_20px_rgba(196,101,58,0.1)]"
                : "border-warm-gray/15 hover:border-warm-gray/40 bg-charcoal-light/50 hover:bg-charcoal-light"
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Selection indicator */}
            {selected === style.name && (
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-terracotta" />
            )}

            <span className="text-[10px] uppercase tracking-[0.15em] text-warm-gray font-medium">
              {style.tag}
            </span>
            <h3 className="font-display text-base text-cream mt-2 leading-tight">
              {style.name}
            </h3>
            <p className="text-xs text-warm-gray mt-1.5 leading-relaxed">
              {style.description}
            </p>

            {/* Bottom accent line on hover */}
            <div
              className={`absolute bottom-0 left-4 right-4 h-px transition-all duration-500 ${
                selected === style.name
                  ? "bg-terracotta"
                  : "bg-transparent group-hover:bg-warm-gray/30"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Custom style input */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Describe your own style..."
            value={customStyle}
            onChange={(e) => setCustomStyle(e.target.value)}
            disabled={disabled}
            className="w-full bg-transparent border-b border-warm-gray/20 focus:border-terracotta px-0 py-3 text-sm text-cream placeholder:text-warm-gray/40 focus:outline-none transition-colors disabled:opacity-40"
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
          className="px-5 py-2.5 bg-terracotta text-cream text-xs uppercase tracking-[0.15em] font-medium hover:bg-terracotta-light disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-300"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
