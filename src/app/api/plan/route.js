import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const TEXT_MODEL = "gemini-3.1-flash-image-preview";



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

// Load hook strategies
function getHookStrategies() {
  try {
    const data = readFileSync(join(process.cwd(), "prompts", "hooks.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ═══ PHASE 1: CREATIVE PLANNER ═══
function buildPlannerPrompt(vibe, mode, personDescription, productDescription, category) {
  const isAd = mode === "ad";
  const hookStrategies = isAd ? getHookStrategies() : null;
  const slideCount = isAd ? 6 : 5;

  // Build category-specific section for ads
  let categorySection = "";
  if (isAd) {
    const hookMenu = hookStrategies?.categories.map(c => 
      `### ${c.name}\n- Description: ${c.description}\n- Formulas: ${c.formulas.join(" | ")}`
    ).join("\n\n");

    categorySection = `This is a HIGH-CONVERTING VIRAL AD.

STRUCTURE (Choose the best fit for the content):

Option A: 5-Slide "Value" Formula (Best for quick results/tips)
1. **HOOK**: Stop the scroll using a "Global Hook Strategy".
2. **PROBLEM**: Describe the audience's specific mistake or frustration.
3. **INSIGHT**: Reveal the "Hidden Reason" why they are failing.
4. **VALUE/STEPS**: Provide 2-3 actionable tips or product benefits.
5. **RESULT + CTA**: The payoff (lifestyle upgrade) + clear call to action.

Option B: 6-Slide "Storytelling" Formula (Best for deep connection/empathy)
1. **HOOK**: Stop the scroll using a "Global Hook Strategy".
2. **RELATABLE PROBLEM**: Humanize the struggle.
3. **MISTAKE/MYTH**: Challenge a common belief or show a failed attempt.
4. **KEY INSIGHT**: The "Aha!" moment/discovery of the product.
5. **ACTIONABLE TIPS**: Practical ways the product helps them.
6. **RESULT + CTA**: The final transformation + clear call to action.

THE PSYCHOLOGICAL FLOW:
**Curiosity → Tension → Explanation → Payoff.**

GLOBAL HOOK STRATEGIES (Choose the single most effective one for Slide 1):
${hookMenu}

GLOBAL HOOK ENHANCEMENT:
- Emotional Triggers: ${hookStrategies?.enhancements.emotional_triggers.join(", ")}
- Power Words: ${hookStrategies?.enhancements.power_words.join(", ")}

IMPORTANT: Not every frame needs a person. Set requires_avatar: false for scene-only frames.`;
  }

  return `You are a top-tier social media content creator. Plan a ${slideCount}-part visual story for a TikTok/Instagram carousel.

${personDescription ? `ABOUT THE CREATOR:\n${personDescription}` : ""}
${productDescription ? `\nPRODUCT:\n${productDescription}` : ""}

${isAd ? `Product Description: "${vibe}"` : `Vibe: "${vibe}"`}
Mode: ${mode}

${categorySection || `This is a LIFESTYLE post. Tell an authentic, mood-driven story that flows naturally.`}

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
    - "action": What the person is doing in this scene. Be specific and visual. Do NOT describe camera angles, shot types, or perspective here. Only describe WHAT is happening. Even for product/food/room shots, include the person's hand or arm in frame (e.g., "hand reaching for the plate"). UGC always has human presence.
    - "expression": Facial expression. Empty string if face not in scene.
    - "environment": Specific setting with detail.
    - "key_item": Main product/object in frame. Empty string if none.
    ${mode !== "post" ? `- "outfit": What the person is wearing in this specific scene.` : ""}
  - "caption": A punchy 1-line caption with emoji.
  - "requires_avatar": true if person's FACE should be visible, false if face is not shown (but hands/body can still be present).
  - "requires_product": true if the product is featured.`;
}

// ═══ PHASE 2: ANGLE ASSIGNMENT (Decides how to film each scene) ═══
async function assignAngles(ai, scenes, mode) {
  const isAd = mode === "ad";
  const anglePrompt = `You are a UGC camera director. Given a list of planned scenes, assign the best camera angle for each one.

${isAd ? 
  `THIS IS A STRICT UGC AD:
  - Every shot MUST feel "Self-Filmed" by the influencer.
  - ONLY 3 ALLOWED ANGLES:
    1. "Selfie": Front camera, face close, influencer holding phone.
    2. "Mirror Selfie": Influencer films their reflection in a mirror.
    3. "First-person POV": Back camera pointing at hands/product from eyes.
  - FORBIDDEN: No tripods. No distance shots. No "invisible friend" filming. No full body shots from far away.
  - The influencer must logically be holding the camera in every frame.` 
  : "This is a social media post. Use a mix of angles for variety."}

Think about HOW a real person would film this on their phone:
- Selfie: Phone held by the person. Face is close. ONE hand is busy holding the phone (not visible).
- Mirror Selfie: Reflection in mirror. Phone is visible.
- First-person POV: Camera is at eye-level. We see the person's hands/arms but NOT their face.

RULES FOR IMMERSION:
- Do NOT mention "a friend", "someone else", or "the camera person" filming. 
- Do NOT describe the recording device (phone/camera) as being visible in the frame, unless it is a MIRROR selfie.
- Total hands visible in the frame (hands_visible) must be accurate:
  - Selfie: MAX 1 hand visible (since the other holds the phone).
  - Mirror Selfie: 1 or 2 hands visible.
  - POV: 1 or 2 hands visible.
  - Tripod (LIFESTYLE POST ONLY): 0, 1, or 2 hands visible.

For each scene, add these fields to scene_prompt:
- "angle": Natural description of the shot (e.g., "Standard selfie looking up", "Overhead POV", "Full body mirror reflection").
- "hands_visible": Exact number of hands clearly seen in the image (0, 1, or 2).
- "hand_action": What the visible hand(s) are doing. If hands_visible is 0, leave empty.

Return the full JSON array.
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
    return scenes;
  } catch (err) {
    return scenes;
  }
}

// ═══ PHASE 3: VALIDATOR (Enforces physical rules, fixes issues) ═══
async function validateScenes(ai, scenes) {
  const validatorPrompt = `You are a "Physical Reality Checker" for AI-generated photo scene plans.

CRITICAL PHYSICAL AUDIT:
1. **HAND COUNT AUDIT**: Count the number of hands mentioned in "hand_action". If you describe "both hands" or two separate hands doing things, "hands_visible" MUST be 2. If you only describe one hand, "hands_visible" MUST be 1. 100% agreement required.
2. **SHOT TYPE AUDIT**: 
   - If "angle" is a "Selfie" (not mirror), hands_visible CANNOT be 2. One hand is holding the phone.
   - If "angle" is "POV", requires_avatar MUST be false (we don't see our own face from our eyes).
   - If "requires_avatar" is false, "expression" MUST be empty.
3. **UGC IMMERSION**: Ensure no "ghost cameras" or "friends" are mentioned. No hands holding phones should be visible unless it's a mirror.

If a scene fails any audit, fix it by modifying "angle", "hands_visible", or "hand_action" until it is physically possible for ONE person to take the photo.

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
    return scenes;
  } catch (err) {
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
    const scenesWithAngles = await assignAngles(ai, scenes, mode);
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
