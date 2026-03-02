import { NextRequest, NextResponse } from "next/server";
import { generateRefinedImage } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  try {
    const { history, message, currentImage, currentImageMimeType, elementFilter } =
      await req.json();

    if (!currentImage || !message) {
      return NextResponse.json(
        { error: "Missing image or message" },
        { status: 400 }
      );
    }

    const result = await generateRefinedImage(
      history || [],
      message,
      currentImage,
      currentImageMimeType || "image/png",
      elementFilter || null
    );

    // Return image and optional text response
    return NextResponse.json({
      image: result.image,
      text: result.text,
    });
  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Refinement failed" },
      { status: 500 }
    );
  }
}
