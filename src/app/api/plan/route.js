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
  const isPost = mode === "carousel";      // Post Carousel — single occasion
  const isPhotodump = mode === "photodump"; // Photo Dump — mixed moments
  const hookStrategies = isAd ? getHookStrategies() : null;
  const slideCount = isAd ? 6 : 5;

  const hookMenu = hookStrategies?.categories.map(c => 
    `- ${c.name}: ${c.formulas.join(" | ")}`
  ).join("\n") || "";

  const angleInstruction = isAd 
    ? "STRICT AD RULE: Use ONLY 'Selfie', 'Mirror Selfie', or 'First-person POV'. Every slide must feel self-filmed by the influencer."
    : "MIXED MODES: Use a mix of 'Selfie', 'Mirror Selfie', 'First-person POV', and 'Standard (Tripod/Distance)' for variety.";

  const modeLogic = isPost 
    ? "SINGLE OCCASION: This is a Post Carousel from ONE event (e.g., a dinner, concert, beach day). Every slide MUST have the SAME OUTFIT, SAME ACCESSORIES, SAME VIBE, and SAME TIME of day. Character consistency is paramount. Do NOT feature any product or brand."
    : isAd 
    ? "AD CREATIVE: This carousel tells a Problem→Insight→Transformation story for a product. Outfits and locations change logically across slides."
    : "PHOTO DUMP: This is a casual mixed-moments dump. Every slide should feel like a different day or moment with different outfits, locations, and activities. No product. Pure lifestyle.";

  const captionInstruction = isAd 
    ? "Write the spoken caption for this slide — what the influencer is SAYING to the audience (hook, benefit, insight, or CTA). Plain text only. NO markdown, NO asterisks. NEVER write a description of the visual action or what the influencer is physically doing."
    : "A punchy 1-line caption with emoji that feels like an authentic personal post. Plain text only — NO markdown, NO asterisks. NEVER describe what is happening in the image.";

  return `You are a world-class Social Media Strategist and AI Prompt Engineer. Generate a ${slideCount}-part JSON plan for a carousel.

USER INPUT:
- Mode: ${mode} (Rules: ${modeLogic})
- Subject Description: ${personDescription || "Generic attractive person"}
- Product Description: ${productDescription || "None"}
- Vibe/Instruction: ${vibe}

CAMERA & PHYSICAL REALITY RULES — READ EVERY WORD (CRITICAL — NON-NEGOTIABLE):
- HUMAN HANDS: A human has exactly 2 hands. No more. Not 3. Not 4.
- ${angleInstruction}
- If "Selfie": perspective = "Close-up front-facing camera selfie, one extended arm holding the camera out of frame". The hand holding the camera is PERMANENTLY OCCUPIED and OUT OF FRAME. That gives the avatar EXACTLY 1 free hand. The free hand does ONE simple static thing — e.g., holding a plate, pressing against her cheek, clutching a bag. The free hand CANNOT simultaneously hold something AND raise/point/gesture with it. ONE hand = ONE static action. No compound movements.
- If "First-person POV": perspective = "First-person point-of-view shot looking DOWN at hands, as if through the influencer's own eyes". The influencer IS holding the phone with one hand — that hand holds the camera device and is either out of frame or only barely visible at the edge. This gives EXACTLY 1 genuinely FREE hand to do an action. The second hand is occupied holding the phone and therefore NOT available for any additional interaction. Any props (menus, food, items) are already lying flat on the table — they do NOT require a second hand to hold them. Face NOT visible. The camera IS the influencer's eyes, NOT a shoulder or overhead rig.
- If "Mirror Selfie": BOTH hands visible in reflection. One hand holds the phone UP to take the photo. The OTHER hand may pose or hold ONE item. ABSOLUTE BAN on any screen, display, UI, or digital content appearing anywhere in the reflection — this includes the phone screen, the back of the phone, any reflected screens, and any other devices. The reflection shows only the physical body, clothing, and non-screen props. NEVER describe a second phone or a separate device.
- ABSOLUTE PROHIBITION ON "SECOND PHONE" TRICK: Do NOT describe scenarios where the avatar holds one phone to take a photo AND a second separate phone/device is present in the scene being held, pointed at, or propped up. This requires 3 hands. It is impossible. Never do this.
- ${isAd ? "ABSOLUTE PROHIBITION: Do NOT output 'Standard (Tripod/Distance)' under any circumstance in Ad mode. Every single shot must be a Selfie, Mirror Selfie, or POV." : ""}

SCENE AUTHENTICITY RULES (Real life common sense):
- BODY POSITION MUST MATCH EMOTIONAL STATE. If the subject is bloated, nauseous, sick, tired, or in pain — they must be lying down in bed, curled up on a couch, or slumped over. They are NOT standing upright taking a normal selfie. A selfie in this state would be taken lying sideways in bed with the phone held above them, or hunched over on a couch.
- If the subject is energetic, happy, excited, or working out — they can be standing upright or in motion.
- If the subject is relaxed or cozy — they are sitting on a couch, bed, or floor, not standing.
- Think: What would a real person ACTUALLY do in this emotional moment? Where would they physically be?

STRATEGY (For Ads Slide 1):
${hookMenu}

HOOK RULE: For Slide 1, pick EXACTLY ONE formula from the list above. Use it cleanly and adapt it to the product. Do NOT blend, combine, or merge multiple formulas into one caption. Keep the Slide 1 hook under 12 words.

CAROUSEL NARRATIVE STRUCTURE (Ad Mode — STRICTLY FOLLOW THIS):
This is a ${slideCount === 6 ? '6' : '5'}-slide carousel. Each slide has a specific narrative role. DO NOT deviate:

${slideCount === 6 ? `Slide 1 — HOOK: ONE formula, adapted. Max 12 words. Stop the scroll.
Slide 2 — RELATABLE PROBLEM: Describe the audience's mistake or frustration. Make them feel seen.
Slide 3 — MISTAKE / MYTH: Expose the wrong belief they have been acting on.
Slide 4 — KEY INSIGHT: Reveal the hidden truth or the product's mechanism of action.
Slide 5 — ACTIONABLE VALUE: Show the product solving the problem in a real moment.
Slide 6 — RESULT + EARNED CTA: Payoff (transformation/emotion) + a conversational product reveal. The CTA must feel EARNED — the viewer has been shown the full story and now organically discovers the product name.` : `Slide 1 — HOOK: ONE formula, adapted. Max 12 words. Stop the scroll.
Slide 2 — PROBLEM: Describe the audience's frustration. Make it visceral and relatable.
Slide 3 — INSIGHT: Reveal the hidden reason or the product's unique advantage.
Slide 4 — VALUE: Show the product in action. The real moment of use.
Slide 5 — RESULT + EARNED CTA: Payoff + a conversational product reveal. The CTA must feel EARNED.`}

CTA RULES (CRITICAL — applies to the final slide caption):
BAD CTAs (NEVER use these): "Download now!", "Get it here", "Link in bio", "Check it out", "Available on App Store"
GOOD CTAs (use these patterns instead):
- "It's called [App Name] — search it on the App Store"
- "I use [App Name] instead of [famous alternative] because [specific reason]"
- "The app is [App Name] — it's free to try"
- "[App Name] changed how I [outcome] — it's in my bio"
The CTA must feel like a word-of-mouth recommendation from a friend, not an advertisement.

Caption for each slide must match its narrative role — not describe the visual.

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
      // 1. Extract the first complete JSON value (object OR array) using depth tracking.
      //    AI sometimes returns a raw [...] array instead of {"scenes":[...]}
      const objStart = rawText.indexOf('{');
      const arrStart = rawText.indexOf('[');
      
      // Determine whether the top-level value is an object or array
      const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
      const openChar = isArray ? '[' : '{';
      const closeChar = isArray ? ']' : '}';
      const start = rawText.indexOf(openChar);
      
      if (start !== -1) {
        let depth = 0, inString = false, escape = false, end = -1;
        for (let i = start; i < rawText.length; i++) {
          const c = rawText[i];
          if (escape) { escape = false; continue; }
          if (c === '\\' && inString) { escape = true; continue; }
          if (c === '"') { inString = !inString; continue; }
          if (!inString) {
            if (c === openChar) depth++;
            else if (c === closeChar) { depth--; if (depth === 0) { end = i; break; } }
          }
        }
        if (end !== -1) rawText = rawText.substring(start, end + 1);
      }

      // 2. Strip trailing commas before ] or } which break strict JSON.parse
      rawText = rawText.replace(/,\s*([}\]])/g, '$1');

      let parsed = JSON.parse(rawText);

      // 3. If AI returned a bare array, wrap it in the expected {scenes:[...]} shape
      if (Array.isArray(parsed)) {
        parsed = { scenes: parsed };
      }
      
      if (!parsed.scenes || !Array.isArray(parsed.scenes)) {
        // Try common alternative keys the AI might use
        const altKey = ['slides', 'carousel', 'frames', 'plan'].find(k => Array.isArray(parsed[k]));
        if (altKey) {
          parsed.scenes = parsed[altKey];
        } else {
          console.error("Parsed keys:", Object.keys(parsed));
          throw new Error("Missing 'scenes' array in generated JSON format");
        }
      }

      // 3. Strip any markdown formatting that leaked into captions
      parsed.scenes = parsed.scenes.map(scene => ({
        ...scene,
        caption: (scene.caption || "")
          .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
          .replace(/\*(.*?)\*/g, '$1')       // *italic* → italic
          .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → '
          .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → "
          .trim()
      }));
      
      return NextResponse.json({ ...parsed, vibe: vibe.trim(), mode, personDescription, productDescription });
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError.message);
      // Give the user a more helpful string if they need to debug it
      const preview = rawText.substring(Math.max(0, rawText.length - 100));
      console.error("End of string preview:", preview);
      return NextResponse.json({ error: "Failed to parse AI output. Try again." }, { status: 500 });
    }
  } catch (err) {
    console.error("Plan error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

