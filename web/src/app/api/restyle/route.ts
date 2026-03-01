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

    // Run image generation and suggestion generation in parallel
    const [result, suggestions] = await Promise.all([
      generateRestyledImage(image, mimeType || "image/jpeg", style, customPrompt),
      generateSuggestions(customPrompt ? `${style} — ${customPrompt}` : style),
    ]);

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
