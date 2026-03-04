import { NextResponse } from "next/server";
import { existsSync, unlinkSync, readFileSync } from "fs";
import { join } from "path";

const PROMPTS_DIR = join(process.cwd(), "prompts", "saved");

// DELETE — Remove a saved prompt
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    // id is "category/filename" — reconstruct path
    const filePath = join(PROMPTS_DIR, `${id}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "Prompt not found" },
        { status: 404 }
      );
    }

    unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Failed to delete" },
      { status: 500 }
    );
  }
}
