import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const TEXT_MODEL = "gemini-3-flash-preview";

async function analyzeAvatar(ai, avatar) {
  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { inlineData: { data: avatar.base64, mimeType: avatar.mimeType || "image/png" } },
        "Describe this person in 2-3 sentences. Include: age range, gender, ethnicity/skin tone, hair (color, length, style), and distinguishing features. Do NOT describe clothing.",
      ],
      config: { responseModalities: ["TEXT"] },
    });
    return res.text?.trim() || null;
  } catch (err) {
    console.error("Avatar analysis failed:", err.message);
    return null;
  }
}

async function analyzeProduct(ai, productImage) {
  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { inlineData: { data: productImage.base64, mimeType: productImage.mimeType || "image/png" } },
        "Describe this product in 2-3 sentences. Include: type, category, what it's used for, color, shape, size, brand name, packaging type. Be factual.",
      ],
      config: { responseModalities: ["TEXT"] },
    });
    return res.text?.trim() || null;
  } catch (err) {
    console.error("Product analysis failed:", err.message);
    return null;
  }
}

function buildPrompt(vibe, mode, personDescription, productDescription) {
  const isAd = mode === "ad";

  return `You are a content creator planning a high-converting 10-part social media story or carousel.

${personDescription ? `ABOUT YOU:\n${personDescription}` : ""}
${(isAd || productDescription) ? `\nPRODUCT/CORE ITEM:\n${productDescription || "Feature the item mentioned in the vibe."}` : ""}

Vibe: "${vibe}"
Mode: ${mode}

THE ONE CREATOR PRINCIPLE:
- You are filming EVERYTHING yourself with ONE iPhone and TWO hands. 
- A "Selfie" uses one hand for the phone (one hand free).
- A "POV" is from your eyes looking down at your hands/items.
- A "Backcamera" is you standing in front of a propped-up phone (both hands free).
- A "Mirror Selfie" is you seeing yourself + the setup in a reflection.
- NO third-person or "taken by a friend" shots.

CAMERA CONSTRAINTS:
- Use only: selfie, mirror_selfie, pov, backcamera.
- If focusing on a screen, hand, or product detail: MUST use 'pov' and 'requires_avatar: false'.
- If showing a reaction or face: MUST use 'selfie' or 'mirror_selfie'.

${isAd ? `AD NARRATIVE: Create a 10-part story focused on Conversion.
- Use a "Before / After" or "Problem / Solution" flow.
- Ensure the product/results are clearly visible in at least 5 shots.
- Focus on "Application" and "Honest Review" vibes.` : `LIFESTYLE NARRATIVE: Create a 10-part cohesive story focused on Mood.
- Focus on variety and "Authentic Moments".
- Ensure the shots flow logically through the environment.`}

LOGICAL SETTINGS: 
- Match the environment to the Vibe (e.g., Kitchen for food, Bathroom for skincare, Outdoor for city, etc.).

❌ NEGATIVE RULE: DO NOT use any words from the "ABOUT YOU" section in the "prompt" field. DO NOT describe hair, skin, eyes, or ethnicity.
✅ POSITIVE RULE: Use ONLY "this person" or "the influencer".

Output a JSON array of exactly 10 objects:
- "prompt": A minimal situational instruction (e.g., "this person taking a mirror selfie").
- "caption": 1-line Instagram caption with emoji.
- "camera": One of "selfie", "mirror_selfie", "backcamera", "pov".
- "requires_avatar": true if face is visible, false if POV/hands-only.
- "requires_product": true if the product should be featured in this shot.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { vibe, mode = "photodump", avatar, productImage } = body;

    if (!vibe?.trim()) {
      return NextResponse.json({ error: "Please describe the vibe" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Phase 0: Analyze avatar + product in parallel
    const [personDescription, productDescription] = await Promise.all([
      avatar ? analyzeAvatar(ai, avatar) : null,
      mode === "ad" && productImage ? analyzeProduct(ai, productImage) : null,
    ]);

    console.log("Person:", personDescription);
    console.log("Product:", productDescription);

    // Phase 1: Plan 10 scenes
    const prompt = buildPrompt(vibe.trim(), mode, personDescription, productDescription);

    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let scenes = [];
    try {
      scenes = JSON.parse(res.text?.trim() || "[]");
    } catch {
      return NextResponse.json({ error: "Failed to parse scenes. Try again." }, { status: 500 });
    }

    if (!Array.isArray(scenes) || scenes.length < 5) {
      return NextResponse.json({ error: `Got ${scenes.length} scenes instead of 10.` }, { status: 500 });
    }

    return NextResponse.json({ scenes, vibe: vibe.trim(), mode, personDescription, productDescription });
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
