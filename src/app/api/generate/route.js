import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const PROMPT_MODEL = "gemini-3.1-pro-preview";
const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

function getSystemPrompt() {
  try {
    return readFileSync(
      join(process.cwd(), "prompts", "image_gen.txt"),
      "utf-8"
    );
  } catch {
    return "You are a photography prompt engineer. Output JSON with full_prompt_string, negative_prompt, meta_data, and prompt_components fields.";
  }
}

// Build the image prompt string from a structured JSON prompt
function buildImagePrompt(promptJson) {
  const imagePrompt =
    promptJson.full_prompt_string ||
    promptJson.prompt ||
    JSON.stringify(promptJson.prompt_components);

  const negativePrompt = promptJson.negative_prompt || "";

  return negativePrompt
    ? `${imagePrompt}\n\nAvoid: ${negativePrompt}`
    : imagePrompt;
}

// Generate a single image, optionally with avatar reference for character consistency
async function generateSingleImage(ai, imagePrompt, aspectRatio, avatar) {
  let contents;

  if (avatar) {
    // Character consistency: pass avatar as reference, then the scene prompt
    contents = [
      {
        inlineData: {
          data: avatar.base64,
          mimeType: avatar.mimeType || "image/png",
        },
      },
      `This is a reference photo of the person. Generate a NEW photo of this SAME person (keep face, hair color, skin tone, and body type identical). The new photo should show:\n\n${imagePrompt}`,
    ];
  } else {
    contents = imagePrompt;
  }

  const imageResponse = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  });

  if (imageResponse.candidates?.[0]?.content?.parts) {
    for (const part of imageResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        const mimeType = part.inlineData.mimeType || "image/png";
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      // Simple mode: just a brief
      brief,
      // Carousel mode: pre-planned scenes
      scenes,
      // Avatar for character consistency
      avatar,
      // Basic settings
      aspectRatio = "9:16",
    } = body;

    if (!brief && (!scenes || scenes.length === 0)) {
      return NextResponse.json(
        { error: "Please provide a brief or scenes" },
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

    if (scenes && scenes.length > 0) {
      // ──── CAROUSEL MODE ────
      // Each scene gets its own image prompt via the LLM, then its own image
      const systemPrompt = getSystemPrompt();

      // Generate image prompts for each scene in parallel
      const promptPromises = scenes.map(async (scene) => {
        const sceneDescription =
          typeof scene === "string" ? scene : scene.scene || scene.description;

        const enhanceResponse = await ai.models.generateContent({
          model: PROMPT_MODEL,
          contents: sceneDescription,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        });

        const rawText = enhanceResponse.text.trim();
        try {
          return JSON.parse(rawText);
        } catch {
          const cleaned = rawText
            .replace(/^```(?:json)?\n?/i, "")
            .replace(/\n?```$/i, "")
            .trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        }
      });

      const promptResults = await Promise.allSettled(promptPromises);
      const prompts = promptResults
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter(Boolean);

      if (prompts.length === 0) {
        return NextResponse.json(
          { error: "Failed to generate scene prompts" },
          { status: 500 }
        );
      }

      // Generate images for each scene prompt in parallel
      const imagePromises = prompts.map((promptJson, i) => {
        const imagePrompt = buildImagePrompt(promptJson);
        return generateSingleImage(ai, imagePrompt, aspectRatio, avatar).then(
          (image) => ({
            image,
            prompt: promptJson,
            scene: scenes[i],
            timestamp: Date.now() + i,
          })
        );
      });

      const imageResults = await Promise.allSettled(imagePromises);
      const images = imageResults
        .filter((r) => r.status === "fulfilled" && r.value.image)
        .map((r) => r.value);

      if (images.length === 0) {
        return NextResponse.json(
          { error: "No images were generated. Try a different vibe." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        images,
        mode: "carousel",
      });
    } else {
      // ──── SINGLE MODE ────
      const systemPrompt = getSystemPrompt();

      const enhanceResponse = await ai.models.generateContent({
        model: PROMPT_MODEL,
        contents: brief,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      });

      let promptJson;
      const rawText = enhanceResponse.text.trim();
      try {
        promptJson = JSON.parse(rawText);
      } catch {
        const cleaned = rawText
          .replace(/^```(?:json)?\n?/i, "")
          .replace(/\n?```$/i, "")
          .trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
          return NextResponse.json(
            { error: "Failed to generate prompt" },
            { status: 500 }
          );
        promptJson = JSON.parse(jsonMatch[0]);
      }

      const imagePrompt = buildImagePrompt(promptJson);
      const image = await generateSingleImage(
        ai,
        imagePrompt,
        aspectRatio,
        avatar
      );

      if (!image) {
        return NextResponse.json(
          { error: "No image generated. Try a different prompt." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        images: [
          {
            image,
            prompt: promptJson,
            timestamp: Date.now(),
          },
        ],
        mode: "single",
      });
    }
  } catch (err) {
    console.error("Generation error:", err);
    return NextResponse.json(
      { error: err.message || "Generation failed" },
      { status: 500 }
    );
  }
}
