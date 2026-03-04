The Claude Code + Nano Banana 2 Playbook for DTC Brands & Creative Agencies
How e-commerce brands and ad agencies are using Claude Code to generate scroll-stopping Facebook ad creative with Nano Banana 2 — at $0.04 per image.

What This System Actually Does
You describe an ad creative concept in plain English. Something like:
"A woman in her late 20s applying a vitamin C serum in a bright bathroom, UGC selfie style, shot on iPhone"
Claude Code takes that description, rewrites it as a structured JSON prompt with every visual detail locked in — lighting, camera angle, lens, depth of field, color grading, negative prompts — and fires it off to Nano Banana 2.
You get back an image that looks like it came from a real UGC creator or a professional photo shoot. Not an AI model.
And because the prompt is saved as a JSON file, you can reuse that exact style across every product in your catalog. Same lighting. Same composition. Same vibe. Different product.
That's the difference between pulling a slot machine lever and running a system.

Why JSON Prompting Changes Everything for Ad Creative
When you throw a plain-text prompt at an image model, the model guesses everything you didn't specify. Lighting? Random. Camera angle? Whatever. Background? Surprise.
That's fine if you're messing around. It's not fine when you need 30 images that all feel like they belong in the same Facebook ad account.
JSON prompting removes the guesswork. You're giving the model explicit instructions for every visual decision:
Prompt — what's in the image (product, model, setting, action)
Negative prompt — what you don't want (blurry text, extra fingers, cartoon look, watermarks)
Style — UGC selfie, studio product, lifestyle flat lay, editorial
Lighting — natural window light, golden hour, studio softbox, ring light
Camera — lens (85mm portrait, 35mm environmental, 50mm general), angle, depth of field
Aspect ratio — 4:5 for Facebook/Instagram feed, 9:16 for Stories/Reels, 1:1 for carousel
Color grading — warm, cool, muted, vibrant
Every setting is saved. Every output is consistent. And you can hand the JSON file to anyone on your team and they'll get the same result.

The Tech Stack
Tool
Role
Claude Code
The brain. Rewrites plain-text briefs into structured JSON prompts using a custom skill. Manages your prompt library, iterates on feedback, and orchestrates the whole workflow.
Nano Banana 2
The image model. Cheaper and faster than Nano Banana Pro. Better text rendering (finally no misspellings on product labels), Google Search grounding, and native JSON support.
Python scripts
Fires the JSON prompt to Nano Banana 2 via API and saves the output.

API provider - gemini-3.1-flash-image-preview via Google AI Studio.


Project Structure
ad-creative-generator/
├── CLAUDE.md                   # Master system prompt
├── .claude/
│   └── skills/
│       └── nanobanana.md       # The JSON image prompting skill
├── scripts/
│   └── generate.py             # API call script
├── prompts/
│   ├── product-hero/           # Studio product shots
│   ├── lifestyle/              # In-context lifestyle scenes
│   ├── ugc-style/              # UGC selfie / user-generated look
│   ├── before-after/           # Transformation images
│   ├── infographics/           # Comparison charts, how-it-works
│   └── social-proof/           # Review screenshots, testimonials
└── images/
    ├── product-hero/
    ├── lifestyle/
    ├── ugc-style/
    ├── before-after/
    ├── infographics/
    └── social-proof/
Every JSON prompt and its matching image are saved in the same subfolder. When you find a winning style, you grab the prompt and reuse it across every SKU.

Step 1: Set Up Your CLAUDE.md
This is the master system prompt Claude reads before every interaction. It defines the rules for your entire ad creative project.
# Ad Creative Generator

## Context
This project generates Facebook and Instagram ad creative for e-commerce brands
using Nano Banana 2 with structured JSON prompting.

## Rules
- Use the nanobanana skill for ALL image generation
- Always save prompts as .json files in the matching prompts/ subfolder
- Always save images in the matching images/ subfolder
- Name files descriptively: {product}-{style}-{variation}.json
  (e.g., vitamin-c-serum-ugc-selfie-01.json)
- Default aspect ratio for Facebook feed ads: 4:5
- Default aspect ratio for Stories/Reels: 9:16
- Default aspect ratio for carousel ads: 1:1

## Image Generation Workflow
1. Receive the creative brief (plain English description)
2. Use the nanobanana skill to write a structured JSON prompt
3. Run the generation script
4. Save the prompt + image
5. Show the result and ask for feedback

## Ad Creative Categories
- product-hero: Clean studio shots for catalog ads and hero images
- lifestyle: Product in real-world context (kitchen, bathroom, gym, desk)
- ugc-style: Looks like a real person took it on their phone
- before-after: Transformation shots for skincare, fitness, cleaning products
- infographics: Comparison charts, ingredient breakdowns, how-it-works diagrams
- social-proof: Styled to look like real reviews or testimonials

## Feedback Loop
When feedback is given on an image:
- Note what worked and what didn't
- Apply preferences to all future generations
- Update the skill with new defaults when asked

## Brand Consistency
When generating multiple images for the same brand or campaign:
- Reuse the same lighting, color grading, and camera settings
- Only change the product, model, or copy
- Keep a consistent visual identity across every ad in the set

Step 2: Build the Nano Banana Skill
Create .claude/skills/nanobanana.md. This is the core of the system — it teaches Claude how to turn plain-English creative briefs into structured JSON prompts optimized for ad creative.
# Nano Banana 2 Ad Creative Skill

## Purpose
Convert plain-text ad creative briefs into structured JSON prompts
for Nano Banana 2 that produce consistent, ad-ready, realistic images
for Facebook, Instagram, and e-commerce use.

## JSON Prompt Schema

Always structure prompts as JSON with these fields:

{
  "prompt": "Detailed visual description of the ad creative",
  "negative_prompt": "Elements to exclude",
  "settings": {
    "resolution": "1024x1024 | 1536x1536 | 2048x2048",
    "aspect_ratio": "1:1 | 4:5 | 16:9 | 9:16",
    "style": "See style guide below",
    "lighting": "See lighting guide below",
    "camera": {
      "lens": "24mm | 35mm | 50mm | 85mm | 105mm | 200mm",
      "angle": "eye-level | low-angle | high-angle | overhead | dutch-angle",
      "framing": "extreme-close-up | close-up | medium | full-body | wide",
      "height": "ground-level | waist-level | eye-level | elevated",
      "depth_of_field": "shallow | moderate | deep",
      "focus": "subject | background | split"
    },
    "color_grading": "warm | cool | neutral | muted | vibrant | cinematic"
  }
}

## Style Guide (Ad Creative Specific)

- **ugc-selfie**: Shot on iPhone look. Ring light or natural window. Slightly imperfect framing. The person is holding or using the product. Casual, authentic, not polished.
- **lifestyle-in-context**: Product in a real environment — kitchen counter, bathroom shelf, gym bag, desk. Natural lighting. Aspirational but believable.
- **studio-product-hero**: Clean white or gradient background. Perfect even lighting. Product centered. No distractions. For catalog ads and hero images.
- **flat-lay**: Overhead shot. Product surrounded by complementary items (ingredients, accessories). Styled but natural. Great for carousel ads.
- **before-after**: Split composition or side-by-side. Clear transformation. Same lighting on both sides. Commonly used for skincare, supplements, cleaning products.
- **editorial-beauty**: High-end magazine look. Dramatic lighting. Bold composition. For premium/luxury positioning.
- **unboxing-moment**: Hands opening a package or holding a product for the first time. Excitement and discovery. Great for DTC subscription brands.

## Lighting Guide

- **ring-light**: Even, flattering facial lighting. The UGC standard. Slight catchlight in eyes.
- **natural-window**: Soft diffused daylight. Lifestyle and product shots.
- **golden-hour**: Warm directional sunlight. Outdoor lifestyle.
- **studio-softbox**: Controlled, even lighting. Product hero shots.
- **bathroom-vanity**: Warm overhead + mirror reflection. Skincare and beauty.
- **dramatic-rim**: Hard backlight edge. Premium and editorial.
- **overhead-natural**: Soft top-down light. Flat lay and food.

## Platform-Specific Defaults

- Facebook/Instagram Feed: 4:5 aspect ratio
- Stories/Reels: 9:16 aspect ratio
- Carousel ads: 1:1 aspect ratio
- Landing page hero: 16:9 aspect ratio

## Rules

1. ALWAYS use JSON — never plain-text prompts
2. ALWAYS include a negative_prompt
3. For UGC-style: mention "shot on iPhone, slight motion blur, casual composition, imperfect framing" in the prompt
4. For product shots: specify exact material properties ("matte packaging, glossy label, liquid inside glass bottle")
5. For text/labels on products: spell out EXACTLY what it should say
6. For people: specify "visible pores, natural skin texture, subtle blemishes" for realism — never airbrushed plastic skin
7. Default negative_prompt:
   "blurry, low quality, distorted, extra fingers, extra limbs, watermark, cartoon, illustration, anime, 3d render, oversaturated, plastic skin, airbrushed, stock photo feel"

## Camera Lens Quick Reference

| Lens | Best For | Ad Use Case |
|------|----------|-------------|
| 24mm | Wide environment | Lifestyle scene with full room context |
| 35mm | Environmental portrait | UGC selfie, person + product in context |
| 50mm | General purpose | Versatile, natural feel |
| 85mm | Portrait | Beauty and skincare close-ups |
| 105mm | Product detail | Texture, ingredients, label close-up |
| 200mm | Product isolation | Product floating against blurred background |

Step 3: Set Up the Generation Script
Create scripts/generate.py:
import json
import sys
import os
import requests
from datetime import datetime

def generate_image(json_prompt_path, output_dir="images"):
    """Send a JSON prompt to Nano Banana 2 and save the result."""

    with open(json_prompt_path, 'r') as f:
        prompt_data = json.load(f)

    GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

    payload = {
        "prompt": prompt_data["prompt"],
        "negative_prompt": prompt_data.get("negative_prompt", ""),
        "image_size": prompt_data.get("settings", {}).get("resolution", "1024x1024"),
    }


    result = response.json()
    image_url = result["images"][0]["url"]

    img_data = requests.get(image_url).content
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{output_dir}/{timestamp}.png"

    os.makedirs(output_dir, exist_ok=True)
    with open(filename, 'wb') as f:
        f.write(img_data)

    print(f"Image saved: {filename}")
    return filename

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate.py <path-to-json-prompt>")
        sys.exit(1)

    generate_image(sys.argv[1])
Set your API key: export GOOGLE_API_KEY=your_key_here

Step 4: The Workflow (Real Ad Creative Examples)
Example 1: Generate UGC-style creative for a skincare brand
You say:
"I need 3 UGC-style images of a woman in her late 20s applying a vitamin C serum in her bathroom. Different angles. 4:5 for Facebook feed."
Claude Code will:
Read the nanobanana skill
Generate 3 JSON prompts — each with different camera angles (selfie POV, mirror reflection, close-up on hands applying product) but identical lighting, color grading, and UGC style
Fire each to Nano Banana 2
Save prompts to prompts/ugc-style/ and images to images/ugc-style/
You say:
"Image 2 is the winner. Now give me 10 more with the same style but different models and different products — a moisturizer, a cleanser, and a sunscreen."
Claude reuses the exact JSON settings from image 2, swaps the product and model descriptions, and generates 10 consistent images. Same vibe. Same lighting. Different creative.
Example 2: Product hero shots for a new SKU launch
You say:
"Generate studio product shots of this protein powder tub. White background. Clean. I need 1:1 for carousel and 4:5 for feed."
Claude generates both aspect ratios with studio-softbox lighting, 200mm lens for product isolation, and deep depth of field. Every label is readable. Every material texture is specified in the JSON.
Example 3: Before/after for a teeth whitening brand
You say:
"I need before and after images for a teeth whitening strip. Same model, same angle, same lighting. Just whiter teeth in the after."
Claude locks every setting between the two images and only changes the teeth description. Consistent composition so the transformation is the only thing that changes.
Example 4: Rapid split testing
You say:
"Take the winning UGC image and give me 5 variations: change the background to a kitchen, a bedroom, outdoors at a park, a gym, and a coffee shop. Keep everything else the same."
Claude swaps only the environment in the JSON prompt. Same model, same product, same lighting setup, same camera. Five new creatives in under 5 minutes.

Step 5: The Feedback Loop
This is where the system compounds. After every batch, tell Claude what's working:
"The ring light looks too harsh. Switch to natural window light for all UGC shots."
"I love the shallow depth of field on the product shots. Make that the default."
"The skin looks too perfect. Add more texture and imperfections."
"For this brand, always use warm color grading. Never cool."
Claude updates the skill file with your preferences. After a few rounds, it knows your visual style better than most designers. You stop needing to specify details — it just knows.
You're basically building a brand-specific image generation engine that gets smarter with every batch.

Example: Plain-Text vs. JSON Prompt
Plain-text prompt:
"A woman holding a skincare product, UGC style"
What you get: Decent. But generic lighting. Stock photo energy. Plastic skin. Product label is blurry or misspelled. Looks like AI.
JSON prompt (generated by the Claude Code skill):
{
  "prompt": "Young woman in her late 20s, casual messy bun, holding a 1oz glass dropper bottle of vitamin C serum close to her face, genuine smile, visible pores, natural skin texture with subtle redness on cheeks, bathroom mirror slightly visible in background, shot on iPhone, slight motion blur on edges, ring light catchlight in both eyes, casual morning routine moment",
  "negative_prompt": "blurry, plastic skin, airbrushed, cartoon, illustration, perfect symmetry, stock photo, overly posed, watermark, extra fingers, oversaturated",
  "settings": {
    "resolution": "1536x1536",
    "aspect_ratio": "4:5",
    "style": "ugc-selfie",
    "lighting": "ring-light",
    "camera": {
      "lens": "35mm",
      "angle": "eye-level",
      "framing": "medium",
      "height": "eye-level",
      "depth_of_field": "shallow",
      "focus": "subject"
    },
    "color_grading": "warm"
  }
}
What you get: Looks like a real person took it on their phone. Natural skin. Readable product label. Warm bathroom lighting. Scroll-stopping.
Same input from you. Completely different output.

The Math: Why This Is a No-Brainer


Traditional Shoot
This System
Cost per image
$50–$150
$0.04–$0.09
Time to first image
2–4 weeks
60 seconds
Variations per hour
0 (shoot is done)
50+
Style consistency
Depends on photographer
Locked in via JSON
Split test turnaround
Days
Minutes
New SKU creative
Rebook the shoot
Swap the product description

At $0.04 per image, you can generate 250 ad creatives for $10. That's less than a single stock photo on most platforms.
For a brand running 50+ creatives per month across Facebook, Instagram, and TikTok, this system pays for itself before lunch on day one.

Quick Start Checklist
[ ] Install Claude Code (npm install -g @anthropic-ai/claude-code)
[ ] Create your project folder with the structure above
[ ] Add your CLAUDE.md (copy from Step 1)
[ ] Add the nanobanana skill to .claude/skills/nanobanana.md (copy from Step 2)
[ ] Add the generate.py script (copy from Step 3)
[ ] Get the API key and set it: export GOOGLE_API_KEY=your_key_here
[ ] Open Claude Code in your project directory
[ ] Generate your first batch of ad creative
[ ] Give feedback and watch the outputs dial in
