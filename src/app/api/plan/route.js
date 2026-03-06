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

function getHookStrategies() {
  try {
    const data = readFileSync(join(process.cwd(), "prompts", "hooks.json"), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ═══ THE CONSOLIDATED JSON PLANNER ═══
function buildPlannerPrompt(vibe, mode, personDescription, productDescription) {
  const isAd = mode === "ad";
  const isPost = mode === "post";
  const hookStrategies = isAd ? getHookStrategies() : null;
  const slideCount = isAd ? 6 : 5;

  const hookMenu = hookStrategies?.categories.map(c => 
    `- ${c.name}: ${c.formulas.join(" | ")}`
  ).join("\n") || "";

  const angleInstruction = isAd 
    ? "STRICT AD RULE: Use ONLY 'Selfie', 'Mirror Selfie', or 'First-person POV'. Every slide must feel self-filmed by the influencer."
    : "MIXED MODES: Use a mix of 'Selfie', 'Mirror Selfie', 'First-person POV', and 'Standard (Tripod/Distance)' for variety.";

  const modeLogic = isPost 
    ? "OCCASION RULE: This is a single occasion. Every slide must feature the SAME OUTFIT, SAME ACCESSORIES, SAME VIBE, and SAME TIME of day. Character consistency is paramount."
    : isAd 
    ? "NATURAL FLOW: This ad spans multiple moments (Problem -> Insight -> Transformation). Outfits and locations should change logically to show the story over time."
    : "RANDOM DUMP: This is a monthly recap. Every slide should feel like a different day/moment with different outfits and locations.";

  const captionInstruction = isAd 
    ? "AD COPY: For Slide 1, this MUST be a viral hook from the provided strategies. For subsequent slides, it should be the key messaging, punchline, or 'benefit' text for that slide. Keep it extremely punchy and click-driven."
    : "SOCIAL CAPTION: A punchy 1-line caption with emoji that feels like an authentic personal post.";

  return `You are a world-class Social Media Strategist and AI Prompt Engineer. Generate a ${slideCount}-part JSON plan for a carousel.

USER INPUT:
- Mode: ${mode} (Rules: ${modeLogic})
- Subject Description: ${personDescription || "Generic attractive person"}
- Product Description: ${productDescription || "None"}
- Vibe/Instruction: ${vibe}

CAMERA & PHYSICAL REALITY RULES (CRITICAL):
- ${angleInstruction}
- If "Selfie": "perspective" MUST be "Close-up front-facing camera selfie, one extended arm holding the camera out of frame". EXACTLY 1 hand can be visible doing an action. The other hand is holding the camera.
- If "First-person POV": "perspective" MUST be "First-person point-of-view eye-level shot". Face NOT visible. EXACTLY 1 hand can be visible doing an action. The other hand is holding the camera.
- If "Mirror Selfie": BOTH hands can be visible (one holding the phone in the reflection).
- NEVER describe impossible actions requiring 3 hands (e.g., taking a selfie in your left hand, holding a phone in your right hand, AND pointing). Everything must physically fit the hands available.

STRATEGY (For Ads Slide 1):
${hookMenu}

OUTPUT FORMAT:
Generate a JSON object with a "scenes" array. Each scene MUST follow this EXACT structure:
{
  "caption": "${captionInstruction}",
  "requires_avatar": boolean,
  "requires_product": boolean,
  "json_prompt": {
    "subject": {
      "demographics": "Detailed description of the subject based on Subject Description",
      "hair": "Specific hair details",
      "skin_texture": "Describe real skin: visible pores, natural blemishes, matte finish, NO airbrushing",
      "facial_expression": "Specific emotion and mouth/eye state"
    },
    "apparel": {
      "outfit_style": "Style name",
      "top": "Detailed description of top piece",
      "bottoms": "Detailed description of bottom piece",
      "accessories": "Jewelry, glasses, etc"
    },
    "pose_and_action": {
      "perspective": "Camera angle (Selfie, POV, etc)",
      "action": "Description of what they are doing with their hands and body",
      "hands_visible": number (0, 1, or 2),
      "reflection": "Detail if mirror selfie, else empty"
    },
    "environment": {
      "location": "Detailed setting",
      "background_elements": "Specific items in background",
      "flooring": "Detail of floor"
    },
    "lighting_and_atmosphere": {
      "lighting_type": "Natural window light, golden hour, or iPhone flash (DO NOT use studio or cinematic lighting)",
      "quality": "Tone and intensity details",
      "mood": "Specific emotional atmosphere"
    }
  }
}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { vibe, mode = "photodump", avatar, productImage } = body;

    if (!vibe?.trim()) {
      return NextResponse.json({ error: mode === "ad" ? "Please describe the product" : "Please describe the vibe" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API Key missing" }, { status: 500 });
    const ai = new GoogleGenAI({ apiKey });

    // Phase 0: Analyze in parallel
    const [personDescription, productDescription] = await Promise.all([
      avatar ? analyzeAvatar(ai, avatar) : null,
      mode === "ad" && productImage ? analyzeProduct(ai, productImage) : null,
    ]);

    // Phase 1: Consolidated JSON Planning
    const prompt = buildPlannerPrompt(vibe.trim(), mode, personDescription, productDescription);
    const res = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    let rawText = res.text?.trim() || "{}";
    
    // Log the raw output before parsing to help debug formatting issues
    console.log("=== RAW AI OUTPUT ===");
    console.log(rawText);
    console.log("=====================");

    try {
      // Aggressively clean markdown blocks that Gemini sometimes wraps around JSON
      if (rawText.startsWith("```json")) {
        rawText = rawText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      } else if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(rawText.trim());
      
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        throw new Error("Missing 'scenes' array in generated JSON format");
      }
      
      return NextResponse.json({ ...parsed, vibe: vibe.trim(), mode, personDescription, productDescription });
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError.message);
      return NextResponse.json({ error: "Failed to parse AI output. Try again." }, { status: 500 });
    }
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

