"use client";

import { useCallback } from "react";

interface DownloadButtonProps {
  beforeImage: string;
  afterImage: string;
}

export default function DownloadButton({
  beforeImage,
  afterImage,
}: DownloadButtonProps) {
  const handleDownload = useCallback(async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    try {
      const [beforeImg, afterImg] = await Promise.all([
        loadImage(`data:image/png;base64,${beforeImage}`),
        loadImage(`data:image/png;base64,${afterImage}`),
      ]);

      const imgW = Math.max(beforeImg.width, afterImg.width);
      const imgH = Math.max(beforeImg.height, afterImg.height);
      const gap = 20;
      const padding = 40;
      const labelHeight = 40;
      const watermarkHeight = 30;

      canvas.width = imgW * 2 + gap + padding * 2;
      canvas.height = imgH + padding * 2 + labelHeight + watermarkHeight;

      // Background
      ctx.fillStyle = "#1C1917";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Labels
      ctx.fillStyle = "#A8A29E";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Before", padding + imgW / 2, padding + 20);
      ctx.fillText("After", padding + imgW + gap + imgW / 2, padding + 20);

      // Images
      const imgY = padding + labelHeight;
      ctx.drawImage(beforeImg, padding, imgY, imgW, imgH);
      ctx.drawImage(afterImg, padding + imgW + gap, imgY, imgW, imgH);

      // Watermark
      ctx.fillStyle = "#78716C";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Room Restyler",
        canvas.width / 2,
        canvas.height - 12
      );

      // Download
      const link = document.createElement("a");
      link.download = "room-restyler-comparison.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Download failed:", err);
    }
  }, [beforeImage, afterImage]);

  return (
    <button
      onClick={handleDownload}
      title="Save a side-by-side before/after comparison as a PNG image"
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
