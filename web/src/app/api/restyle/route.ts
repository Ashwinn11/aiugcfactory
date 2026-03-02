import { NextRequest, NextResponse } from "next/server";
import { generateRestyledImage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, style, customPrompt } = await req.json();

    if (!image || !style) {
      return NextResponse.json(
        { error: "Missing image or style" },
        { status: 400 }
      );
    }

    // Fast path: return immediately after image generation.
    const result = await generateRestyledImage(image, mimeType || "image/jpeg", style, customPrompt);

    return NextResponse.json({
      image: result.image,
      text: result.text,
      modelParts: result.modelParts,
    });
  } catch (error) {
    console.error("Restyle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
