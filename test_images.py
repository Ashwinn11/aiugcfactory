#!/usr/bin/env python3
"""
UGC Factory - Keyframe Image Generation

Reads avatar_config.json (minimal user config) and uses an LLM with the
image_gen system prompt to generate rich, realistic prompts. Those prompts
are then passed to Nano Banana 2 for image generation.

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
SYSTEM_PROMPT_PATH = Path("prompts/image_gen.txt")
IMAGE_MODEL = "gemini-3.1-flash-image-preview"
PROMPT_MODEL = "gemini-3.1-pro-preview"


# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------


def load_system_prompt() -> str:
    """Load the image generation system prompt."""
    with open(SYSTEM_PROMPT_PATH) as f:
        return f.read()


# ---------------------------------------------------------------------------
# Prompt Builder (LLM-powered)
# ---------------------------------------------------------------------------


def load_config() -> dict:
    """Load the avatar configuration JSON."""
    with open(CONFIG_PATH) as f:
        return json.load(f)


def build_prompt_via_llm(client: genai.Client, config: dict, action: str, frame: str) -> str:
    """Use the LLM + system prompt to generate a rich image prompt from minimal config.

    Sends the character description, apparel, scene concept, and frame-specific
    expression/pose to the LLM. The system prompt handles all photography
    realism details (iPhone optics, imperfections, lighting, etc.).

    Returns the full_prompt_string from the LLM's JSON response.
    """
    system_prompt = load_system_prompt()
    action_cfg = config["actions"][action]

    user_message = (
        f"Character: {config['character']}\n"
        f"Scene: {action_cfg['scene']}\n"
        f"Frame: {action_cfg[frame]}"
    )

    print(f"    LLM input: {user_message[:120]}...")

    response = client.models.generate_content(
        model=PROMPT_MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        ),
    )

    raw_text = response.text.strip()
    # Strip markdown code fences if present
    if raw_text.startswith("```"):
        raw_text = raw_text.split("\n", 1)[1]  # remove first line
        raw_text = raw_text.rsplit("```", 1)[0]  # remove last fence
        raw_text = raw_text.strip()

    result = json.loads(raw_text)
    full_prompt = result["full_prompt_string"]
    negative = result.get("negative_prompt", "")

    print(f"    LLM prompt: {full_prompt[:120]}...")
    if negative:
        print(f"    Negative: {negative[:80]}...")

    return full_prompt


# ---------------------------------------------------------------------------
# Image Generation
# ---------------------------------------------------------------------------


def generate_image(
    client: genai.Client, prompt: str, save_path: Path, reference_image: Path | None = None
) -> None:
    """Generate a single image with the image model and save it.

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

    # Step 1: Generate start frame prompt via LLM, then generate image
    print("\n  [start] Building prompt via LLM...")
    start_prompt = build_prompt_via_llm(client, config, action, "start")
    start_path = action_dir / f"{action}_frame_start.png"
    generate_image(client, start_prompt, start_path)

    # Step 2: Generate peak frame using start frame as reference
    print("\n  [peak] Building prompt via LLM...")
    peak_prompt = build_prompt_via_llm(client, config, action, "peak")
    peak_prompt = (
        "This is the same person from the reference image. "
        "Keep her face, hair, clothing, and environment identical. "
        "Only change her expression and pose: "
        + peak_prompt
    )
    peak_path = action_dir / f"{action}_frame_peak.png"
    generate_image(client, peak_prompt, peak_path, reference_image=start_path)

    print(f"\n  Done! Check {action_dir}/")


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
