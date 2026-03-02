"use client";

import type { MoodBoardData } from "@/lib/types";

interface MoodBoardProps {
  data: MoodBoardData | null;
  isLoading: boolean;
}

export default function MoodBoard({ data, isLoading }: MoodBoardProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-warm-gray/30" />
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light font-medium">
            Analyzing design...
          </h3>
          <div className="h-px flex-1 bg-warm-gray/30" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-charcoal border border-warm-gray/20 skeleton-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data || (data.colors.length === 0 && !data.summary)) return null;

  return (
    <div className="space-y-4 animate-fade-up bg-charcoal border border-warm-gray/20 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-warm-gray/30" />
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light font-medium">
          Mood Board
        </h3>
        <div className="h-px flex-1 bg-warm-gray/30" />
      </div>
      <p className="text-[11px] text-warm-gray-light/70">
        AI-extracted design breakdown — use these colors, materials, and style names to find matching products in real life.
      </p>

      {/* Color palette */}
      {data.colors.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light mb-2">
            Color Palette
          </p>
          <div className="flex gap-2 flex-wrap">
            {data.colors.map((color, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full border border-warm-gray/30"
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                />
                <span className="text-[10px] text-warm-gray-light">
                  {color.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Materials */}
      {data.materials.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light mb-2">
            Materials
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {data.materials.map((m, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-[11px] text-cream bg-charcoal-light border border-warm-gray/30 rounded-full"
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Furniture styles */}
      {data.furnitureStyles.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.15em] text-warm-gray-light mb-2">
            Style
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {data.furnitureStyles.map((s, i) => (
              <span
                key={i}
                className="px-2.5 py-1 text-[11px] text-cream bg-charcoal-light border border-warm-gray/30 rounded-full"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <p className="text-xs text-warm-gray-light leading-relaxed">
          {data.summary}
        </p>
      )}
    </div>
  );
}
