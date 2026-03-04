import { NextResponse } from "next/server";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "fs";
import { join } from "path";

const PROMPTS_DIR = join(process.cwd(), "prompts", "saved");

// GET — List all saved prompts
export async function GET() {
  const prompts = [];

  if (!existsSync(PROMPTS_DIR)) {
    return NextResponse.json({ prompts: [] });
  }

  const categories = readdirSync(PROMPTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const catDir = join(PROMPTS_DIR, category);
    const files = readdirSync(catDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
      try {
        const content = JSON.parse(
          readFileSync(join(catDir, file), "utf-8")
        );
        prompts.push({
          id: `${category}/${file.replace(".json", "")}`,
          category,
          filename: file,
          ...content,
        });
      } catch {
        // skip malformed files
      }
    }
  }

  prompts.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return NextResponse.json({ prompts });
}

// POST — Save a new prompt
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, category, prompt } = body;

    if (!name || !prompt) {
      return NextResponse.json(
        { error: "Name and prompt are required" },
        { status: 400 }
      );
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

    const cat = category || "uncategorized";
    const catDir = join(PROMPTS_DIR, cat);
    mkdirSync(catDir, { recursive: true });

    const timestamp = Date.now();
    const data = { name, category: cat, prompt, savedAt: timestamp };
    const filename = `${slug}-${timestamp}.json`;

    writeFileSync(join(catDir, filename), JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      id: `${cat}/${slug}-${timestamp}`,
      filename,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to save prompt" },
      { status: 500 }
    );
  }
}
