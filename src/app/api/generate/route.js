import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

function getSystemPrompt() {
  try {
    return readFileSync(
      join(process.cwd(), "prompts", "image_gen.txt"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

const CAROUSEL_SYSTEM = `You are an Instagram influencer creating a photo dump carousel. Given a vibe, generate 5 photos that look like real iPhone snapshots from your day — the kind you'd actually post.

Mix it up naturally: selfies, candid moments, what you're eating, your outfit, the view, your accessories. Not every photo needs to include you. Keep it authentic, casual, imperfect. Shot on iPhone, not a photoshoot.

Before each photo, write a casual Instagram caption (1 line with emoji).

Important: correct human anatomy only — 2 arms, 2 legs, no extras.`;

// Parse interleaved text + image parts from Gemini response
function parseMultiImageResponse(response) {
  const results = [];
  let currentCaption = "";

  if (!response.candidates?.[0]?.content?.parts) return results;

  for (const part of response.candidates[0].content.parts) {
    // Skip thinking parts
    if (part.thought) continue;

    if (part.text) {
      // Extract the last caption-like text before an image
      const lines = part.text.trim().split("\n").filter(Boolean);
      // Find the most relevant caption line
      for (const line of lines) {
        const cleaned = line
          .replace(/^#+\s*/, "")
          .replace(/^\*+\s*/, "")
          .replace(/^Caption:\s*/i, "")
          .replace(/^Image\s*\d+[:.]\s*/i, "")
          .replace(/^Photo\s*\d+[:.]\s*/i, "")
          .trim();
        if (cleaned.length > 0) {
          currentCaption = cleaned;
        }
      }
    } else if (part.inlineData) {
      const mimeType = part.inlineData.mimeType || "image/png";
      results.push({
        image: `data:${mimeType};base64,${part.inlineData.data}`,
        caption: currentCaption || "",
        timestamp: Date.now() + results.length,
      });
      currentCaption = "";
    }
  }

  return results;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { vibe, avatar, aspectRatio = "9:16" } = body;

    if (!vibe || vibe.trim().length === 0) {
      return NextResponse.json(
        { error: "Please describe the vibe" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const photoPrompt = getSystemPrompt();

    // Build the prompt
    const basePrompt = `Create a 5-photo Instagram photo dump carousel for this vibe:

"${vibe.trim()}"

Generate 5 distinct photos. Before each photo, write a short casual Instagram caption with emoji. Make each photo a different type (selfie, food/accessory close-up, outfit detail, candid moment, the view). Shot on iPhone, UGC style.`;

    const systemInstruction = `${CAROUSEL_SYSTEM}\n\nPhotography style reference:\n${photoPrompt}`;

    // Try generation with retry on IMAGE_SAFETY
    async function tryGenerate(prompt, attempt = 1) {
      let contents;
      if (avatar) {
        contents = [
          {
            inlineData: {
              data: avatar.base64,
              mimeType: avatar.mimeType || "image/png",
            },
          },
          `This is a reference photo of the person. ALL photos in the carousel must feature this SAME person (keep face, hair color, skin tone, body type identical). The person is wearing appropriate, stylish casual clothing in all photos.\n\n${prompt}`,
        ];
      } else {
        contents = prompt;
      }

      const response = await ai.models.generateContent({
        model: IMAGE_MODEL,
        contents,
        config: {
          systemInstruction,
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio,
          },
          thinkingConfig: {
            thinkingLevel: "High",
          },
        },
      });

      const candidate = response.candidates?.[0];

      // Check for safety block
      if (!candidate || (candidate.finishReason && candidate.finishReason === "IMAGE_SAFETY")) {
        if (attempt === 1) {
          // Retry with safer framing
          console.log("IMAGE_SAFETY triggered, retrying with safer prompt...");
          const saferPrompt = prompt + "\n\nNote: all people are fully and appropriately dressed in stylish casual outfits. Focus on the environment, scenery, food, and lifestyle moments.";
          return tryGenerate(saferPrompt, 2);
        }
        return { error: "This vibe triggered safety filters. Try describing the setting or activity differently." };
      }

      if (candidate.finishReason && candidate.finishReason !== "STOP" && candidate.finishReason !== "MAX_TOKENS") {
        return { error: `Generation stopped (${candidate.finishReason}) — try a different vibe.` };
      }

      const images = parseMultiImageResponse(response);
      if (images.length === 0) {
        const partTypes = candidate.content?.parts?.map(p => p.text ? "text" : p.inlineData ? "image" : p.thought ? "thought" : "unknown") || [];
        console.error("No images extracted. Parts received:", partTypes.join(", "));
        return { error: "No images were generated. Try a different vibe." };
      }

      return { images };
    }

    const result = await tryGenerate(basePrompt);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      images: result.images,
      vibe: vibe.trim(),
    });
  } catch (err) {
    console.error("Generation error:", err.message);
    // Check for specific API errors
    if (err.message?.includes("SAFETY") || err.message?.includes("blocked")) {
      return NextResponse.json(
        { error: "This vibe was blocked by safety filters. Try rephrasing." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: err.message || "Generation failed" },
      { status: 500 }
    );
  }
}
