import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const PROMPT_MODEL = "gemini-3.1-pro-preview";

function getBaseSystemPrompt() {
  try {
    return readFileSync(
      join(process.cwd(), "prompts", "image_gen.txt"),
      "utf-8"
    );
  } catch {
    return "";
  }
}

const SCENE_PLANNER_PROMPT = `You are an expert Instagram influencer and content strategist who plans photo dumps and carousel posts.

Given a vibe/scenario from the user, plan a set of distinct scenes for a photo dump carousel. Think like a real influencer — every carousel has variety:

SCENE TYPES (mix these):
- "selfie" — front-facing, plandid pose, showing face + location
- "accessory" — close-up of food, drink, handbag, jewelry, shoes (no face needed)
- "outfit" — back-camera style outfit check, full body or detail
- "candid" — mid-action, laughing, walking, caught-in-the-moment
- "portrait" — someone else took this photo of you, editorial quality
- "detail" — close-up texture shot: fabric, plate, latte art, earring
- "environment" — wide shot of the location, aesthetic background

RULES:
1. Always include at least 1 selfie and 1 accessory/detail shot
2. Vary the framing: mix close-ups, medium shots, and wide shots
3. Each scene description must be 1-2 sentences, highly specific and visual
4. Include what the person is wearing/doing in each scene for consistency
5. Think about what makes each image unique — different angle, different subject, different mood
6. For each scene, specify the camera perspective (selfie/front, someone-else-took-it, back-camera, overhead, close-up)

OUTPUT FORMAT: Return a JSON array of scene objects:
[
  {
    "scene": "detailed visual description of this specific photo",
    "type": "selfie|accessory|outfit|candid|portrait|detail|environment",
    "framing": "close-up|medium|full-body|wide|overhead"
  }
]

Output ONLY valid JSON. No markdown, no explanation.`;

export async function POST(request) {
  try {
    const body = await request.json();
    const { vibe, count = 5 } = body;

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
    const sceneCount = Math.min(Math.max(parseInt(count) || 5, 2), 8);

    const basePrompt = getBaseSystemPrompt();
    const fullSystem = `${SCENE_PLANNER_PROMPT}\n\nFor the image generation details, use these photography principles:\n${basePrompt}`;

    const userMessage = `Plan ${sceneCount} photos for an Instagram carousel / photo dump.

Vibe: "${vibe}"

Remember: vary the scene types, angles, and subjects. Make it feel like a real influencer's curated photo dump.`;

    const response = await ai.models.generateContent({
      model: PROMPT_MODEL,
      contents: userMessage,
      config: {
        systemInstruction: fullSystem,
        temperature: 0.8,
        responseMimeType: "application/json",
      },
    });

    let scenes;
    const rawText = response.text.trim();
    try {
      scenes = JSON.parse(rawText);
    } catch {
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/i, "")
        .replace(/\n?```$/i, "")
        .trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "Failed to plan scenes" },
          { status: 500 }
        );
      }
      scenes = JSON.parse(jsonMatch[0]);
    }

    // Ensure it's an array
    if (!Array.isArray(scenes)) {
      scenes = scenes.scenes || scenes.carousel || [scenes];
    }

    return NextResponse.json({ scenes });
  } catch (err) {
    console.error("Scene planning error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to plan carousel" },
      { status: 500 }
    );
  }
}
