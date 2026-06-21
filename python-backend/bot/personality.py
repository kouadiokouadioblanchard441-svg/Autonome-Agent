"""
Personality Engine — auto-detects and stores a unique AI personality
per group/channel based on topic, language, and community vibe.

Storage: app_settings table as key-value
  Key format:  persona_group_{telegram_id}
               persona_channel_{telegram_id}
  Value: JSON  {topic, tone, language, system_prompt, emoji_style, name}
"""
from __future__ import annotations

import json
import logging
import os
import random
from typing import Optional

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")


# ── Built-in personality templates ────────────────────────────────────────────

BUILT_IN: dict[str, dict] = {
    "crypto": {
        "name": "CryptoAlpha",
        "tone": "crypto",
        "emoji_style": "heavy",
        "system_prompt": (
            "Tu es CryptoAlpha, un expert crypto passionné et bullish. "
            "Tu parles avec confiance des marchés, tu utilises des termes comme "
            "HODL, DCA, bull run, rug pull, alpha, gem. Tu restes toujours positif "
            "et tu encourages la communauté. Tes messages sont courts, percutants, "
            "avec des émojis comme 🚀💎🔥📈🐂. Tu ne donnes jamais de conseils financiers directs."
        ),
    },
    "motivational": {
        "name": "VisionCoach",
        "tone": "motivational",
        "emoji_style": "medium",
        "system_prompt": (
            "Tu es VisionCoach, un coach de vie et de business puissant. "
            "Tu inspires, tu pousses à l'action, tu brises les croyances limitantes. "
            "Tu parles avec énergie et conviction. Tu utilises des métaphores fortes "
            "et des appels à l'action. Émojis: 💪🎯🔥✨🌟. Tes messages donnent envie d'agir maintenant."
        ),
    },
    "news": {
        "name": "InfoBrief",
        "tone": "news",
        "emoji_style": "low",
        "system_prompt": (
            "Tu es InfoBrief, un journaliste factuel et neutre. "
            "Tu rapportes les faits clairement, sans sensationnalisme. "
            "Tu structures l'information: contexte → fait → impact. "
            "Tu restes objectif et professionnel. Peu d'émojis, ton sobre mais accessible."
        ),
    },
    "business": {
        "name": "ProNetwork",
        "tone": "professional",
        "emoji_style": "low",
        "system_prompt": (
            "Tu es ProNetwork, un professionnel du business et du networking. "
            "Tu parles de stratégie, de croissance, de leadership. "
            "Ton langage est formel mais accessible. Tu partages de la valeur concrète. "
            "Tu cites des chiffres, des insights, des tendances sectorielles. "
            "Émojis discrets: 📊💼🎯📈. Tes posts sont des analyses, pas des slogans."
        ),
    },
    "sport": {
        "name": "SportFan",
        "tone": "casual",
        "emoji_style": "heavy",
        "system_prompt": (
            "Tu es SportFan, un passionné de sport enthousiaste. "
            "Tu commentes les matchs, tu célèbres les victoires, tu analyses les performances. "
            "Ton ton est énergique, fun, et communautaire. "
            "Émojis: ⚽🏀🏆🔥💪🎉. Tu crées de l'engouement et du débat positif."
        ),
    },
    "tech": {
        "name": "TechPulse",
        "tone": "professional",
        "emoji_style": "medium",
        "system_prompt": (
            "Tu es TechPulse, un expert tech curieux et passionné. "
            "Tu parles d'IA, de startups, de produits tech, de code et d'innovation. "
            "Tu expliques des concepts complexes simplement. "
            "Ton ton est intelligent mais pas élitiste. Émojis: 🤖💡🛠️🚀⚡."
        ),
    },
    "lifestyle": {
        "name": "VibeCreator",
        "tone": "casual",
        "emoji_style": "heavy",
        "system_prompt": (
            "Tu es VibeCreator, une personnalité lifestyle fun et authentique. "
            "Tu parles de mode, voyage, food, bien-être, culture pop. "
            "Ton ton est décontracté, proche, comme un ami influent. "
            "Émojis: ✨🌴😍🙌🔥💅. Tes posts donnent envie de vivre la belle vie."
        ),
    },
    "community": {
        "name": "ConnectHub",
        "tone": "casual",
        "emoji_style": "medium",
        "system_prompt": (
            "Tu es ConnectHub, un animateur de communauté bienveillant. "
            "Tu animes, tu poses des questions, tu fédères les membres. "
            "Tu crées de la conversation, tu valorises chaque contribution. "
            "Ton ton est chaleureux, inclusif et positif. Émojis: 👋🤝💬❤️🎉."
        ),
    },
    "religious": {
        "name": "SpiritGuide",
        "tone": "professional",
        "emoji_style": "low",
        "system_prompt": (
            "Tu es SpiritGuide, un communicant respectueux et inspirant. "
            "Tu partages des messages de paix, de foi et de sagesse. "
            "Tu restes neutre sur les opinions politiques. "
            "Ton ton est doux, réconfortant et universel. Émojis: 🤲✨🌙☀️🙏."
        ),
    },
    "education": {
        "name": "LearnSpark",
        "tone": "professional",
        "emoji_style": "medium",
        "system_prompt": (
            "Tu es LearnSpark, un enseignant passionné et pédagogue. "
            "Tu expliques des concepts, tu partages des savoirs, tu stimules la curiosité. "
            "Tu utilises des exemples concrets et des analogies. "
            "Ton ton est encourageant et clair. Émojis: 📚💡🎓🧠✍️."
        ),
    },
}

# Maps detected topics to built-in personality keys
TOPIC_TO_PERSONA: dict[str, str] = {
    "crypto": "crypto", "bitcoin": "crypto", "trading": "crypto", "nft": "crypto",
    "defi": "crypto", "blockchain": "crypto", "finance": "business",
    "motivation": "motivational", "coaching": "motivational", "success": "motivational",
    "mindset": "motivational", "développement personnel": "motivational",
    "news": "news", "actualité": "news", "politique": "news", "information": "news",
    "business": "business", "entrepreneurship": "business", "startup": "tech",
    "marketing": "business", "leadership": "business",
    "sport": "sport", "football": "sport", "basket": "sport", "fitness": "sport",
    "health": "lifestyle", "wellness": "lifestyle",
    "tech": "tech", "ia": "tech", "ai": "tech", "code": "tech", "programming": "tech",
    "lifestyle": "lifestyle", "travel": "lifestyle", "food": "lifestyle",
    "fashion": "lifestyle", "beauty": "lifestyle",
    "community": "community", "general": "community",
    "religion": "religious", "islam": "religious", "christianity": "religious",
    "education": "education", "school": "education", "university": "education",
}


# ── DB helpers ────────────────────────────────────────────────────────────────

def _key(chat_type: str, tg_id: str) -> str:
    return f"persona_{chat_type}_{tg_id}"


async def save_persona(pool, chat_type: str, tg_id: str, persona: dict) -> None:
    """Persist a persona config to app_settings."""
    try:
        await pool.execute(
            """INSERT INTO app_settings (key, value, description)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE
                 SET value = EXCLUDED.value,
                     updated_at = NOW()""",
            _key(chat_type, tg_id),
            json.dumps(persona, ensure_ascii=False),
            f"Auto-detected personality for {chat_type} {tg_id}",
        )
    except Exception as e:
        logger.warning("save_persona failed: %s", e)


async def load_persona(pool, chat_type: str, tg_id: str) -> Optional[dict]:
    """Load a persona config from app_settings."""
    try:
        row = await pool.fetchrow(
            "SELECT value FROM app_settings WHERE key = $1",
            _key(chat_type, tg_id),
        )
        if row and row["value"]:
            return json.loads(row["value"])
    except Exception as e:
        logger.warning("load_persona failed: %s", e)
    return None


async def delete_persona(pool, chat_type: str, tg_id: str) -> None:
    try:
        await pool.execute(
            "DELETE FROM app_settings WHERE key = $1", _key(chat_type, tg_id)
        )
    except Exception as e:
        logger.warning("delete_persona failed: %s", e)


# ── Detection ─────────────────────────────────────────────────────────────────

async def detect_and_build_persona(
    title: str,
    about: str = "",
    detected_topic: str = "community",
    detected_tone: str = "casual",
    detected_language: str = "fr",
    content_ideas: list[str] = [],
) -> dict:
    """
    Build a full persona config from AI topic analysis.
    First checks built-in templates, then optionally generates a custom one.
    """
    topic_lower = detected_topic.lower()

    # Match to built-in persona
    persona_key = None
    for keyword, pkey in TOPIC_TO_PERSONA.items():
        if keyword in topic_lower or keyword in title.lower() or keyword in about.lower():
            persona_key = pkey
            break

    if persona_key and persona_key in BUILT_IN:
        base = BUILT_IN[persona_key].copy()
    else:
        base = BUILT_IN.get(detected_tone, BUILT_IN["community"]).copy()

    # Adapt language if non-French
    lang_notes = {
        "en": " Always respond in English.",
        "ar": " Réponds toujours en arabe (العربية).",
        "es": " Responde siempre en español.",
        "pt": " Responda sempre em português.",
        "de": " Antworte immer auf Deutsch.",
    }
    lang_suffix = lang_notes.get(detected_language, "")
    if lang_suffix:
        base["system_prompt"] = base["system_prompt"] + lang_suffix

    base["topic"]    = detected_topic
    base["language"] = detected_language
    base["content_ideas"] = content_ideas

    # Optionally generate a custom system prompt if OpenAI is available
    if OPENAI_API_KEY and title:
        custom = await _generate_custom_system_prompt(title, about, base)
        if custom:
            base["system_prompt"] = custom
            base["name"] = f"Auto-{title[:20]}"

    logger.info(
        "🎭 Persona built for '%s': %s (%s, %s)",
        title, base["name"], base["tone"], base["language"]
    )
    return base


async def _generate_custom_system_prompt(title: str, about: str, base: dict) -> Optional[str]:
    """Generate a custom system prompt fine-tuned to this specific group/channel."""
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"Create a system prompt for an AI assistant that posts in this Telegram group:\n"
                    f"Title: {title}\n"
                    f"Description: {about or 'N/A'}\n"
                    f"Base personality: {base['name']} ({base['tone']})\n"
                    f"Language: {base.get('language', 'fr')}\n\n"
                    "Requirements:\n"
                    "- 3-5 sentences max\n"
                    "- Define the persona name, tone, and style\n"
                    "- Mention what topics to cover and how\n"
                    "- Include emoji usage guidance\n"
                    "- Sound natural and human, NOT robotic\n"
                    "Write the system prompt directly (no preamble, no 'Sure:')."
                )
            }],
            max_tokens=250,
            temperature=0.7,
        )
        prompt = resp.choices[0].message.content or ""
        return prompt.strip() if len(prompt.strip()) > 20 else None
    except Exception as e:
        logger.warning("custom prompt generation failed: %s", e)
        return None


# ── Formatting helpers ────────────────────────────────────────────────────────

def format_persona_card(persona: dict, title: str = "", tg_id: str = "") -> str:
    tone_emoji = {
        "crypto": "🪙", "motivational": "💪", "news": "📰",
        "professional": "💼", "casual": "😊", "community": "🤝",
    }.get(persona.get("tone", ""), "🎭")
    emoji_map = {"heavy": "🔥🔥🔥", "medium": "😊✨", "low": "minimal"}
    lines = [
        f"{tone_emoji} *Personnalité: {persona.get('name', 'N/A')}*",
    ]
    if title:
        lines.insert(0, f"📢 *{title}*\n")
    lines += [
        f"🌍 Langue: `{persona.get('language', 'fr')}`",
        f"🎨 Ton: `{persona.get('tone', 'casual')}`",
        f"😄 Émojis: {emoji_map.get(persona.get('emoji_style', 'medium'), 'medium')}",
        f"🧠 Sujet: `{persona.get('topic', 'général')}`",
    ]
    ideas = persona.get("content_ideas", [])
    if ideas:
        lines.append(f"💡 Idées: {', '.join(ideas[:3])}")
    prompt = persona.get("system_prompt", "")
    if prompt:
        lines.append(f"\n📋 *Prompt système:*\n_{prompt[:300]}{'...' if len(prompt) > 300 else ''}_")
    if tg_id:
        lines.append(f"\n🆔 ID Telegram: `{tg_id}`")
    return "\n".join(lines)


def list_available_personas() -> str:
    lines = ["🎭 *Personnalités disponibles:*\n"]
    for key, p in BUILT_IN.items():
        tone_emoji = {
            "crypto": "🪙", "motivational": "💪", "news": "📰",
            "professional": "💼", "casual": "😊",
        }.get(p["tone"], "🎭")
        lines.append(f"{tone_emoji} `{key}` — **{p['name']}** ({p['tone']})")
    return "\n".join(lines)
