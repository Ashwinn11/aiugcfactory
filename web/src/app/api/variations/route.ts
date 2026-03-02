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

    const mime = mimeType || "image/jpeg";

    const results = await Promise.allSettled([
      generateRestyledImage(image, mime, style, customPrompt),
      generateRestyledImage(image, mime, style, customPrompt),
      generateRestyledImage(image, mime, style, customPrompt),
      generateRestyledImage(image, mime, style, customPrompt),
    ]);

    const variations = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => {
        const val = (
          r as PromiseFulfilledResult<{ image: string; text?: string }>
        ).value;
        return { image: val.image, text: val.text };
      });

    if (variations.length === 0) {
      return NextResponse.json(
        { error: "All variations failed to generate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ variations });
  } catch (error) {
    console.error("Variations error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
