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
    const photoPrompt = getPhotoPrompt();

    const generatedImages = await Promise.all(
      scenes.map(async (scene, index) => {
        // Build contents array: [images...] + [text prompt]
        const contents = [];

        // Send avatar when face OR hands are visible (for skin tone consistency)
        const handsVisible = scene.scene_prompt?.hands_visible ?? 0;
        if (avatar && (scene.requires_avatar || handsVisible > 0)) {
          contents.push({ inlineData: { data: avatar.base64, mimeType: avatar.mimeType || "image/png" } });
        }

        if (mode === "ad" && productImage && scene.requires_product === true) {
          contents.push({ inlineData: { data: productImage.base64, mimeType: productImage.mimeType || "image/png" } });
        }

        // Build JSON-structured prompt for the image model
        const sp = scene.scene_prompt || {};
        const isPostMode = mode === "post";
        const outfit = isPostMode ? (styling && styling.outfit) : sp.outfit;
        const hair = (styling && styling.hair) || "";

        const jsonPrompt = {};

        // 1. Core Composition Rules
        jsonPrompt.composition = {
          people_count: scene.requires_avatar ? 1 : 0,
          instruction: scene.requires_avatar ? "CRITICAL: There must be EXACTLY ONE person in this image. Do NOT add any other people, bystanders, or friends." : "Scene only. No faces visible.",
          negative_constraints: "aggressively avoid: professional camera, DSLR, bokeh balls, anamorphic, cinema lighting, studio lighting, extra limbs, mutated anatomy, duplicate hands, two left hands, two right hands, wrong number of fingers, airbrushed, plastic skin, 3d render, cartoon, camera UI, shutter button, phone interface, screenshot, menu buttons, battery icons"
        };

        if (scene.requires_avatar) {
          // Face visible: full subject + apparel
          jsonPrompt.subject = {
            identity: "this person (use the reference photo provided)",
            facial_expression: sp.expression || "natural",
            skin_texture: "Natural, realistic skin with visible pores and texture, matte finish, no airbrushing"
          };
          jsonPrompt.apparel = {
            outfit: outfit || "casual, contextually appropriate clothing",
            hair: hair || "natural"
          };
        } else if (handsVisible > 0) {
          // Hands/body only (no face): match skin tone from reference
          jsonPrompt.subject = {
            identity: "this person's hands and arms only (use the reference photo for skin tone). Do NOT show the face.",
          };
        }

        // 2. Camera & Pose (synthesized natural language instead of raw integers)
        let handInstruction = "";
        if (handsVisible === 0) {
          handInstruction = "No hands visible.";
        } else if (handsVisible === 1) {
          handInstruction = "ONLY one hand/arm is visible in the frame (the other is holding the camera or out of frame).";
        } else {
          handInstruction = "Both arms/hands are visible in the frame.";
        }
        
        const actionText = sp.hand_action ? ` Action: ${sp.hand_action}` : "";

        jsonPrompt.camera_and_pose = {
          description: `${sp.angle || "natural medium shot"}. ${handInstruction}${actionText}`
        };

        jsonPrompt.environment = {
          location: sp.environment || "contextually appropriate setting",
          key_item: sp.key_item || ""
        };

        // Clean up empty fields
        if (!jsonPrompt.environment.key_item) delete jsonPrompt.environment.key_item;

        const finalPrompt = `Generate a photo matching this description:\n${JSON.stringify(jsonPrompt, null, 2)}\n\n${photoPrompt}`;
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
