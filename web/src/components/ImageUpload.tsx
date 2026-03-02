"use client";

import { useCallback, useState } from "react";

interface ImageUploadProps {
  onImageSelected: (base64: string, mimeType: string) => void;
  currentImage?: string;
}

export default function ImageUpload({
  onImageSelected,
  currentImage,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        onImageSelected(base64, file.type);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (currentImage) {
    return (
      <div className="relative w-full h-[320px] sm:h-[380px] lg:h-[520px] group overflow-hidden rounded-lg border border-warm-gray/35 bg-charcoal-light">
        <img
          src={`data:image/jpeg;base64,${currentImage}`}
          alt="Uploaded room"
          className="block w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        <button
          onClick={() => onImageSelected("", "")}
          className="absolute bottom-4 right-4 bg-terracotta text-cream px-4 py-2.5 min-h-10 text-xs font-medium uppercase tracking-widest opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-200 translate-y-0 sm:translate-y-2 sm:group-hover:translate-y-0 cursor-pointer hover:bg-terracotta-light focus:outline-none focus:ring-2 focus:ring-terracotta/70"
        >
          Change photo
        </button>
      </div>
    );
  }

  return (
    <label
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`relative flex flex-col items-center justify-center w-full h-[320px] sm:h-[380px] lg:h-[520px] border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 group bg-charcoal-light focus-within:ring-2 focus-within:ring-terracotta/60 ${
        isDragging
          ? "border-terracotta bg-terracotta/12 scale-[0.99]"
          : "border-warm-gray/45 hover:border-terracotta/70"
      }`}
    >
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-warm-gray/20 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-warm-gray/20 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-warm-gray/20 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-warm-gray/20 rounded-br-lg" />

      <div className="flex flex-col items-center gap-5 text-warm-gray-light group-hover:text-cream transition-colors">
        <div className="relative">
          <svg
            className="w-10 h-10 transition-transform duration-200 group-hover:-translate-y-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-px bg-terracotta/40 transition-all duration-200 group-hover:w-10 group-hover:bg-terracotta" />
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-xs uppercase tracking-[0.2em] font-medium text-cream">
            Drop your room photo here
          </p>
          <p className="text-xs text-warm-gray-light">
            or click to browse
          </p>
        </div>
      </div>
      <input
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </label>
  );
}
