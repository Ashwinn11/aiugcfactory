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

// ──── Mode-specific system prompts ────

const MODE_PROMPTS = {
  photodump: `You are an Instagram influencer creating a photo dump carousel. Given a vibe, generate 5 photos that look like real iPhone snapshots from DIFFERENT moments of your day — the kind you'd actually post as a photo dump.

Mix it up naturally across different times and settings:
- A selfie (mirror, front cam, or 0.5x angle)
- A candid moment (laughing, walking, mid-action)
- An accessory or food close-up (your bag, coffee, earrings, plate)
- An outfit or detail shot (back camera, someone else took it)
- The view or setting (landscape, restaurant interior, street)

Each photo should feel like a DIFFERENT moment — different lighting, time of day, maybe even different outfits. This is a photo DUMP, not a photoshoot.

Before each photo, write a casual 1-line Instagram caption with emoji.

Important: correct human anatomy only — 2 arms, 2 legs, no extras.`,

  carousel: `You are an Instagram influencer creating a post carousel from ONE specific occasion. Given a vibe, generate 5 photos that tell a cohesive visual story from a single event or moment — the kind you'd swipe through on someone's Instagram post.

All photos should feel like the SAME occasion:
- Same overall lighting and time of day
- Same outfit (if person is shown)
- A natural flow: arriving → the scene → details → candid → the vibe

Types of shots to include:
- A establishing/wide shot of the place or scene
- A posed or selfie shot at the location
- A close-up detail (food, drink, decoration, texture)
- A candid moment (laughing, looking away, mid-conversation)
- A final moment (the view, sunset, leaving, a last look)

Before each photo, write a short Instagram caption with emoji.

Important: correct human anatomy only — 2 arms, 2 legs, no extras.`,

  ad: `You are creating an influencer-style ad carousel featuring a PRODUCT. Given a vibe and a product image, generate 5 photos that look like organic influencer content promoting this product — NOT stock photos, NOT studio shots.

The product must appear naturally in every image, but in different contexts:
- Holding or using the product (close-up, hands visible)
- Product in context (on a table, in a bag, on a shelf)
- The person using/applying/wearing the product naturally
- A flat-lay or aesthetic arrangement with the product
- A lifestyle moment where the product fits in organically

Keep it authentic — this should look like a real influencer's actual sponsored post, not a corporate ad. Shot on iPhone, natural lighting, casual composition.

Before each photo, write a casual Instagram caption with emoji that subtly mentions the product.

Important: correct human anatomy only — 2 arms, 2 legs, no extras.`,
};

// Parse interleaved text + image parts from Gemini response
function parseMultiImageResponse(response) {
  const results = [];
  let currentCaption = "";

  if (!response.candidates?.[0]?.content?.parts) return results;

  for (const part of response.candidates[0].content.parts) {
    if (part.thought) continue;

    if (part.text) {
      const lines = part.text.trim().split("\n").filter(Boolean);
      for (const line of lines) {
        const cleaned = line
          .replace(/^#+\s*/, "")
          .replace(/^\*+\s*/, "")
          .replace(/^Caption:\s*/i, "")
          .replace(/^Image\s*\d+[:.]\s*/i, "")
          .replace(/^Photo\s*\d+[:.]\s*/i, "")
          .replace(/^Slide\s*\d+[:.]\s*/i, "")
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
    const {
      vibe,
      mode = "photodump",
      avatar,
      productImage, // { base64, mimeType } — for ad mode
      aspectRatio = "9:16",
    } = body;

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

    // Select mode-specific system prompt
    const modeSystem = MODE_PROMPTS[mode] || MODE_PROMPTS.photodump;
    const systemInstruction = `${modeSystem}\n\nPhotography style reference:\n${photoPrompt}`;

    // Build the user prompt
    let basePrompt;
    if (mode === "ad") {
      basePrompt = `Create a 5-photo influencer ad carousel for this product/vibe:

"${vibe.trim()}"

Generate 5 distinct photos showing the product in different lifestyle contexts. Before each photo, write a casual Instagram caption with emoji. Make it look like organic influencer content, not a corporate ad. Shot on iPhone, UGC style.`;
    } else if (mode === "carousel") {
      basePrompt = `Create a 5-photo Instagram post carousel from this ONE occasion:

"${vibe.trim()}"

Generate 5 photos that tell the story of this moment — establishing shot, details, candid, close-ups, the vibe. All from the same event/time. Before each photo, write a short Instagram caption with emoji.`;
    } else {
      basePrompt = `Create a 5-photo Instagram photo dump carousel for this vibe:

"${vibe.trim()}"

Generate 5 distinct photos. Before each photo, write a short casual Instagram caption with emoji. Make each photo a different type (selfie, food/accessory close-up, outfit detail, candid moment, the view). Each should feel like a different moment. Shot on iPhone, UGC style.`;
    }

    // Try generation with retry on IMAGE_SAFETY
    async function tryGenerate(prompt, attempt = 1) {
      // Build contents array with images
      let contents = [];

      if (avatar) {
        contents.push({
          inlineData: {
            data: avatar.base64,
            mimeType: avatar.mimeType || "image/png",
          },
        });
      }

      if (mode === "ad" && productImage) {
        contents.push({
          inlineData: {
            data: productImage.base64,
            mimeType: productImage.mimeType || "image/png",
          },
        });
      }

      // Build the text prompt with image references
      let textPrompt = prompt;
      if (avatar && mode === "ad" && productImage) {
        textPrompt = `The first image is a reference photo of the person — ALL photos must feature this SAME person (keep face, hair, skin tone, body identical). The second image is the PRODUCT to feature in every photo.\n\n${prompt}`;
      } else if (avatar) {
        textPrompt = `This is a reference photo of the person. ALL photos in the carousel must feature this SAME person (keep face, hair color, skin tone, body type identical). The person is wearing appropriate, stylish casual clothing in all photos.\n\n${prompt}`;
      } else if (mode === "ad" && productImage) {
        textPrompt = `This is the PRODUCT to feature in every photo of the carousel. Show it in different lifestyle contexts.\n\n${prompt}`;
      }

      contents.push(textPrompt);

      // If no images provided, just use the text prompt
      if (!avatar && !(mode === "ad" && productImage)) {
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

      if (!candidate || (candidate.finishReason && candidate.finishReason === "IMAGE_SAFETY")) {
        if (attempt === 1) {
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
      mode,
    });
  } catch (err) {
    console.error("Generation error:", err.message);
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
