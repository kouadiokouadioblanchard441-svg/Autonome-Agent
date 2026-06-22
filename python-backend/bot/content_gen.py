"""
AI Content Generation — text, images, video search.
Used by the autonomous engine to generate posts for groups/channels.
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
import random
from typing import Optional

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")


# ── Topic Analysis ────────────────────────────────────────────────────────────

async def analyze_group_topic(title: str, about: str = "", sample_msgs: list[str] = []) -> dict:
    """
    Use AI to detect the topic, language and ideal content style for a group.
    Returns dict with keys: topic, language, tone, content_ideas.
    """
    if not OPENAI_API_KEY:
        return _fallback_topic(title)

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        msgs_str = "\n".join(sample_msgs[:5]) if sample_msgs else "N/A"
        prompt = (
            f"Group title: {title}\n"
            f"Description: {about or 'N/A'}\n"
            f"Recent messages sample:\n{msgs_str}\n\n"
            "Analyze this Telegram group and respond ONLY with a JSON object (no markdown) containing:\n"
            '{"topic": "...", "language": "fr|en|ar|es|...", "tone": "professional|casual|crypto|motivational|news", '
            '"content_ideas": ["idea1", "idea2", "idea3"]}'
        )
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.3,
        )
        import json
        text = resp.choices[0].message.content or "{}"
        text = text.strip().strip("```json").strip("```").strip()
        return json.loads(text)
    except Exception as e:
        logger.warning("Topic analysis failed: %s", e)
        return _fallback_topic(title)


def _fallback_topic(title: str) -> dict:
    title_lower = title.lower()
    if any(w in title_lower for w in ["crypto", "bitcoin", "nft", "defi", "trading"]):
        return {"topic": "crypto", "language": "fr", "tone": "crypto", "content_ideas": ["market update", "trading tip", "community news"]}
    if any(w in title_lower for w in ["sport", "foot", "basket", "fitness"]):
        return {"topic": "sports", "language": "fr", "tone": "casual", "content_ideas": ["match result", "training tip", "player news"]}
    if any(w in title_lower for w in ["news", "actu", "info"]):
        return {"topic": "news", "language": "fr", "tone": "news", "content_ideas": ["breaking news", "analysis", "summary"]}
    return {"topic": "community", "language": "fr", "tone": "casual", "content_ideas": ["community update", "tips", "question"]}


# ── Text Generation ───────────────────────────────────────────────────────────

TONE_PROMPTS = {
    "professional": "Tu es un communicant professionnel. Tes messages sont concis, clairs et formels.",
    "casual": "Tu es un membre actif et sympathique de la communauté. Tu parles naturellement, comme un humain.",
    "crypto": "Tu es un expert crypto enthousiaste. Tu utilises le jargon du marché, tu restes bullish et positif.",
    "motivational": "Tu es un coach motivationnel puissant. Tu inspires, tu encourages, tu donnes de l'énergie.",
    "news": "Tu es un journaliste factuel. Tu rapportes les faits clairement, sans exagération.",
}


async def generate_text_with_trust(
    topic: str,
    tone: str = "casual",
    language: str = "fr",
    content_idea: str = "",
    personality_prompt: str = "",
    max_tokens: int = 1500,
    append_badge: bool = False,
):
    """
    Generate text then run trust/fact-check on it.
    Returns (text, trust_result). If append_badge=True, badge is appended to text.
    """
    from .trust_checker import check_and_label
    raw_text = await generate_text(
        topic=topic, tone=tone, language=language,
        content_idea=content_idea, personality_prompt=personality_prompt,
        max_tokens=max_tokens,
    )
    labeled_text, trust = await check_and_label(raw_text, append_badge=append_badge, language=language)
    return labeled_text, trust


async def generate_text(
    topic: str,
    tone: str = "casual",
    language: str = "fr",
    content_idea: str = "",
    personality_prompt: str = "",
    max_tokens: int = 1500,
) -> str:
    """Generate a post text using OpenAI or Gemini."""

    lang_map = {"fr": "français", "en": "English", "ar": "arabe", "es": "espagnol"}
    lang_name = lang_map.get(language, language)
    system = personality_prompt or TONE_PROMPTS.get(tone, TONE_PROMPTS["casual"])
    user_prompt = (
        f"Écris un post Telegram riche et détaillé sur le sujet: {topic}.\n"
        f"Idée de contenu: {content_idea or 'libre'}\n"
        f"Langue: {lang_name}\n"
        f"Important: NE PAS mettre de titre en gras, NE PAS utiliser de markdown (pas de **, __, ##). "
        f"Longueur OBLIGATOIRE: minimum 300 mots, idéalement entre 400 et 800 mots. "
        f"Structure le texte en plusieurs paragraphes distincts séparés par une ligne vide. "
        f"Chaque paragraphe doit apporter une valeur ajoutée (contexte, analyse, conseil, exemple concret, perspective). "
        f"Pas de hashtags sauf si le ton est crypto/casual (3 max à la fin)."
    )

    # Try OpenAI first
    if OPENAI_API_KEY:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=max_tokens,
                temperature=0.85,
            )
            text = resp.choices[0].message.content or ""
            if text.strip():
                return text.strip()
        except Exception as e:
            logger.warning("OpenAI text gen failed: %s", e)

    # Fallback: Gemini
    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")
            full_prompt = f"{system}\n\n{user_prompt}"
            generation_config = genai.types.GenerationConfig(max_output_tokens=2000, temperature=0.85)
            resp = await asyncio.to_thread(model.generate_content, full_prompt, generation_config=generation_config)
            text = resp.text or ""
            if text.strip():
                return text.strip()
        except Exception as e:
            logger.warning("Gemini text gen failed: %s", e)

    # Last resort: template
    return _template_text(topic, tone)


def _template_text(topic: str, tone: str) -> str:
    templates = {
        "crypto": [
            "Le marché continue d'évoluer. Les fondamentaux restent solides. HODL et restez informés! 🚀",
            "La volatilité est l'opportunité des investisseurs patients. DCA et vision long terme. 💎",
        ],
        "casual": [
            f"Bonjour la communauté! Comment se passe votre journée? Parlons de {topic}. 👋",
            f"Quoi de neuf sur {topic}? Partagez vos expériences avec nous! 🔥",
        ],
        "motivational": [
            "Chaque grand voyage commence par un premier pas. Vous êtes capables! 💪",
            "La différence entre où vous êtes et où vous voulez être, c'est ce que vous faites aujourd'hui. 🎯",
        ],
    }
    options = templates.get(tone, templates["casual"])
    return random.choice(options)


# ── Image Generation ──────────────────────────────────────────────────────────

async def generate_image(prompt: str) -> Optional[bytes]:
    """
    Generate an image with DALL-E 3.
    Returns raw PNG bytes or None if generation fails.
    """
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set — image generation disabled")
        return None

    try:
        import openai
        import httpx
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        image_url = resp.data[0].url
        if not image_url:
            return None

        async with httpx.AsyncClient(timeout=30) as http:
            img_resp = await http.get(image_url)
            img_resp.raise_for_status()
            return img_resp.content
    except Exception as e:
        logger.error("Image generation failed: %s", e)
        return None


async def generate_image_prompt(topic: str, tone: str, content: str) -> str:
    """Ask AI to craft an ideal DALL-E prompt based on context."""
    if not OPENAI_API_KEY:
        return f"A professional, vibrant digital illustration about {topic}, modern style, no text"

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"Create a DALL-E image prompt for a Telegram post about: {topic}.\n"
                    f"Tone: {tone}\n"
                    f"Post content: {content[:200]}\n"
                    "Requirements: photorealistic or digital art, no text in image, "
                    "professional quality, engaging visuals. "
                    "Return ONLY the prompt, nothing else."
                )
            }],
            max_tokens=120,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        return f"A professional, vibrant digital illustration about {topic}, modern style, no text"


# ── Video Search (Pexels) ─────────────────────────────────────────────────────

async def search_pexels_video(query: str) -> Optional[str]:
    """
    Search for a stock video on Pexels.
    Returns a direct video URL or None.
    Requires PEXELS_API_KEY env var.
    """
    if not PEXELS_API_KEY:
        return None

    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.get(
                "https://api.pexels.com/videos/search",
                params={"query": query, "per_page": 5, "size": "small"},
                headers={"Authorization": PEXELS_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()
            videos = data.get("videos", [])
            if not videos:
                return None
            # Pick a short video (< 60s)
            for video in videos:
                duration = video.get("duration", 999)
                if duration <= 60:
                    files = video.get("video_files", [])
                    # Prefer HD but not 4K
                    for f in files:
                        if f.get("quality") in ("hd", "sd"):
                            return f.get("link")
            # Fallback: first available file
            files = videos[0].get("video_files", [])
            if files:
                return files[0].get("link")
    except Exception as e:
        logger.warning("Pexels video search failed: %s", e)
    return None
