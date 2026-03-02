import { NextRequest, NextResponse } from "next/server";
import { generateSuggestions } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, style, customPrompt } = await req.json();

    if (!image || !style) {
      return NextResponse.json(
        { error: "Missing image or style" },
        { status: 400 }
      );
    }

    const suggestions = await generateSuggestions(
      image,
      mimeType || "image/png",
      customPrompt ? `${style} — ${customPrompt}` : style
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Suggestions failed" },
      { status: 500 }
    );
  }
}
