"use client";

interface Variation {
  image: string;
  text?: string;
}

interface VariationsGridProps {
  variations: Variation[];
  isLoading: boolean;
  onSelect: (variation: Variation) => void;
  selectedIndex: number | null;
}

export default function VariationsGrid({
  variations,
  isLoading,
  onSelect,
  selectedIndex,
}: VariationsGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-warm-gray/30" />
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-warm-gray-light font-medium">
          {isLoading ? "Generating variations..." : "Pick your favorite"}
        </h3>
        <div className="h-px flex-1 bg-warm-gray/30" />
      </div>
      {!isLoading && variations.length > 0 && (
        <p className="text-[11px] text-warm-gray-light/70">
          Each variation is a different AI interpretation of the same style. Click one to preview it full-size — you can always come back here to pick a different one.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[4/3] rounded-lg bg-charcoal border border-warm-gray/20 skeleton-pulse"
              />
            ))
          : variations.map((v, i) => (
              <button
                key={i}
                onClick={() => onSelect(v)}
                className={`group relative aspect-[4/3] rounded-lg border-2 overflow-hidden transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-terracotta/60 ${
                  selectedIndex === i
                    ? "border-terracotta shadow-[0_0_20px_rgba(196,101,58,0.3)]"
                    : "border-warm-gray/30 hover:border-warm-gray/60"
                }`}
              >
                <img
                  src={`data:image/png;base64,${v.image}`}
                  alt={`Variation ${i + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                <span
                  className={`absolute top-2 left-2 text-[10px] uppercase tracking-[0.15em] font-medium px-2 py-1 rounded-full ${
                    selectedIndex === i
                      ? "bg-terracotta text-cream"
                      : "bg-charcoal/70 text-cream backdrop-blur-sm"
                  }`}
                >
                  {i + 1}
                </span>
              </button>
            ))}
      </div>
    </div>
  );
}
