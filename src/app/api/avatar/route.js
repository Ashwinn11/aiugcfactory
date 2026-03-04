import { NextResponse } from "next/server";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
  unlinkSync,
} from "fs";
import { join } from "path";

const AVATARS_DIR = join(process.cwd(), "public", "avatars");

function ensureDir() {
  mkdirSync(AVATARS_DIR, { recursive: true });
}

// GET — List all saved avatars
export async function GET() {
  ensureDir();

  const avatars = [];

  // Check for legacy avatar.png in project root
  const legacyAvatar = join(process.cwd(), "avatar.png");
  if (existsSync(legacyAvatar)) {
    avatars.push({
      id: "default",
      name: "Default Avatar",
      url: "/avatars/default.png",
      base64: readFileSync(legacyAvatar).toString("base64"),
      mimeType: "image/png",
    });

    // Copy to avatars dir if not already there
    const dest = join(AVATARS_DIR, "default.png");
    if (!existsSync(dest)) {
      writeFileSync(dest, readFileSync(legacyAvatar));
    }
  }

  // List all avatars in the avatars directory
  const files = readdirSync(AVATARS_DIR).filter((f) =>
    /\.(png|jpg|jpeg|webp)$/i.test(f)
  );

  for (const file of files) {
    if (file === "default.png" && avatars.some((a) => a.id === "default"))
      continue;

    const filePath = join(AVATARS_DIR, file);
    const ext = file.split(".").pop().toLowerCase();
    const mimeType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png";

    avatars.push({
      id: file.replace(/\.[^.]+$/, ""),
      name: file.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      url: `/avatars/${file}`,
      base64: readFileSync(filePath).toString("base64"),
      mimeType,
    });
  }

  return NextResponse.json({ avatars });
}

// POST — Upload a new avatar
export async function POST(request) {
  try {
    ensureDir();

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name?.split(".").pop()?.toLowerCase() || "png";
    const mimeType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png";

    const id = `avatar-${Date.now()}`;
    const filename = `${id}.${ext}`;
    const filePath = join(AVATARS_DIR, filename);

    writeFileSync(filePath, buffer);

    return NextResponse.json({
      id,
      name: file.name || filename,
      url: `/avatars/${filename}`,
      base64: buffer.toString("base64"),
      mimeType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// DELETE — Remove an avatar
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id || id === "default") {
      return NextResponse.json(
        { error: "Cannot delete this avatar" },
        { status: 400 }
      );
    }

    const files = readdirSync(AVATARS_DIR).filter((f) => f.startsWith(id));
    for (const file of files) {
      unlinkSync(join(AVATARS_DIR, file));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Delete failed" },
      { status: 500 }
    );
  }
}
