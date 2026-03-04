import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";

function getPhotoPrompt() {
  try {
    return readFileSync(join(process.cwd(), "prompts", "image_gen.txt"), "utf-8");
  } catch {
    return "";
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { scenes, mode = "photodump", avatar, productImage, aspectRatio = "9:16" } = body;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const photoPrompt = getPhotoPrompt();

    const generatedImages = await Promise.all(
      scenes.map(async (scene, index) => {
        // Build contents array: [images...] + [text prompt]
        const contents = [];

        if (avatar) {
          contents.push({ inlineData: { data: avatar.base64, mimeType: avatar.mimeType || "image/png" } });
        }

        if (mode === "ad" && productImage && scene.requires_product === true) {
          contents.push({ inlineData: { data: productImage.base64, mimeType: productImage.mimeType || "image/png" } });
        }

        // Add a face avoidance rule for POV shots to prevent unwanted face renders
        const faceAvoidance = scene.requires_avatar === false ? " (DO NOT show this person's face, only their perspective/view)" : "";

        // Enforce camera perspective by prepending it to the situational prompt
        const cameraPrefix = scene.camera ? `${scene.camera.replace(/_/g, " ")}: ` : "";
        contents.push(`${cameraPrefix}${scene.prompt}${faceAvoidance}\n\n${photoPrompt}`);

        try {
          let candidate = null;

          for (let attempt = 1; attempt <= 2; attempt++) {
            const response = await ai.models.generateContent({
              model: IMAGE_MODEL,
              contents,
              config: { imageConfig: { aspectRatio } },
            });

            candidate = response.candidates?.[0];
            if (candidate && candidate.finishReason !== "IMAGE_SAFETY") break;
            console.log(`Image ${index + 1} safety filter, retry ${attempt}`);
          }

          if (!candidate?.content?.parts) return null;

          const imagePart = candidate.content.parts.find((p) => p.inlineData);
          if (!imagePart) return null;

          return {
            image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
            caption: scene.caption || "",
            scene_prompt: scene.prompt || "",
            camera: scene.camera || "",
            timestamp: Date.now() + index,
          };
        } catch (err) {
          console.error(`Image ${index + 1} error:`, err.message);
          return null;
        }
      })
    );

    const images = generatedImages.filter(Boolean);

    if (images.length === 0) {
      return NextResponse.json({ error: "All images failed. Try a different vibe." }, { status: 400 });
    }

    return NextResponse.json({ images, mode });
  } catch (err) {
    console.error("Generate error:", err.message);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
