"use client";

import { useState } from "react";

const PRESET_COLORS = [
  { hex: "#F5F0EB", name: "Warm White" },
  { hex: "#E8DDD3", name: "Linen" },
  { hex: "#D4C5B2", name: "Sandstone" },
  { hex: "#C4B5A0", name: "Wheat" },
  { hex: "#8B9B7E", name: "Sage" },
  { hex: "#6B7F6E", name: "Eucalyptus" },
  { hex: "#4A6670", name: "Teal" },
  { hex: "#2C3E50", name: "Navy" },
  { hex: "#34495E", name: "Slate Blue" },
  { hex: "#5D4E60", name: "Plum" },
  { hex: "#C4653A", name: "Terracotta" },
  { hex: "#8B4513", name: "Saddle Brown" },
  { hex: "#B22222", name: "Firebrick" },
  { hex: "#2F4F4F", name: "Dark Slate" },
  { hex: "#1C1917", name: "Charcoal" },
  { hex: "#F0E68C", name: "Khaki" },
];

const FINISHES = ["Matte", "Satin", "Semi-Gloss"] as const;

interface ColorPickerProps {
  onColorSelected: (colorHex: string, finish: string) => void;
  disabled?: boolean;
}

export default function ColorPicker({
  onColorSelected,
  disabled,
}: ColorPickerProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [customHex, setCustomHex] = useState("");
  const [finish, setFinish] = useState<(typeof FINISHES)[number]>("Matte");

  const handleSelect = (hex: string) => {
    setSelectedColor(hex);
    setCustomHex("");
    onColorSelected(hex, finish);
  };

  const handleCustomApply = () => {
    const hex = customHex.trim();
    if (!hex) return;
    const normalized = hex.startsWith("#") ? hex : `#${hex}`;
    setSelectedColor(normalized);
    onColorSelected(normalized, finish);
  };

  const handleFinishChange = (f: (typeof FINISHES)[number]) => {
    setFinish(f);
    if (selectedColor) {
      onColorSelected(selectedColor, f);
    }
  };

  return (
    <div className="space-y-5">
      {/* Color swatches */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light mb-1">
          Wall Color
        </p>
        <p className="text-[11px] text-warm-gray-light/70 mb-3">
          Pick a color below or enter a custom hex. Clicking a swatch immediately generates a preview.
        </p>
        <div className="grid grid-cols-8 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.hex}
              onClick={() => handleSelect(color.hex)}
              disabled={disabled}
              title={color.name}
              className={`aspect-square rounded-lg border-2 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
                selectedColor === color.hex
                  ? "border-terracotta scale-110 shadow-[0_0_12px_rgba(196,101,58,0.4)]"
                  : "border-warm-gray/30 hover:border-warm-gray/60 hover:scale-105"
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>
      </div>

      {/* Custom hex input */}
      <div className="flex gap-3 items-center bg-charcoal border border-warm-gray/30 rounded-lg p-3">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="#XXXXXX or hex value"
            value={customHex}
            onChange={(e) => setCustomHex(e.target.value)}
            disabled={disabled}
            className="w-full bg-transparent border-b border-warm-gray/40 focus:border-terracotta px-0 py-2 text-sm text-cream placeholder:text-warm-gray-light/70 focus:outline-none transition-colors disabled:opacity-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCustomApply();
            }}
          />
        </div>
        {customHex.trim() && (
          <div
            className="w-8 h-8 rounded-md border border-warm-gray/40"
            style={{
              backgroundColor: customHex.startsWith("#")
                ? customHex
                : `#${customHex}`,
            }}
          />
        )}
        <button
          onClick={handleCustomApply}
          disabled={disabled || !customHex.trim()}
          className="px-4 py-2 bg-terracotta text-cream text-xs uppercase tracking-[0.15em] font-medium rounded-md hover:bg-terracotta-light disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-terracotta/60"
        >
          Apply
        </button>
      </div>

      {/* Finish selector */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light mb-1">
          Finish
        </p>
        <p className="text-[11px] text-warm-gray-light/70 mb-3">
          Matte has no shine, Satin has a soft sheen, Semi-Gloss is reflective. Pick a finish, then select a color above.
        </p>
        <div className="flex gap-2">
          {FINISHES.map((f) => (
            <button
              key={f}
              onClick={() => handleFinishChange(f)}
              disabled={disabled}
              className={`px-4 py-2 text-xs rounded-full border transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
                finish === f
                  ? "border-terracotta bg-terracotta/20 text-cream"
                  : "border-warm-gray/40 text-warm-gray-light hover:border-warm-gray/60 hover:text-cream"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
