import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const PROMPT_MODEL = "gemini-3-flash-preview";

// ---------------------------------------------------------------------------
// Interior design system prompt (mirrors CLI's image_gen.txt pattern)
// ---------------------------------------------------------------------------

const INTERIOR_DESIGN_SYSTEM_PROMPT = `<role>
You are an expert interior designer and architectural photographer specializing in translating design style names into rich, technically precise image-editing prompts for AI image generation.
</role>

<cognitive_framework>
<principle name="Design Specificity">
When given a style name like "Japandi" or "Bohemian", you must expand it into concrete, visual details: specific furniture pieces, materials, textures, color palettes, lighting fixtures, textiles, and decorative objects that define that style.
</principle>
<principle name="Architectural Photography">
All outputs must describe the result as shot by a professional architectural/interiors photographer:
- Natural light from windows, supplemented by styled interior lighting
- Wide-angle lens (16-24mm equivalent), straight verticals, no distortion
- Magazine-quality composition: Architectural Digest, Dwell, Elle Decor
- Real materials with visible texture: wood grain, fabric weave, stone veining
</principle>
<principle name="CRITICAL: Camera Angle and Perspective Preservation">
The prompt MUST strongly instruct the model to maintain the EXACT same camera position, viewing angle, lens focal length, and perspective as the input photograph. The virtual camera must not move, rotate, tilt, or zoom. The vanishing points, horizon line, and spatial geometry must remain identical. This is the single most important constraint — the output must look like it was shot from the exact same tripod position.
</principle>
<principle name="Editing Constraints">
The prompt must instruct the model to PRESERVE: room architecture (walls, windows, doors, ceiling height, room dimensions), camera position and angle, perspective and focal length, spatial proportions and depth.
REPLACE ONLY: furniture, decor, colors, materials, textiles, lighting fixtures, and decorative objects.
</principle>
</cognitive_framework>

<instructions>
1. Analyze the user's style name and any additional description.
2. Expand it into a detailed interior design brief with specific visual elements.
3. Return ONLY the final prompt string — no JSON, no explanation, just the prompt.
4. The prompt should be 2-3 sentences, dense with specific visual details.
5. ALWAYS include the camera preservation instruction as a separate emphatic sentence.
</instructions>

<examples>
User: "Japandi"
Output: Redesign this room in Japandi style. Replace furniture with low-profile pieces in light white oak and pale ash wood, add wabi-sabi ceramics in warm earth tones, swap textiles for undyed linen and nubby cotton in cream and warm gray, introduce a paper lantern or rice-paper pendant light, add a single ikebana arrangement, use a muted palette of warm white walls with soft clay and sage accents. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length as the original photo — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. Photorealistic architectural photography, natural daylight.

User: "Industrial"
Output: Redesign this room in Industrial style. Replace furniture with raw steel-frame pieces, a distressed leather sofa, and reclaimed wood shelving, expose or simulate brick walls and concrete flooring, swap lighting for Edison-bulb pendants on black iron pipe fixtures, add metal mesh accents and factory-style black-frame windows, use a palette of charcoal, rust, aged bronze, and weathered wood tones. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length as the original photo — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. Photorealistic architectural photography, dramatic natural light with warm tungsten accents.
</examples>

<task>
The user will provide a style name (and optionally extra details). Return ONLY the rich prompt string.
</task>`;

// ---------------------------------------------------------------------------
// Prompt enrichment (two-step like CLI)
// ---------------------------------------------------------------------------

async function enrichStylePrompt(style: string, customPrompt?: string): Promise<string> {
  const userInput = customPrompt ? `${style} — ${customPrompt}` : style;

  const response = await ai.models.generateContent({
    model: PROMPT_MODEL,
    contents: userInput,
    config: {
      systemInstruction: INTERIOR_DESIGN_SYSTEM_PROMPT,
      temperature: 0.7,
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error("Failed to generate enriched prompt");
  }
  return text;
}

// ---------------------------------------------------------------------------
// Generate refinement suggestions based on style
// ---------------------------------------------------------------------------

export async function generateSuggestions(style: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: PROMPT_MODEL,
    contents: `Given a room that was just restyled in "${style}" style, suggest exactly 4 short refinement prompts (5-8 words each) that a user might want to try. These should be specific to the ${style} aesthetic — things like changing specific furniture, adding style-appropriate decor, adjusting colors or materials. Return ONLY a JSON array of 4 strings, nothing else.`,
    config: {
      temperature: 0.8,
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return [];

  try {
    // Strip markdown code fences if present
    let cleaned = text;
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.split("\n").slice(1).join("\n");
      cleaned = cleaned.replace(/```\s*$/, "").trim();
    }
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 4).map(String);
    }
  } catch {
    // Fallback if JSON parsing fails
  }
  return [];
}

// ---------------------------------------------------------------------------
// Restyle (initial generation)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawPart = any;

export async function generateRestyledImage(
  imageBase64: string,
  mimeType: string,
  style: string,
  customPrompt?: string
): Promise<{ image: string; text?: string; modelParts: RawPart[] }> {
  // Step 1: Enrich the style into a detailed prompt
  const prompt = await enrichStylePrompt(style, customPrompt);
  console.log("Enriched prompt:", prompt);

  // Step 2: Generate the image
  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  return extractImageFromResponse(response);
}

// ---------------------------------------------------------------------------
// Refine (multi-turn conversation)
// ---------------------------------------------------------------------------

// Raw conversation turns — these preserve thought_signature fields
// from the model's response, which gemini-3.1-flash requires for multi-turn.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConversationTurn = any;

export async function generateRefinedImage(
  history: ConversationTurn[],
  message: string,
  currentImageBase64: string,
  currentImageMimeType: string
): Promise<{ image: string; text?: string; modelParts: RawPart[] }> {
  // Build full multi-turn contents: previous history + new user message
  const contents = [
    ...history,
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: currentImageMimeType, data: currentImageBase64 } },
        {
          text: `Edit this room image: ${message}. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. Make only the requested changes. Photorealistic result.`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  return extractImageFromResponse(response);
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractImageFromResponse(response: any): {
  image: string;
  text?: string;
  modelParts: RawPart[];
} {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  let image = "";
  let text = "";

  for (const part of parts) {
    if (part.inlineData) {
      image = part.inlineData.data;
    }
    if (part.text && !part.thought) {
      text += part.text;
    }
  }

  if (!image) {
    throw new Error("No image returned from model");
  }

  // Return raw parts with thought_signatures preserved for multi-turn
  return { image, text: text || undefined, modelParts: parts };
}
