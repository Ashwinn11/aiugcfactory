"use client";

import { useState, useRef, useCallback } from "react";

interface BeforeAfterProps {
  before: string;
  after: string;
}

export default function BeforeAfter({ before, after }: BeforeAfterProps) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(2, Math.min(98, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  const startDrag = useCallback(
    (clientX: number) => {
      setIsDragging(true);
      handleMove(clientX);
    },
    [handleMove]
  );

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Labels */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-warm-gray font-medium">
          Original
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-terracotta font-medium">
          Restyled
        </span>
      </div>

      {/* Slider container */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg cursor-col-resize select-none group"
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => isDragging && handleMove(e.clientX)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => isDragging && handleMove(e.touches[0].clientX)}
        onTouchEnd={() => setIsDragging(false)}
      >
        {/* After image (full width, behind) */}
        <img
          src={`data:image/png;base64,${after}`}
          alt="Restyled room"
          className="w-full block"
          draggable={false}
        />

        {/* Before image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPos}%` }}
        >
          <img
            src={`data:image/jpeg;base64,${before}`}
            alt="Original room"
            className="block h-full object-cover"
            style={{
              width: containerRef.current
                ? `${containerRef.current.offsetWidth}px`
                : "100vw",
            }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute top-0 bottom-0 w-px transition-colors"
          style={{
            left: `${sliderPos}%`,
            backgroundColor: isDragging
              ? "rgba(196,101,58,0.8)"
              : "rgba(245,240,235,0.6)",
          }}
        >
          {/* Handle */}
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-200 ${
              isDragging ? "scale-110" : "group-hover:scale-105"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full border-2 flex items-center justify-center backdrop-blur-md transition-all duration-200 ${
                isDragging
                  ? "border-terracotta bg-terracotta/20 shadow-[0_0_20px_rgba(196,101,58,0.3)]"
                  : "border-cream/60 bg-charcoal/40"
              }`}
            >
              <svg
                className="w-4 h-4 text-cream"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Edge labels inside image */}
        <div className="absolute bottom-3 left-3 px-2.5 py-1 bg-charcoal/60 backdrop-blur-sm text-[10px] uppercase tracking-[0.15em] text-cream/80 rounded">
          Before
        </div>
        <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-terracotta/80 backdrop-blur-sm text-[10px] uppercase tracking-[0.15em] text-cream rounded">
          After
        </div>
      </div>
    </div>
  );
}
