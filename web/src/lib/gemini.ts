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
<principle name="CRITICAL: Room Function Preservation">
The output must keep the original room type and purpose. A bedroom must remain a bedroom, a kitchen must remain a kitchen, and a bathroom must remain a bathroom. Do not convert spaces between room categories.
</principle>
</cognitive_framework>

<instructions>
1. Analyze the user's style name and any additional description.
2. Expand it into a detailed interior design brief with specific visual elements.
3. Return ONLY the final prompt string — no JSON, no explanation, just the prompt.
4. The prompt should be 2-3 sentences, dense with specific visual details.
5. ALWAYS include the camera preservation instruction as a separate emphatic sentence.
6. ALWAYS include a room-function preservation instruction: keep the same room type and adapt style elements to that existing room.
</instructions>

<examples>
User: "Japandi"
Output: Redesign this room in Japandi style. Replace furnishings with simple, low-profile pieces in light white oak and pale ash wood appropriate to the existing room function, add wabi-sabi ceramics in warm earth tones, swap textiles for undyed linen and nubby cotton in cream and warm gray, introduce a paper lantern or rice-paper pendant light, add a single ikebana arrangement, and use a muted palette of warm white walls with soft clay and sage accents. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length as the original photo — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. CRITICAL: Keep the same room type and purpose as the input image; do not convert the space to a different room category. Photorealistic architectural photography, natural daylight.

User: "Industrial"
Output: Redesign this room in Industrial style. Replace furnishings with raw steel-frame and reclaimed-wood pieces appropriate to the existing room function, use concrete, brick, and weathered metal material cues where stylistically suitable, swap lighting for Edison-bulb fixtures on black iron hardware, add utilitarian accents and matte black detailing, and use a palette of charcoal, rust, aged bronze, and weathered wood tones. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length as the original photo — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. CRITICAL: Keep the same room type and purpose as the input image; do not convert the space to a different room category. Photorealistic architectural photography, dramatic natural light with warm tungsten accents.
</examples>

<task>
The user will provide a style name (and optionally extra details). Return ONLY the rich prompt string.
</task>`;

const DIRECT_IMAGE_EDIT_SYSTEM_INSTRUCTION = `You are an expert interior designer and architectural photographer editing the provided room image.
Apply the requested style with high specificity in materials, furniture forms, textiles, lighting, and decor.
CRITICAL: Preserve exact camera position, viewing angle, perspective, focal length, and room geometry.
CRITICAL: Preserve room function and category (bedroom stays bedroom, kitchen stays kitchen, bathroom stays bathroom).
Only change design elements (furniture, decor, color palette, materials, textiles, fixtures); do not alter architecture.`;

// ---------------------------------------------------------------------------
// Generate refinement suggestions based on style + uploaded image context
// ---------------------------------------------------------------------------

export async function generateSuggestions(
  imageBase64: string,
  mimeType: string,
  style: string
): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: PROMPT_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          {
            text: `This is the current room image. The chosen style is "${style}". Suggest exactly 4 short refinement prompts (5-8 words each) tailored to what is actually visible in this room. Keep the same room type and function; do not suggest objects that would convert room category (for example, no sofa/coffee table suggestions for a bedroom unless already present). Focus on realistic decor, material, color, lighting, and furniture tweaks for this specific room. Return ONLY a JSON array of 4 strings, nothing else.`,
          },
        ],
      },
    ],
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
  const styleDirective = customPrompt
    ? `Restyle this room in "${style}" style with these user preferences: ${customPrompt}.`
    : `Restyle this room in "${style}" style.`;

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          {
            text: `${styleDirective} Adapt furniture and decor choices to the existing room function visible in the image. NON-NEGOTIABLE: Preserve the original room type and function from the source image (for example, a bedroom must remain a bedroom). Do not convert the space into a different room category. NON-NEGOTIABLE: Maintain the exact same camera position, viewing angle, perspective, focal length, and room geometry. Keep all walls, windows, doors, and dimensions identical.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: DIRECT_IMAGE_EDIT_SYSTEM_INSTRUCTION,
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
): Promise<{ image: string; text?: string }> {
  // IMPORTANT:
  // Model thought parts/signatures are not safe to round-trip through JSON
  // via the browser. Filter history to user turns only to avoid INVALID_ARGUMENT
  // errors about missing thought_signature fields.
  const safeHistory = (history || [])
    .filter((turn) => turn?.role === "user" && Array.isArray(turn?.parts))
    .map((turn) => ({
      role: "user",
      parts: (turn.parts as RawPart[]).filter((part) => part?.text || part?.inlineData),
    }))
    .filter((turn) => turn.parts.length > 0)
    .slice(-6);

  // Build full contents: safe prior user turns + new user message
  const contents = [
    ...safeHistory,
    {
      role: "user",
      parts: [
        { inlineData: { mimeType: currentImageMimeType, data: currentImageBase64 } },
        {
          text: `Edit this room image: ${message}. CRITICAL: Maintain the EXACT same camera position, viewing angle, perspective, and focal length — do not move, rotate, or zoom the virtual camera. Keep all walls, windows, doors, and room dimensions identical. CRITICAL: Keep the original room type and purpose (for example, bedroom stays bedroom) and do not convert it into another room category. Make only the requested design changes. Photorealistic result.`,
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

  const { image, text } = extractImageFromResponse(response);
  return { image, text };
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
