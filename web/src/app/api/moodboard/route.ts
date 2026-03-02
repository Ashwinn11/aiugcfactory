import { NextRequest, NextResponse } from "next/server";
import { generateMoodBoard } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType } = await req.json();

    if (!image) {
      return NextResponse.json(
        { error: "Missing image" },
        { status: 400 }
      );
    }

    const moodBoard = await generateMoodBoard(image, mimeType || "image/png");

    return NextResponse.json(moodBoard);
  } catch (error) {
    console.error("Mood board error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
