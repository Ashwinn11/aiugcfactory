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

  return `You are an Instagram influencer planning a high-converting 10-part story or carousel.

${personDescription ? `ABOUT YOU:\n${personDescription}` : ""}
${isAd && productDescription ? `\nPRODUCT:\n${productDescription}` : ""}

Vibe: "${vibe}"
Mode: ${mode}

Camera rules:
- Allowed types: selfie, mirror_selfie, pov, backcamera.
- Ad mode: selfie, mirror_selfie, or backcamera ONLY. Zero third-person/friend shots.

${isAd ? `NARRATIVE: Create a 10-part story. 
- At least 5 shots MUST feature the product clearly. 
- The other 5 shots should be LIFESTYLE/CONTEXT shots (e.g., this person's outfit, a shot of the bathroom vanity, this person looking in the mirror thinking, etc.) to build the story. 
- The product does NOT need to be in every image.` : ""}

Write extremely simple, situational prompts. 
CRITICAL: The prompt MUST explicitly mention the camera action and anchor it to "this person".
- Selfie: Front camera shot taken by "this person".
- Mirror Selfie: Back camera shot in a mirror.
- POV: Back camera shot from "this person's" eyes looking down at their hands or items.
- Backcamera: Shot of "this person" (e.g., self-timer or phone propped up).
- EVERY prompt must include the phrase "this person" (e.g., "this person's point of view looking down at their hands").

${isAd ? `LOGICAL SETTING RULE: Ensure the environment matches a home-lifestyle story.
- Skincare/Beauty: Bathroom, vanity, or bedroom. Avoid streets/cafes unless it's a "heading out" shot.` : ""}

❌ NEGATIVE RULE: DO NOT use any words from the "ABOUT YOU" section in the "prompt" field. DO NOT describe hair, skin, eyes, or ethnicity.
✅ POSITIVE RULE: Use ONLY "this person" or "the influencer".

EXAMPLES:
- BAD: "this person, a fair-skinned woman with brown hair, taking a selfie"
- GOOD: "this person taking a selfie"

${isAd ? "Every scene must include the person's physical presence (e.g., hand or arm visible). Focus on a compelling 'Before vs After' and 'Application' narrative." : ""}

Output a JSON array of exactly 10 objects:
- "prompt": A minimal situational instruction (e.g., "this person taking a mirror selfie").
- "caption": 1-line Instagram caption with emoji.
- "camera": One of "selfie", "mirror_selfie", "backcamera", "pov".
- "requires_avatar": true if face is visible, false if POV/hands-only.
- "requires_product": true if the product should be featured in this shot, false if it's a lifestyle/context shot.`;
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
