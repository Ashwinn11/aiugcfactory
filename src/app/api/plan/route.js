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

For each scene, write:
- "prompt": A SHORT, minimal description of the scene and action ONLY (max 15 words). Always refer to the creator as "this person". NEVER mention the camera mode in the prompt (no "taking a selfie", no "mirror selfie", no "POV shot"). The camera field handles perspective separately.
- "caption": A punchy 1-line Instagram caption with emoji.
- "camera": One of "selfie", "mirror_selfie", "backcamera", "pov".
- "requires_avatar": true if the person's face should be visible, false for hands-only/POV shots.
- "requires_product": true if the product is featured.

PROMPT EXAMPLES:
- GOOD: "this person rubbing their eyes in a dark bedroom"
- GOOD: "this person's hand holding a coffee cup at a cafe table"
- BAD: "this person taking a selfie while rubbing their eyes"
- BAD: "A candid back camera photo of this person in a coffee shop"

Output a JSON array of exactly 5 objects.`;
}

// ═══ PHASE 2: VALIDATOR (Enforces physical rules, fixes issues) ═══
async function validateScenes(ai, scenes) {
  const validatorPrompt = `You are a "Physical Reality Checker" for AI-generated photo prompts.

RULES (The One Creator Principle):
- The creator films EVERYTHING themselves with ONE phone and TWO hands.
- "selfie": One hand holds the phone. ONE hand free. Face visible. Best for: reactions, expressions, simple gestures. requires_avatar MUST be true.
- "mirror_selfie": One hand holds the phone, reflected in mirror. ONE hand free. Face visible. Best for: outfit checks, simple poses. requires_avatar MUST be true.
- "pov": One hand holds the phone, shot from the eyes. ONE hand free. NO face visible. Best for: looking at one item, holding one thing. requires_avatar MUST be false.
- "backcamera": Phone is NOT in the creator's hands. BOTH hands free. Face visible. Best for: actions, applying products, holding multiple items, posing. requires_avatar MUST be true.

VALIDATION CHECKS:
1. If a prompt describes ONLY hands, a screen, or a product close-up with NO face/person reaction → camera MUST be "pov". But if the person is also reacting to or discovering the product (face visible), keep the original camera.
2. If a prompt describes a TWO-HANDED action (applying product, using a tool, holding something with both hands) → camera MUST be "backcamera".
3. If camera is "pov" but requires_avatar is true → Fix: set requires_avatar to false.
4. If camera is "selfie" or "mirror_selfie" but requires_avatar is false → Fix: set requires_avatar to true.
5. If camera is "pov", "selfie", or "mirror_selfie", only ONE hand is free. Fix any prompt that implies both hands are in use.
6. CAMERA DIVERSITY: The 5 scenes should use at least 3 different camera types and include at least one "selfie". If no selfie exists, convert the most suitable scene to a selfie.
7. Ensure prompts don't describe physically impossible actions for the chosen camera mode.

Review and fix these scenes. Return the corrected JSON array. If a scene is fine, return it unchanged.

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
    try {
      scenes = JSON.parse(res.text?.trim() || "[]");
    } catch {
      return NextResponse.json({ error: "Failed to parse scenes. Try again." }, { status: 500 });
    }

    if (!Array.isArray(scenes) || scenes.length < 3) {
      return NextResponse.json({ error: `Got ${scenes.length} scenes instead of 5.` }, { status: 500 });
    }

    // Phase 2: Validate & fix scenes
    console.log("Raw scenes:", JSON.stringify(scenes, null, 2));
    const validatedScenes = await validateScenes(ai, scenes);
    console.log("Validated scenes:", JSON.stringify(validatedScenes, null, 2));

    return NextResponse.json({ scenes: validatedScenes, vibe: vibe.trim(), mode, personDescription, productDescription });
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
