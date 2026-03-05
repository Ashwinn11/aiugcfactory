import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const TEXT_MODEL = "gemini-3.1-flash-image-preview";

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

// ═══ PHASE 1: CREATIVE PLANNER (No rules, pure creativity) ═══
function buildPlannerPrompt(vibe, mode, personDescription, productDescription) {
  const isAd = mode === "ad";

  return `You are a top-tier social media content creator. Plan a 5-part visual story for a TikTok/Instagram carousel.

${personDescription ? `ABOUT THE CREATOR:\n${personDescription}` : ""}
${productDescription ? `\nPRODUCT:\n${productDescription}` : ""}

Vibe: "${vibe}"
Mode: ${mode}

${isAd
    ? `This is an AD. Follow the TikTok Carousel Hook Methodology exactly:
Frame 1 — HOOK: A bold, relatable problem statement. Grab attention. No product visible.
Frame 2 — AGITATE: Show the frustration or pain point deeper. Make the viewer feel it. No product yet.
Frame 3 — DISCOVERY: Introduce the product as the solution. First time the product appears.
Frame 4 — RESULT: Show the transformation or benefit. Product in use or results visible.
Frame 5 — CTA: Confident closing shot. "Link in bio" energy. Product optional.`
    : `This is a LIFESTYLE post. Tell an authentic, mood-driven story that flows naturally.`}

CAMERA VARIETY: Use at least 3 different camera types across the 5 scenes. Must include at least one "selfie".

${mode !== "photodump" 
    ? `OUTFIT CONSISTENCY: Since this is ONE story, generate a "styling" object that applies to ALL 5 scenes:
- "outfit": What the person is wearing (e.g., "oversized white tee, high-waisted blue jeans, white sneakers")
- "hair": Hair style for the story (e.g., "messy bun with loose strands")`
    : `OUTFIT VARIETY: Since this is a photo dump (different moments), each scene can have a different outfit.`}

Output a JSON object with:
${mode !== "photodump" ? `- "styling": { "outfit": "...", "hair": "..." } (shared across all scenes)` : ""}
- "scenes": An array of exactly 5 scene objects, each with:
  - "scene_prompt": An object describing the scene:
    - "expression": Facial expression (e.g., "frustrated frown", "big confident smile"). Empty string if POV.
    - "pose": Body angle and action (e.g., "looking down at hands", "standing with arms crossed", "leaning against a wall").
    - "free_hand": What the ONE visible free hand is doing. For backcamera, describe BOTH hands.
    - "environment": Specific setting (e.g., "messy bathroom vanity with products scattered", "bright kitchen counter near a window").
    - "key_item": Main product/object in frame. Empty string if none.
    ${mode === "photodump" ? `- "outfit": What the person is wearing in this scene.` : ""}
  - "caption": A punchy 1-line Instagram caption with emoji.
  - "camera": One of "selfie", "mirror_selfie", "backcamera", "pov".
  - "requires_avatar": true if face visible, false for hands-only/POV.
  - "requires_product": true if the product is featured.

RULES FOR "free_hand":
- selfie/mirror_selfie/pov: Describe ONLY ONE hand. The other hand holds the phone and is INVISIBLE.
- backcamera: Describe what BOTH hands are doing. This is the only mode for two-handed actions.`;
}

// ═══ PHASE 2: VALIDATOR (Enforces physical rules, fixes issues) ═══
async function validateScenes(ai, scenes) {
  const validatorPrompt = `You are a "Physical Reality Checker" for AI-generated photo scene plans.

Each scene has a "scene_prompt" object with: expression, free_hand, environment, key_item.

RULES (The One Creator Principle):
- The creator films EVERYTHING themselves with ONE phone and TWO hands.
- "selfie": ONE hand free. Face visible. requires_avatar MUST be true.
- "mirror_selfie": ONE hand free. Face visible in reflection. requires_avatar MUST be true. The "environment" should include "mirror".
- "pov": ONE hand free. NO face. requires_avatar MUST be false. "expression" should be empty.
- "backcamera": BOTH hands free. Face visible. requires_avatar MUST be true.

VALIDATION CHECKS:
1. If "environment" mentions "mirror" or "reflection" → camera MUST be "mirror_selfie".
2. If "free_hand" describes TWO hands or a two-handed action (e.g., "both hands holding", "applying with dropper", "opening a box") → camera MUST be "backcamera" and "free_hand" should describe BOTH hands.
3. If camera is "selfie", "mirror_selfie", or "pov" → "free_hand" must describe only ONE hand's action. Remove any reference to a second hand.
4. If camera is "pov" → requires_avatar MUST be false, "expression" should be empty.
5. If camera is "selfie" or "mirror_selfie" → requires_avatar MUST be true.
6. CAMERA DIVERSITY: Use at least 3 different camera types across 5 scenes. Must include at least one "selfie".
7. When changing a camera mode, adapt scene_prompt fields to match.

Review and fix these scenes. Return the corrected JSON array with the same structure.

SCENES:
${JSON.stringify(scenes, null, 2)}`;

  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: validatorPrompt,
      config: { responseMimeType: "application/json" },
    });

    const validated = JSON.parse(res.text?.trim() || "[]");
    if (Array.isArray(validated) && validated.length === scenes.length) {
      return validated;
    }
    console.warn("Validator returned unexpected format, using original scenes");
    return scenes;
  } catch (err) {
    console.error("Validation failed, using original scenes:", err.message);
    return scenes;
  }
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

    // Phase 1: Creative Planning (no rules, pure creativity)
    const prompt = buildPlannerPrompt(vibe.trim(), mode, personDescription, productDescription);

    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let scenes = [];
    let styling = null;
    try {
      const parsed = JSON.parse(res.text?.trim() || "{}");
      // Handle both { scenes: [...] } and flat array formats
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        scenes = parsed.scenes;
        styling = parsed.styling || null;
      } else if (Array.isArray(parsed)) {
        scenes = parsed;
      } else {
        return NextResponse.json({ error: "Unexpected response format. Try again." }, { status: 500 });
      }
    } catch {
      return NextResponse.json({ error: "Failed to parse scenes. Try again." }, { status: 500 });
    }

    if (scenes.length < 3) {
      return NextResponse.json({ error: `Got ${scenes.length} scenes instead of 5.` }, { status: 500 });
    }

    // Phase 2: Validate & fix scenes
    console.log("Styling:", JSON.stringify(styling, null, 2));
    console.log("Raw scenes:", JSON.stringify(scenes, null, 2));
    const validatedScenes = await validateScenes(ai, scenes);
    console.log("Validated scenes:", JSON.stringify(validatedScenes, null, 2));

    return NextResponse.json({ scenes: validatedScenes, styling, vibe: vibe.trim(), mode, personDescription, productDescription });
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
