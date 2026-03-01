#!/usr/bin/env python3
"""
UGC Factory - Keyframe Image Generation

Reads avatar_config.json and generates 2 keyframe images per action
(start + peak) using Gemini 3 Pro Image. These keyframes are then
passed to Veo 3.1 as first-frame + last-frame for interpolation.

Usage:
    python test_images.py              # Run all actions
    python test_images.py crying       # Run single action
"""

import json
import os
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

OUTPUT_DIR = Path("test_outputs")
CONFIG_PATH = Path("avatar_config.json")
IMAGE_MODEL = "gemini-3.1-flash-image-preview"


# ---------------------------------------------------------------------------
# Prompt Builder
# ---------------------------------------------------------------------------


def load_config() -> dict:
    """Load the avatar configuration JSON."""
    with open(CONFIG_PATH) as f:
        return json.load(f)


def resolve_section(defaults: dict, action_cfg: dict, section: str) -> dict:
    """Return the action-level section if present, otherwise fall back to defaults."""
    return action_cfg.get(section, defaults.get(section, {}))


def build_prompt(config: dict, action: str, frame: str) -> str:
    """Build a natural-language prompt from the JSON config sections.

    Each action can override any section (environment, lighting, camera, apparel).
    Falls back to defaults for anything not specified at the action level.
    """
    defaults = config["defaults"]
    action_cfg = config["actions"][action]
    frame_cfg = action_cfg["frames"][frame]

    char = defaults["character"]
    apparel = resolve_section(defaults, action_cfg, "apparel")
    env = resolve_section(defaults, action_cfg, "environment")
    lighting = resolve_section(defaults, action_cfg, "lighting")
    camera = resolve_section(defaults, action_cfg, "camera")

    # Use narrative scene description if available, otherwise build from sections
    scene = action_cfg.get("scene", "")

    parts = [
        f"Amateur phone video still. {char['demographics']}, {char['hair']}, {char['skin_texture']}.",
        f"Wearing {apparel['top']}, {apparel['bottoms']}.",
    ]

    if scene:
        parts.append(scene)
    else:
        parts.append(f"{env['setting']}.")

    parts.extend([
        lighting["description"] + ".",
        camera["description"] + ".",
        f"Expression: {frame_cfg['expression']}.",
        f"Pose: {frame_cfg['pose']}.",
    ])

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Image Generation
# ---------------------------------------------------------------------------


def generate_image(
    client: genai.Client, prompt: str, save_path: Path, reference_image: Path | None = None
) -> None:
    """Generate a single image with Gemini 3 Pro Image and save it.

    If reference_image is provided, it's passed alongside the prompt so
    the model keeps the same person/scene consistent.
    """
    print(f"  Generating: {save_path.name} ...")

    if reference_image:
        pil_img = Image.open(reference_image)
        contents = [
            pil_img,
            prompt,
        ]
    else:
        contents = prompt

    response = client.models.generate_content(
        model=IMAGE_MODEL,
        contents=contents,
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
            print(f"    Saved: {save_path}")
            return

    raise RuntimeError(f"No image returned for prompt: {prompt[:80]}...")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def run_action(client: genai.Client, config: dict, action: str) -> None:
    """Generate start + peak keyframe images for one action.

    The start frame is generated first, then passed as a reference image
    when generating the peak frame so the model keeps the same person.
    """
    action_dir = OUTPUT_DIR / action
    action_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Action: {action}")
    print(f"{'='*60}")

    # Step 1: Generate start frame (no reference)
    start_prompt = build_prompt(config, action, "start")
    start_path = action_dir / f"{action}_frame_start.png"
    print(f"\n  [start] Prompt preview: {start_prompt[:100]}...")
    generate_image(client, start_prompt, start_path)

    # Step 2: Generate peak frame using start frame as reference
    peak_prompt = (
        "This is the same person from the reference image. "
        "Keep her face, hair, clothing, and environment identical. "
        "Only change her expression and pose: "
        + build_prompt(config, action, "peak")
    )
    peak_path = action_dir / f"{action}_frame_peak.png"
    print(f"\n  [peak] Prompt preview: {peak_prompt[:100]}...")
    generate_image(client, peak_prompt, peak_path, reference_image=start_path)

    print(f"\n  Done! Check {action_dir}/")
    print(f"  Review: do start & peak look like the same person?")
    print(f"  Review: natural environment, candid feel, correct pose?")


def main():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Error: GOOGLE_API_KEY environment variable is not set.")
        print("Set it with: export GOOGLE_API_KEY='your-key'")
        print("Or create a .env file (see .env.example)")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    config = load_config()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    available_actions = list(config["actions"].keys())

    if len(sys.argv) > 1:
        action = sys.argv[1]
        if action not in config["actions"]:
            print(f"Error: Unknown action '{action}'")
            print(f"Available: {', '.join(available_actions)}")
            sys.exit(1)
        actions_to_run = [action]
    else:
        actions_to_run = available_actions

    print(f"Generating keyframes for: {', '.join(actions_to_run)}")
    print(f"Output: {OUTPUT_DIR.resolve()}")

    for action in actions_to_run:
        run_action(client, config, action)

    print(f"\n{'='*60}")
    print("Keyframe generation complete!")
    print("Once satisfied, run: python test_video.py <action>")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
