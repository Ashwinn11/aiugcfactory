import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const TEXT_MODEL = "gemini-3.1-flash-image-preview"; // For product analysis (cheap, fast)

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
// Each photo MUST specify WHO is holding the camera

const MODE_PROMPTS = {
  photodump: `You are an Instagram influencer creating a photo dump carousel. Given a vibe, generate 5 photos that look like real iPhone snapshots from DIFFERENT moments — the kind you'd actually post as a photo dump.

For EVERY photo, you MUST specify who is taking the photo and how. Choose from:
- FRONT CAMERA SELFIE: person's arm visible in frame, slight wide-angle distortion from arm distance, phone held at arm's length
- MIRROR SELFIE: full body visible in reflection, phone visible in hand in the mirror, bathroom/gym/elevator mirror
- 0.5x ULTRAWIDE SELFIE: exaggerated wide-angle, arm very visible, group-friendly
- FRIEND'S SHOT: taken by a friend — the person is looking at the camera, smiling or posing, natural eye contact (as if a real friend is holding the phone)
- TIMER/TRIPOD SHOT: person posing at a distance, phone propped up against something
- NO PERSON: close-up of an object only (food, drink, bag, shoes, view) — no person needed

Mix these naturally across the 5 photos. A real photo dump would have 2 selfies, 1 friend shot, and 2 object/view close-ups.

Each photo should feel like a DIFFERENT moment — different lighting, time, maybe different outfits.

Before each photo, write a casual 1-line Instagram caption with emoji.

Important: correct human anatomy only — 2 arms, 2 legs, 5 fingers per hand, no extras.`,

  carousel: `You are an Instagram influencer creating a post carousel from ONE specific occasion. Given a vibe, generate 5 photos that tell a cohesive visual story from a single event — the kind you'd swipe through on an Instagram post.

All photos should feel like the SAME occasion (same outfit, same location, same time of day).

For EVERY photo, you MUST specify who is taking it:
- FRONT CAMERA SELFIE: arm visible, close to face, at the event
- MIRROR SELFIE: getting ready before the event, full outfit visible
- FRIEND'S SHOT: someone at the event took this — person is looking at camera with natural eye contact, aware they're being photographed
- NO PERSON: close-up detail shot (the food, the cocktail, the view, the decor, a menu, the sunset)

A natural carousel from one occasion would be: 1 mirror selfie (getting ready), 1 friend's shot at the place, 1 selfie at the spot, 2 detail/vibe close-ups (no person).

Before each photo, write a short Instagram caption with emoji.

Important: correct human anatomy only — 2 arms, 2 legs, 5 fingers per hand, no extras.`,

  ad: `You are creating organic influencer-style content featuring a PRODUCT. This should look like a real influencer genuinely using and loving this product — NOT a corporate ad, NOT stock photos.

For EVERY photo, you MUST specify who is taking it:
- FRONT CAMERA SELFIE: person holding or using the product, arm visible, casual selfie with the product
- MIRROR SELFIE: person using the product in a mirror (applying serum, wearing accessory, outfit with product)
- CLOSE-UP HANDS: tight shot of hands holding/using/opening the product — NO full body, just hands and product
- FLAT LAY: overhead shot of product arranged with complementary items on a surface
- NO PERSON: the product by itself in a lifestyle setting (on a bathroom shelf, kitchen counter, bedside table)

A natural influencer product post would be: 1 selfie with product, 1 close-up of hands using it, 1 flat lay, 1 product in context (no person), 1 mirror/lifestyle shot.

The product should appear in EVERY image but feel natural and organic — never staged, never commercial.

Before each photo, write a casual Instagram caption with emoji that naturally mentions the product.

Important: correct human anatomy only — 2 arms, 2 legs, 5 fingers per hand, no extras.`,
};

// ──── Product image analysis ────

async function analyzeProductImage(ai, productImage) {
  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          inlineData: {
            data: productImage.base64,
            mimeType: productImage.mimeType || "image/png",
          },
        },
        "Analyze this product image. In 1-2 sentences, describe: what the product is (type, category), its color/appearance, any visible brand name or text on the packaging, and its approximate size. Be specific and factual.",
      ],
      config: {
        responseModalities: ["TEXT"],
      },
    });

    return response.text?.trim() || null;
  } catch (err) {
    console.error("Product analysis failed:", err.message);
    return null;
  }
}

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
      productImage,
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

    // ──── Analyze product image if in ad mode ────
    let productDescription = null;
    if (mode === "ad" && productImage) {
      productDescription = await analyzeProductImage(ai, productImage);
    }

    // Select mode-specific system prompt
    const modeSystem = MODE_PROMPTS[mode] || MODE_PROMPTS.photodump;
    const systemInstruction = `${modeSystem}\n\nPhotography style reference:\n${photoPrompt}`;

    // Build the user prompt
    let basePrompt;
    if (mode === "ad") {
      const productInfo = productDescription
        ? `\n\nProduct details (from uploaded image): ${productDescription}`
        : "";
      basePrompt = `Create a 5-photo influencer carousel for this vibe:

"${vibe.trim()}"${productInfo}

Generate 5 distinct photos showing this product in organic, everyday use. Before each photo, write a casual Instagram caption with emoji. This should look like a real influencer's content, NOT a corporate ad.`;
    } else if (mode === "carousel") {
      basePrompt = `Create a 5-photo Instagram post carousel from this ONE occasion:

"${vibe.trim()}"

Generate 5 photos that tell the story of this moment — establishing shot, details, candid, close-ups, the vibe. All from the same event/time. Before each photo, write a short Instagram caption with emoji.`;
    } else {
      basePrompt = `Create a 5-photo Instagram photo dump carousel for this vibe:

"${vibe.trim()}"

Generate 5 distinct photos from different moments. Before each photo, write a short casual Instagram caption with emoji. Each photo should feel like a different time/place. Shot on iPhone, UGC style.`;
    }

    // Try generation with retry on IMAGE_SAFETY
    async function tryGenerate(prompt, attempt = 1) {
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

      // Build text prompt with image references
      let textPrompt = prompt;
      if (avatar && mode === "ad" && productImage) {
        textPrompt = `The first image is a reference of the PERSON — keep their face, hair, skin tone, body identical in every photo. The second image is the PRODUCT — feature this exact product in every photo.\n\n${prompt}`;
      } else if (avatar) {
        textPrompt = `This is a reference photo of the person. ALL photos must feature this SAME person (keep face, hair color, skin tone, body type identical). The person wears appropriate stylish casual clothing.\n\n${prompt}`;
      } else if (mode === "ad" && productImage) {
        textPrompt = `This is the PRODUCT to feature in every photo of the carousel. Show this exact product in different lifestyle contexts.\n\n${prompt}`;
      }

      contents.push(textPrompt);

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
