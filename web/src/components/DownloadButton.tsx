"use client";

import { useCallback } from "react";

interface DownloadButtonProps {
  image: string;
}

export default function DownloadButton({ image }: DownloadButtonProps) {
  const handleDownload = useCallback(() => {
    const link = document.createElement("a");
    link.download = "room-restyler.png";
    link.href = `data:image/png;base64,${image}`;
    link.click();
  }, [image]);

  return (
    <button
      onClick={handleDownload}
      title="Download the generated image as PNG"
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-cream border border-warm-gray/40 bg-charcoal rounded-full hover:border-sage hover:bg-sage/20 transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sage/60"
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
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
        />
      </svg>
      Download
    </button>
  );
}
