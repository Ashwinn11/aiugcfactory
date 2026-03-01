import { NextRequest, NextResponse } from "next/server";
import { generateRestyledImage, generateSuggestions } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, style, customPrompt } = await req.json();

    if (!image || !style) {
      return NextResponse.json(
        { error: "Missing image or style" },
        { status: 400 }
      );
    }

    // Generate the restyled image first, then generate suggestions from
    // the actual restyled output so suggestions match what users see.
    const result = await generateRestyledImage(
      image,
      mimeType || "image/jpeg",
      style,
      customPrompt
    );

    let suggestions: string[] = [];
    try {
      suggestions = await generateSuggestions(
        result.image,
        "image/png",
        customPrompt ? `${style} — ${customPrompt}` : style
      );
    } catch {
      suggestions = [];
    }

    return NextResponse.json({
      image: result.image,
      text: result.text,
      modelParts: result.modelParts,
      suggestions,
    });
  } catch (error) {
    console.error("Restyle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
