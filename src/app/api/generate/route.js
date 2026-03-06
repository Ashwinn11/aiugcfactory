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
    const { scenes, mode = "photodump", avatar, productImage, aspectRatio = "9:16", styling } = body;

    if (!Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "No scenes provided." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const globalPhotoRules = getPhotoPrompt();

    const generatedImages = await Promise.all(
      scenes.map(async (scene, index) => {
        const contents = [];

        // Attach visual references if required
        if (avatar && scene.requires_avatar) {
          contents.push({ inlineData: { data: avatar.base64, mimeType: avatar.mimeType || "image/png" } });
        }
        if (productImage && scene.requires_product) {
          contents.push({ inlineData: { data: productImage.base64, mimeType: productImage.mimeType || "image/png" } });
        }

        // Use the pre-calculated high-fidelity JSON prompt from the plan
        const jsonPrompt = scene.json_prompt || {};
        
        // Inject identity reference into the prompt if avatar is provided
        if (avatar && scene.requires_avatar) {
          if (jsonPrompt.subject) {
            jsonPrompt.subject.identity = "EXACTLY this person (use the reference photo provided). Match face, features, and skin tone perfectly.";
          }
        }

        const finalPrompt = `GENERATE IMAGE FROM JSON SPECIFICATION:\n${JSON.stringify(jsonPrompt, null, 2)}\n\nGLOBAL STYLE RULES:\n${globalPhotoRules}`;
        contents.push(finalPrompt);

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
            console.warn(`Safety filter hit for Slide ${index + 1}, retrying...`);
          }

          if (!candidate?.content?.parts) return null;
          const imagePart = candidate.content.parts.find((p) => p.inlineData);
          if (!imagePart) return null;

          return {
            image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
            caption: scene.caption || "",
            timestamp: Date.now() + index,
          };
        } catch (err) {
          console.error(`Slide ${index + 1} generation error:`, err.message);
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
