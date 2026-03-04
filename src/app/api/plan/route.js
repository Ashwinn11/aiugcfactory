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
- Ad mode: selfie, mirror_selfie, backcamera, or pov ONLY. Zero third-person/friend shots.

${isAd ? `NARRATIVE: Create a 10-part story. 
- At least 5 shots MUST feature the product/app clearly. 
- The other 5 shots should be LIFESTYLE/CONTEXT shots related to the vibe (e.g., this person's outfit, their environment, or them thinking) to build the emotional story. 
- The product does NOT need to be in every image.` : ""}

Write extremely simple, situational prompts that deeply reflect the "Vibe". 
CRITICAL: The prompt MUST explicitly mention the camera action and anchor it to "this person".
- EVERY prompt must include the phrase "this person" (e.g., "this person's point of view looking down at their hands").

LOGIC RULES FOR CAMERA MODES:
- POV (STRICT): If the shot focuses on a phone screen, a hand, a product, or items on a table, you MUST use 'pov' and set 'requires_avatar: false'.
- BACKCAMERA (STRICT): Use ONLY for shots where "this person" is visible in the frame from a distance (tripod/self-timer style).
- MIRROR SELFIE: Use for showing "this person" AND the phone/screen simultaneously in a reflection.
- SELFIE: Use for "this person's" facial expressions and reactions.

LOGICAL CONSISTENCY RULE:
- Selfie: This person is using 1 hand to take the photo. They ONLY have 1 HAND FREE for props or gestures. They CANNOT be "taking a selfie" while uses both hands to hold a menu or touch their head.
- Mirror Selfie: This person can show a phone screen to the mirror.
- POV: This person is looking down at their hands. This is the BEST mode for showing a phone screen or product details.
- DO NOT ask "this person" to do two conflicting hand-based actions (e.g., "taking a selfie while holding a large product with both hands"). Every selfie prompt MUST be physically possible with one arm extended.

${isAd ? `LOGICAL SETTING RULE: Match the environment to the Vibe and Product.
- Use logical settings: Kitchen for food, Bathroom for skincare, Street/Cafe for lifestyle, Home office for software, etc.` : ""}

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
