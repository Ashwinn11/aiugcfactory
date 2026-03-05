import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const TEXT_MODEL = "gemini-3.1-flash-image-preview";

// Load category templates
function getCategoryConfig(categoryId) {
  try {
    const data = readFileSync(join(process.cwd(), "prompts", "categories.json"), "utf-8");
    const categories = JSON.parse(data);
    return categories[categoryId] || categories["beauty"];
  } catch {
    return null;
  }
}

async function analyzeAvatar(ai, avatar) {
  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        { inlineData: { data: avatar.base64, mimeType: avatar.mimeType || "image/png" } },
        "Describe this person's FACE and BODY FEATURES only in 2-3 sentences. Include: age range, gender, ethnicity/skin tone, hair (color, length, style), and distinguishing facial features (eye color, moles, etc). Do NOT describe clothing, pose, hand positions, body gestures, or what they are doing.",
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

// ═══ PHASE 1: CREATIVE PLANNER ═══
function buildPlannerPrompt(vibe, mode, personDescription, productDescription, category) {
  const isAd = mode === "ad";
  const catConfig = isAd ? getCategoryConfig(category) : null;
  const slideCount = isAd ? 6 : 5;

  // Build category-specific section for ads
  let categorySection = "";
  if (isAd && catConfig) {
    const slides = Object.entries(catConfig.slide_structure).map(([key, desc]) => {
      const num = key.split("_")[0];
      const name = key.split("_").slice(1).join(" ").toUpperCase();
      return `Slide ${num} — ${name}: ${desc}`;
    }).join("\n");

    categorySection = `This is an AD for a ${catConfig.name} product.

CATEGORY CONCEPT: ${catConfig.slide_concept}

SLIDE STRUCTURE (exactly 6 slides):
${slides}

HOOK FORMULAS (use one or adapt):
${catConfig.hook_formulas.map(h => `- "${h}"`).join("\n")}

PROMPT RULES:
- Lock across all slides: ${catConfig.prompt_rules.lock_across_all_slides.join(", ")}
- Change per slide ONLY: ${catConfig.prompt_rules.change_per_slide.join(", ")}
${catConfig.prompt_rules.preservation ? `- PRESERVATION: ${catConfig.prompt_rules.preservation}` : ""}
${catConfig.prompt_rules.style_options ? `- Style options: ${catConfig.prompt_rules.style_options.join(", ")}` : ""}

IMPORTANT: Not every frame needs a person. Set requires_avatar: false for scene-only frames.`;
  } else if (isAd) {
    categorySection = `This is an AD. Follow a 6-slide Hook methodology.`;
  }

  return `You are a top-tier social media content creator. Plan a ${slideCount}-part visual story for a TikTok/Instagram carousel.

${personDescription ? `ABOUT THE CREATOR:\n${personDescription}` : ""}
${productDescription ? `\nPRODUCT:\n${productDescription}` : ""}

${isAd ? `Product Description: "${vibe}"` : `Vibe: "${vibe}"`}
Mode: ${mode}

${isAd ? categorySection : `This is a LIFESTYLE post. Tell an authentic, mood-driven story that flows naturally.`}

${mode === "post" 
    ? `OUTFIT CONSISTENCY: Since this is ONE moment, generate a "styling" object that applies to ALL scenes:
- "outfit": What the person is wearing
- "hair": Hair style for the story`
    : mode === "ad"
    ? `OUTFIT VARIETY: This ad tells a story over multiple days/moments (problem → discovery → transformation). Each scene should have a contextually appropriate outfit for that moment.`
    : `OUTFIT VARIETY: Each scene can have a different outfit.`}

Focus ONLY on the story. Do NOT think about camera angles — that comes later.

Output a JSON object with:
${mode === "post" ? `- "styling": { "outfit": "...", "hair": "..." } (shared across all scenes)` : ""}
- "scenes": An array of exactly ${slideCount} scene objects, each with:
  - "scene_prompt": An object describing what happens:
    - "action": What the person is doing in this scene. Be specific and visual. Even for product/food/room shots, include the person's hand or arm in frame (e.g., "hand reaching for the plate", "fingers holding a fork"). UGC always has human presence.
    - "expression": Facial expression. Empty string if face not in scene.
    - "environment": Specific setting with detail.
    - "key_item": Main product/object in frame. Empty string if none.
    ${mode !== "post" ? `- "outfit": What the person is wearing in this specific scene.` : ""}
  - "caption": A punchy 1-line caption with emoji.
  - "requires_avatar": true if person's FACE should be visible, false if face is not shown (but hands/body can still be present).
  - "requires_product": true if the product is featured.`;
}

// ═══ PHASE 2: ANGLE ASSIGNMENT (Decides how to film each scene) ═══
async function assignAngles(ai, scenes) {
  const anglePrompt = `You are a UGC camera director. Given a list of planned scenes, assign the best camera angle for each one.

Think about HOW a real person would film this on their phone:
- Showing their face reacting? → selfie angle (close-up from below, one arm out)
- Showing something in their hand? → looking down at hand (POV-style)
- Showing their full body or outfit? → friend/timer shot from a few feet away
- Showing food on a plate? → overhead POV looking down, with a hand holding utensil or reaching for food
- Showing an app screen on a phone? → over-the-shoulder or looking down at phone in hand
- Showing themselves in a mirror? → mirror reflection with phone visible
- Showing a room/space? → wide angle, but include a hand or arm at the edge of frame

UGC ALWAYS has human presence. Even when requires_avatar is false (no face), include the person's hand, arm, or body in frame. Pure scene-only shots with zero human presence should be very rare.

For each scene, add these fields to scene_prompt:
- "angle": Natural description of how the camera captures this scene
- "hands_visible": 1 (person holding phone to film, one hand free) or 2 (filmed by friend/timer, both hands free). Prefer at least 1 hand visible in EVERY scene.
- "hand_action": What the visible hand(s) are doing.

PHYSICAL RULES:
- If hands_visible = 1, describe ONLY one hand. The other holds the phone.
- If hands_visible = 2, describe both hands.
- Two-handed actions (opening box, clapping, holding with both hands) REQUIRE hands_visible = 2.
- Ensure at least 3 different angle styles across all scenes.

Return the full JSON array with angle, hands_visible, and hand_action added to each scene_prompt.

SCENES:
${JSON.stringify(scenes, null, 2)}`;

  try {
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: anglePrompt,
      config: { responseMimeType: "application/json" },
    });

    const result = JSON.parse(res.text?.trim() || "[]");
    if (Array.isArray(result) && result.length === scenes.length) {
      return result;
    }
    console.warn("Angle assignment returned unexpected format, using original scenes");
    return scenes;
  } catch (err) {
    console.error("Angle assignment failed, using original scenes:", err.message);
    return scenes;
  }
}

// ═══ PHASE 3: VALIDATOR (Enforces physical rules, fixes issues) ═══
async function validateScenes(ai, scenes) {
  const validatorPrompt = `You are a "Physical Reality Checker" for AI-generated photo scene plans.

Each scene has a "scene_prompt" with: angle, expression, hands_visible, hand_action, environment, key_item.

VALIDATION CHECKS:
1. HANDS COUNT: If "hand_action" describes a two-handed action (opening, applying with both hands, holding two items) then "hands_visible" MUST be 2 and the "angle" must be from a distance (not selfie/mirror). Fix if wrong.
2. FACE vs ANGLE: If "angle" implies the person is behind the camera (looking down, first-person POV), then requires_avatar MUST be false and "expression" should be empty.
3. FACE vs ANGLE: If "angle" shows the person's face (selfie, mirror, from a distance), then requires_avatar MUST be true.
4. HANDS vs ANGLE: If "angle" implies holding the phone (selfie-style, close-up from below), then hands_visible MUST be 1 max.
5. HANDS vs ANGLE: If "angle" implies shot by a friend/timer (from a distance, full body), hands_visible can be 0, 1, or 2.
6. MIRROR RULE: If "environment" or "angle" mentions "mirror" or "reflection", the "angle" MUST describe a mirror selfie (e.g., "Reflected in a mirror, phone visible in one hand"). The person sees themselves through the mirror. hands_visible = 1 (phone in one hand).
7. ANGLE DIVERSITY: Ensure at least 3 distinctly different angles across all scenes. Not all scenes should look the same.
8. If anything contradicts, fix by adjusting either the angle OR the hand_action to make it physically possible. Prefer keeping the scene's creative intent.

Return the corrected JSON array. If a scene is fine, return it unchanged.

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
    const { vibe, mode = "photodump", avatar, productImage, category } = body;

    if (!vibe?.trim()) {
      return NextResponse.json({ error: mode === "ad" ? "Please describe the product" : "Please describe the vibe" }, { status: 400 });
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

    // Phase 1: Creative Planning
    const prompt = buildPlannerPrompt(vibe.trim(), mode, personDescription, productDescription, category);

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

    const expectedSlides = mode === "ad" ? 6 : 5;
    if (scenes.length < 3) {
      return NextResponse.json({ error: `Got ${scenes.length} scenes instead of ${expectedSlides}.` }, { status: 500 });
    }

    // Phase 2: Assign camera angles based on scene content
    console.log("Styling:", JSON.stringify(styling, null, 2));
    console.log("Raw scenes (story only):", JSON.stringify(scenes, null, 2));
    const scenesWithAngles = await assignAngles(ai, scenes);
    console.log("Scenes with angles:", JSON.stringify(scenesWithAngles, null, 2));

    // Phase 3: Validate physical rules
    const validatedScenes = await validateScenes(ai, scenesWithAngles);
    console.log("Validated scenes:", JSON.stringify(validatedScenes, null, 2));

    return NextResponse.json({ scenes: validatedScenes, styling, vibe: vibe.trim(), mode, personDescription, productDescription });
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
