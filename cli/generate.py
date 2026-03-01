#!/usr/bin/env python3
"""
UGC Factory - Avatar Content Generator

Generate bulk selfie-style content for AI avatar accounts.
Same person, different vibes/locations/outfits.

Usage:
    python generate.py "coffee shop, morning light, cozy hoodie"
    python generate.py "gym mirror selfie" "crying in car" "night out, flash photo"
    python generate.py --batch vibes.txt
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image

load_dotenv()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AVATAR_PATH = Path("avatar.png")
OUTPUT_DIR = Path("outputs")
SYSTEM_PROMPT_PATH = Path("prompts/image_gen.txt")
IMAGE_MODEL = "gemini-3.1-flash-image-preview"
PROMPT_MODEL = "gemini-3-flash-preview"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def load_system_prompt() -> str:
    with open(SYSTEM_PROMPT_PATH) as f:
        return f.read()


def sanitize_filename(vibe: str) -> str:
    """Turn a vibe string into a safe filename."""
    name = vibe.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    name = name.strip("_")
    return name[:80] or "output"


def build_prompt_via_llm(client: genai.Client, system_prompt: str, vibe: str) -> str:
    """Send the vibe to Gemini Pro with the system prompt → get rich photography prompt."""
    print(f"  Building prompt for: {vibe}")

    response = client.models.generate_content(
        model=PROMPT_MODEL,
        contents=vibe,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        ),
    )

    raw_text = response.text.strip()
    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]
        raw_text = raw_text.rsplit("```", 1)[0]
        raw_text = raw_text.strip()

    result = json.loads(raw_text)
    full_prompt = result["full_prompt_string"]
    print(f"  Prompt: {full_prompt[:120]}...")
    return full_prompt


def generate_image(client: genai.Client, avatar: Image.Image, prompt: str, save_path: Path) -> None:
    """Generate an image using the avatar as reference and save it."""
    print(f"  Generating image: {save_path.name}")

    full_prompt = (
        "This is the same person from the reference image. "
        "Keep her face identical. " + prompt
    )

    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=[avatar, full_prompt],
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(
                aspect_ratio="9:16",
                image_size="2K",
            ),
        ),
    )

    for part in response.parts:
        if part.inline_data is not None:
            image = part.as_image()
            image.save(str(save_path))
            print(f"  Saved: {save_path}")
            return

    raise RuntimeError(f"No image returned for: {prompt[:80]}...")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def process_vibe(client: genai.Client, avatar: Image.Image, system_prompt: str, vibe: str) -> None:
    """Process a single vibe: LLM prompt → image generation → save."""
    vibe = vibe.strip()
    if not vibe:
        return

    print(f"\n{'='*60}")
    print(f"Vibe: {vibe}")
    print(f"{'='*60}")

    prompt = build_prompt_via_llm(client, system_prompt, vibe)
    filename = sanitize_filename(vibe) + ".png"
    save_path = OUTPUT_DIR / filename
    generate_image(client, avatar, prompt, save_path)


def main():
    parser = argparse.ArgumentParser(description="Generate avatar content from vibes")
    parser.add_argument("vibes", nargs="*", help="Vibe descriptions (e.g. 'coffee shop, morning light')")
    parser.add_argument("--batch", type=str, help="Path to a file with one vibe per line")
    args = parser.parse_args()

    # Collect vibes
    vibes = list(args.vibes)
    if args.batch:
        batch_path = Path(args.batch)
        if not batch_path.exists():
            print(f"Error: Batch file not found: {batch_path}")
            sys.exit(1)
        vibes.extend(line.strip() for line in batch_path.read_text().splitlines() if line.strip())

    if not vibes:
        parser.print_help()
        sys.exit(1)

    # Validate environment
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY not set. Add it to .env or export it.")
        sys.exit(1)

    if not AVATAR_PATH.exists():
        print(f"Error: Avatar image not found at {AVATAR_PATH}")
        sys.exit(1)

    # Setup
    client = genai.Client(api_key=api_key)
    avatar = Image.open(AVATAR_PATH)
    system_prompt = load_system_prompt()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {len(vibes)} image(s)")
    print(f"Avatar: {AVATAR_PATH}")
    print(f"Output: {OUTPUT_DIR.resolve()}")

    for vibe in vibes:
        process_vibe(client, avatar, system_prompt, vibe)

    print(f"\n{'='*60}")
    print(f"Done! {len(vibes)} image(s) → {OUTPUT_DIR}/")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
