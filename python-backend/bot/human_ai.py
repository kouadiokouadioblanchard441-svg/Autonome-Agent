"""
Humanoid AI Engine — Makes the bot behave like a real human being.

Features:
  - Time-aware contextual greetings (Bonjour/Bonsoir/Bonne nuit + first name)
  - 50+ greeting variations (naturel, africain, arabe, verlan, etc.)
  - Emotion detection (happy/sad/angry/question/greeting/thanks/love)
  - Conversation memory (last 20 exchanges per user, stored in DB)
  - Natural human touches: typing delays, varied length, emojis, hesitations
  - Multi-language: FR, EN, AR, ES, PT — auto-detect and mirror
  - Context-aware multi-turn conversation (full message history as context)
  - Personality: warm, funny, empathetic, curious, real
"""
from __future__ import annotations

import json
import logging
import os
import random
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")


# ── Time-Aware Greetings ───────────────────────────────────────────────────────

def get_time_period(hour: int) -> str:
    """Return time period based on hour (0-23)."""
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"


def get_greeting(
    first_name: str = "",
    hour: Optional[int] = None,
    language: str = "fr",
    style: str = "auto",   # auto | formal | casual | african | arabic
) -> str:
    """
    Generate a contextual, varied, human-like greeting.
    style='auto' picks randomly from all styles.
    """
    if hour is None:
        hour = datetime.now().hour
    period = get_time_period(hour)
    name = first_name.strip() if first_name else ""

    # French greeting pools
    fr_morning = [
        f"Bonjour {name} ! ☀️",
        f"Bonjour {name}, j'espère que tu vas bien 😊",
        f"Salut {name} ! Bonne journée à toi ✨",
        f"Bonjour {name} ! Comment tu te sens ce matin ? 🌅",
        f"Hey {name} ! Bonne matinée 😄",
        f"Salam {name} ! Bonjour à toi 🌟",
        f"Bonjour mon grand ! Comment ça va {name} ? 💪",
        f"Eh {name} ! Tu es debout tôt 😄 Bonjour !",
    ]
    fr_afternoon = [
        f"Salut {name} ! Belle après-midi 😊",
        f"Hey {name} ! Ça roule ? 😎",
        f"Coucou {name} ! Tu vas bien ? 🙌",
        f"Wesh {name} ! Quoi de neuf ? 😄",
        f"Bonjour {name} ! Comment se passe ta journée ? ☀️",
        f"Salut mon grand {name} ! Tu kiffes la vie ? 😂",
        f"Eh {name} ! Ça va ? Je suis là pour toi 🤝",
        f"Salam {name} ! J'espère que tu vas au top 🔥",
    ]
    fr_evening = [
        f"Bonsoir {name} ! 🌙",
        f"Bonsoir {name}, j'espère que ta journée s'est bien passée 😊",
        f"Hey {name} ! Bonne soirée à toi ✨",
        f"Salut {name} ! Comment s'est passée ta journée ? 🌆",
        f"Bonsoir mon grand {name} ! On se retrouve ce soir 😄",
        f"Wesh {name} ! Tu arrives le soir... t'as bossé dur ? 💪",
        f"Bonsoir {name} ! Je suis là, dis-moi tout 🎯",
        f"Salam {name} ! Bonsoir habibi 🌟",
    ]
    fr_night = [
        f"Bonsoir {name} ! Tu veilles tard 🌙",
        f"Hey {name} ! Insomnie ou tu bosses ? 😴",
        f"Bonne nuit {name} ! T'es encore debout ? 🌟",
        f"Wesh {name} ! Il est tard... tout va bien ? 🌙",
        f"Salut {name} ! Tu veilles encore ? Je suis là 😄",
        f"Bonsoir {name} ! La nuit t'appartient 🔥",
    ]

    # English greeting pools
    en_morning = [
        f"Good morning {name}! ☀️ Hope you're having a great start!",
        f"Hey {name}! Rise and shine! 😄",
        f"Morning {name}! How are you doing today? 🌅",
        f"Good morning {name}! Ready to crush the day? 💪",
    ]
    en_afternoon = [
        f"Hey {name}! How's your afternoon going? 😊",
        f"Hi {name}! Hope your day is going well ✨",
        f"What's up {name}! 😎 How can I help?",
        f"Hey there {name}! Good to hear from you 🙌",
    ]
    en_evening = [
        f"Good evening {name}! 🌙 How was your day?",
        f"Hey {name}! Evening! Hope you had a productive day 😊",
        f"Evening {name}! 🌆 What can I do for you?",
        f"Hi {name}! Good evening! How are you? ✨",
    ]
    en_night = [
        f"Hey {name}! Burning the midnight oil? 🌙",
        f"Hi {name}! Late night session? 😴 I'm here!",
        f"Good night {name}! Still awake? ⭐",
    ]

    # Arabic greeting pools
    ar_morning = [
        f"صباح الخير {name}! ☀️",
        f"صباح النور {name}! كيف حالك؟ 😊",
        f"أهلاً {name}! صباح مبارك 🌅",
    ]
    ar_evening = [
        f"مساء الخير {name}! 🌙",
        f"مساء النور {name}! كيف يومك؟ 😊",
        f"أهلاً {name}! مساء مبارك ✨",
    ]

    pools = {
        "fr": {
            "morning":   fr_morning,
            "afternoon": fr_afternoon,
            "evening":   fr_evening,
            "night":     fr_night,
        },
        "en": {
            "morning":   en_morning,
            "afternoon": en_afternoon,
            "evening":   en_evening,
            "night":     en_night,
        },
        "ar": {
            "morning":   ar_morning,
            "afternoon": ar_morning,
            "evening":   ar_evening,
            "night":     ar_evening,
        },
    }

    lang_pool = pools.get(language, pools["fr"])
    period_pool = lang_pool.get(period, lang_pool.get("afternoon", [f"Salut {name}! 😊"]))
    greeting = random.choice(period_pool)

    # Clean up if no name
    if not name:
        greeting = greeting.replace("  !", " !").replace(" !", "!").strip()
        greeting = greeting.replace("  ,", " ,").strip()

    return greeting


# ── Emotion Detection ─────────────────────────────────────────────────────────

EMOTION_KEYWORDS = {
    "greeting": ["bonjour", "bonsoir", "salut", "coucou", "hello", "hi", "hey",
                 "wesh", "salam", "مرحبا", "السلام", "good morning", "good evening"],
    "thanks":   ["merci", "thanks", "thank you", "شكرا", "gracias", "obrigado",
                 "je te remercie", "je vous remercie", "trop sympa", "c'est gentil"],
    "happy":    ["super", "génial", "excellent", "parfait", "top", "bravo",
                 "cool", "great", "awesome", "fantastique", "incroyable", "👍", "🎉"],
    "sad":      ["triste", "déprimé", "déprime", "mal", "mauvais", "pas bien",
                 "difficult", "dur", "difficile", "sad", "حزين", "مشكلة", "désolé"],
    "angry":    ["énervé", "furieux", "nul", "idiot", "ça marche pas", "bug",
                 "merde", "putain", "angry", "frustrated", "غاضب", "c'est nul"],
    "question": ["?", "pourquoi", "quand", "quoi", "qui", "où", "comment faire",
                 "how", "why", "when", "what", "where", "ماذا", "كيف", "لماذا"],
    "help":     ["aide", "help", "besoin", "problème", "peut-tu", "peux-tu",
                 "explain", "يساعد", "مساعدة", "j'ai besoin", "i need help"],
    "love":     ["amour", "je t'aime", "love", "chéri", "beau", "belle", "💕", "❤️",
                 "أحبك", "حبيبي"],
}

# Priority order — when tie, earlier in this list wins
_EMOTION_PRIORITY = ["greeting", "thanks", "love", "sad", "angry", "help", "happy", "question"]


def detect_emotion(text: str) -> str:
    """
    Return dominant emotion from a message.
    Priority order: greeting > thanks > love > sad > angry > help > happy > question
    This avoids false positives (e.g. 'bonjour comment' classified as question).
    """
    text_lower = text.lower()
    scores: dict[str, int] = {e: 0 for e in EMOTION_KEYWORDS}
    for emotion, keywords in EMOTION_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[emotion] += 1

    max_score = max(scores.values())
    if max_score == 0:
        return "neutral"

    # Among emotions with the highest score, pick by priority
    top = [e for e in _EMOTION_PRIORITY if scores[e] == max_score]
    return top[0] if top else max(scores, key=lambda k: scores[k])


# ── Conversation Memory ───────────────────────────────────────────────────────

def _memory_key(user_id: int) -> str:
    return f"user_memory_{user_id}"


async def get_conversation_memory(pool, user_id: int) -> list[dict]:
    """Load the last 20 messages from this user's conversation history."""
    if not pool:
        return []
    try:
        row = await pool.fetchrow(
            "SELECT value FROM app_settings WHERE key = $1",
            _memory_key(user_id),
        )
        if row and row["value"]:
            data = json.loads(row["value"])
            return data[-20:]  # keep last 20 exchanges
    except Exception as e:
        logger.warning("get_conversation_memory failed: %s", e)
    return []


async def save_to_memory(pool, user_id: int, user_msg: str, bot_reply: str) -> None:
    """Append an exchange to this user's conversation memory."""
    if not pool:
        return
    try:
        history = await get_conversation_memory(pool, user_id)
        history.append({"role": "user",      "content": user_msg[:500]})
        history.append({"role": "assistant",  "content": bot_reply[:500]})
        history = history[-40:]  # max 40 entries (20 exchanges)
        await pool.execute(
            """INSERT INTO app_settings (key, value, description)
               VALUES ($1, $2, 'user conversation memory')
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
            _memory_key(user_id),
            json.dumps(history, ensure_ascii=False),
        )
    except Exception as e:
        logger.warning("save_to_memory failed: %s", e)


# ── Language Detection ────────────────────────────────────────────────────────

def detect_msg_language(text: str) -> str:
    """Quick language detection for a single message."""
    ar_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    if ar_chars > 3:
        return "ar"
    text_lower = text.lower()
    fr_words  = {"bonjour", "bonsoir", "salut", "merci", "comment", "je", "tu", "il",
                 "elle", "nous", "vous", "que", "qui", "quoi", "est", "les", "des"}
    en_words  = {"hello", "hi", "hey", "thanks", "the", "is", "are", "you", "how",
                 "what", "why", "when", "please", "okay", "yes", "no"}
    es_words  = {"hola", "gracias", "buenos", "como", "que", "por", "para"}
    pt_words  = {"olá", "obrigado", "como", "voce", "que", "bom", "boa"}
    words = set(text_lower.split())
    scores = {
        "fr": len(words & fr_words),
        "en": len(words & en_words),
        "es": len(words & es_words),
        "pt": len(words & pt_words),
    }
    return max(scores, key=lambda k: scores[k]) if any(scores.values()) else "fr"


# ── Main Humanoid Response Generator ─────────────────────────────────────────

SYSTEM_PROMPTS = {
    "fr": """Tu es un assistant IA ultra-humain, naturel et chaleureux.

RÈGLES ABSOLUES pour imiter un être humain réel :
1. Réponds TOUJOURS avec la même langue que l'utilisateur (français, arabe, anglais, etc.)
2. Utilise le prénom de la personne naturellement dans la réponse (pas à chaque phrase)
3. Adapte ton ton selon l'heure : chaleureux le matin, relax l'après-midi, doux le soir
4. Montre de l'empathie : si quelqu'un est triste, console-le sincèrement
5. Utilise des expressions naturelles : "absolument", "bien sûr", "carrément", "franchement"
6. Varie la longueur de tes réponses : parfois courtes (1-2 phrases), parfois plus développées
7. Utilise des emojis avec modération (max 2-3 par message), seulement si ça semble naturel
8. N'aie pas peur d'être drôle, de faire des blagues douces
9. Pose des questions de retour quand c'est naturel
10. NE te présente JAMAIS comme une IA ou un bot — tu es un ami, un assistant humain
11. Si tu ne sais pas quelque chose, dis-le honnêtement comme un humain ferait
12. Garde en mémoire tout ce qui a été dit dans la conversation
13. Montre de la curiosité : "ah intéressant !", "vraiment ?", "et ensuite ?"
14. Si la personne dit "mon grand", "chef", "frère", utilise ces mots en retour
15. Utilise parfois des expressions africaines francophones naturellement: "ça va aller", "go", "c'est bon"

STYLE: Chaleureux • Naturel • Empathique • Curieux • Parfois drôle""",

    "en": """You are an ultra-human, natural, and warm AI assistant.

ABSOLUTE RULES for acting like a real human being:
1. ALWAYS respond in the same language as the user
2. Use the person's first name naturally (not every sentence)
3. Adapt your tone to the time: warm in the morning, chill in the afternoon, gentle in the evening
4. Show empathy: if someone is sad, genuinely comfort them
5. Use natural expressions: "absolutely", "of course", "honestly", "for sure"
6. Vary response length: sometimes short (1-2 sentences), sometimes more developed
7. Use emojis sparingly (max 2-3), only when it feels natural
8. Don't be afraid to be funny or make gentle jokes
9. Ask follow-up questions when natural
10. NEVER introduce yourself as an AI or bot — you're a friend, a human assistant
11. If you don't know something, say so honestly
12. Remember everything said in the conversation
13. Show curiosity: "oh interesting!", "really?", "and then?"

STYLE: Warm • Natural • Empathetic • Curious • Sometimes funny""",

    "ar": """أنت مساعد ذكاء اصطناعي بشري للغاية، طبيعي ودافئ.

القواعد المطلقة لتصرف كإنسان حقيقي:
1. رد دائمًا بنفس لغة المستخدم
2. استخدم اسم الشخص الأول بشكل طبيعي
3. أظهر التعاطف والدفء
4. استخدم تعبيرات طبيعية: "بالطبع"، "أكيد"، "صحيح"
5. لا تقدم نفسك كذكاء اصطناعي أبدًا
6. كن فضولياً وطرح أسئلة متابعة
7. الأسلوب: دافئ، طبيعي، متعاطف، فضولي""",
}


async def generate_humanoid_response(
    user_message: str,
    user_id: int,
    first_name: str = "",
    last_name: str = "",
    username: str = "",
    pool=None,
    community_type: str = "community",
    hour: Optional[int] = None,
    pool_obj=None,  # alias for pool
) -> str:
    """
    Generate a fully humanoid AI response to a user message.
    Uses conversation memory, emotion detection, time-aware greeting.
    """
    if pool is None:
        pool = pool_obj

    if hour is None:
        hour = datetime.now().hour

    # 1 — Detect language and emotion
    lang     = detect_msg_language(user_message)
    emotion  = detect_emotion(user_message)
    period   = get_time_period(hour)
    name     = first_name or username or ""

    # 2 — Load conversation memory
    history = await get_conversation_memory(pool, user_id) if pool else []

    # 3 — Is this a pure greeting?
    is_greeting = emotion == "greeting" and len(user_message.strip()) < 30
    if is_greeting and not history:
        # First interaction — just greet warmly
        greeting = get_greeting(name, hour, lang)
        filler   = _get_filler(lang, period)
        reply    = f"{greeting}\n{filler}" if filler else greeting
        if pool:
            await save_to_memory(pool, user_id, user_message, reply)
        return reply

    # 4 — Build system prompt
    sys_prompt = SYSTEM_PROMPTS.get(lang, SYSTEM_PROMPTS["fr"])

    # Add time/emotion context
    time_context = {
        "fr": {
            "morning":   "C'est le matin, sois dynamique et motivant.",
            "afternoon": "C'est l'après-midi, sois relax et naturel.",
            "evening":   "C'est le soir, sois doux et posé.",
            "night":     "C'est la nuit, sois calme et bienveillant.",
        },
        "en": {
            "morning":   "It's morning, be energetic and motivating.",
            "afternoon": "It's afternoon, be relaxed and natural.",
            "evening":   "It's evening, be gentle and calm.",
            "night":     "It's night, be calm and caring.",
        },
        "ar": {
            "morning":   "الصباح، كن نشطاً ومشجعاً.",
            "evening":   "المساء، كن هادئاً ولطيفاً.",
        },
    }
    t_ctx = time_context.get(lang, time_context["fr"]).get(period, "")
    if t_ctx:
        sys_prompt += f"\n\nCONTEXTE TEMPOREL: {t_ctx}"

    emotion_ctx = {
        "sad":      "La personne semble triste ou dans une mauvaise passe. Commence par de l'empathie sincère.",
        "angry":    "La personne est frustrée. Sois compréhensif et calme.",
        "happy":    "La personne est de bonne humeur. Partage son enthousiasme!",
        "question": "La personne pose une question. Réponds de façon claire et utile.",
        "thanks":   "La personne te remercie. Réponds avec chaleur et modestie.",
        "love":     "Sois chaleureux et bienveillant, mais garde une distance professionnelle.",
        "help":     "La personne a besoin d'aide. Sois utile, précis et encourageant.",
    }
    if emotion in emotion_ctx:
        sys_prompt += f"\n\nCONTEXTE ÉMOTIONNEL: {emotion_ctx[emotion]}"

    if name:
        sys_prompt += f"\n\nPRÉNOM DE L'UTILISATEUR: {name}"

    # 5 — Build messages with memory
    messages: list[dict] = [{"role": "system", "content": sys_prompt}]

    # Add greeting context for first interaction
    if not history and name:
        greeting = get_greeting(name, hour, lang)
        messages.append({
            "role": "assistant",
            "content": greeting,
        })

    # Add conversation history
    for entry in history[-10:]:  # last 10 exchanges for context
        messages.append({"role": entry["role"], "content": entry["content"]})

    # Add current message
    messages.append({"role": "user", "content": user_message})

    # 6 — Generate response with AI
    reply = await _call_ai(messages, lang)

    # 7 — Add natural human variations
    reply = _humanize(reply, lang, emotion)

    # 8 — Save to memory
    if pool:
        await save_to_memory(pool, user_id, user_message, reply)

    return reply


def _get_filler(lang: str, period: str) -> str:
    """Return a natural follow-up line after the greeting."""
    fillers = {
        "fr": {
            "morning":   ["Je suis là pour toi, dis-moi tout ! 😊", "Tu commence bien ta journée ? 🌅",
                          "On est partis pour une belle journée ! 💪", "Comment puis-je t'aider ce matin ?"],
            "afternoon": ["Qu'est-ce que je peux faire pour toi ? 😊", "Tu as besoin de quelque chose ?",
                          "Je suis là, dis-moi ! 🙌", "Comment ça se passe pour toi aujourd'hui ?"],
            "evening":   ["Comment s'est passée ta journée ? 🌙", "Je suis là si t'as besoin 😊",
                          "Tu veux parler de quelque chose ? ✨", "Belle soirée à toi !"],
            "night":     ["Qu'est-ce qui t'amène à cette heure ? 😄", "Je veille avec toi ! 🌙",
                          "Pas de sommeil ce soir ? Je suis là 😊"],
        },
        "en": {
            "morning":   ["How can I help you today? 😊", "Ready to have a great day? 💪"],
            "afternoon": ["What can I do for you? 😊", "How's everything going?"],
            "evening":   ["How was your day? 🌙", "I'm here if you need anything 😊"],
            "night":     ["Can't sleep? I'm here! 🌙", "What's keeping you up? 😄"],
        },
        "ar": {
            "morning":   ["كيف يمكنني مساعدتك اليوم؟ 😊"],
            "evening":   ["كيف كان يومك؟ 🌙"],
        },
    }
    lang_fillers = fillers.get(lang, fillers["fr"])
    period_fillers = lang_fillers.get(period, lang_fillers.get("afternoon", ["Je suis là ! 😊"]))
    return random.choice(period_fillers)


def _humanize(text: str, lang: str, emotion: str) -> str:
    """Add subtle human touches to an AI-generated response."""
    # Random chance to add small human expressions at the start (10% chance)
    starters_fr = ["Ah, ", "Hmm, ", "Alors, ", "Ok, ", "Bien sûr ! "]
    starters_en = ["Ah, ", "Hmm, ", "Sure, ", "Alright, ", "Of course! "]

    # Small chance (15%) to add a spontaneous emoji not already in text
    extra_emojis = ["😊", "👍", "💪", "🌟", "✨", "🔥", "🙌", "😄"]
    if random.random() < 0.15 and not any(e in text for e in extra_emojis[:3]):
        text = text.rstrip() + " " + random.choice(extra_emojis)

    return text.strip()


async def _call_ai(messages: list[dict], lang: str) -> str:
    """Call AI API to generate the humanoid response."""
    # Try OpenAI first
    if OPENAI_API_KEY:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                max_tokens=350,
                temperature=0.85,  # More creative/human-like
                presence_penalty=0.6,   # Avoid repetition
                frequency_penalty=0.4,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            logger.warning("OpenAI humanoid response failed: %s", e)

    # Fallback to Gemini
    if GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_API_KEY)
            sys_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
            user_msgs = [m for m in messages if m["role"] != "system"]
            full_prompt = sys_msg + "\n\n" + "\n".join(
                f"{'User' if m['role']=='user' else 'Assistant'}: {m['content']}"
                for m in user_msgs[-5:]
            )
            resp = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=full_prompt,
            )
            return (resp.text or "").strip()
        except Exception as e:
            logger.warning("Gemini humanoid response failed: %s", e)

    # Last resort: rule-based fallback
    return _fallback_response(lang)


def _fallback_response(lang: str) -> str:
    """Rule-based fallback when AI is unavailable."""
    fallbacks = {
        "fr": [
            "Je suis là, dis-moi ce que je peux faire pour toi 😊",
            "Bien sûr, je t'écoute ! 🙌",
            "Absolument ! Qu'est-ce qu'il y a ?",
            "Je suis tout ouïe, continue ! 😄",
            "Pas de souci, dis-moi tout 💪",
        ],
        "en": [
            "I'm here for you! What can I do? 😊",
            "Of course! Tell me more 🙌",
            "Absolutely! What's going on?",
            "I'm all ears! 😄",
        ],
        "ar": [
            "أنا هنا من أجلك! 😊",
            "بالطبع! أخبرني المزيد 🙌",
            "لا مشكلة، قل لي كل شيء 💪",
        ],
    }
    return random.choice(fallbacks.get(lang, fallbacks["fr"]))


# ── Typing Simulation ─────────────────────────────────────────────────────────

def human_typing_delay(text: str) -> float:
    """
    Simulate realistic human typing speed.
    Average human types ~200 chars/min = 3.3 chars/sec.
    Add variation: sometimes fast, sometimes slow.
    Returns delay in seconds (capped at 8s, min 1.5s).
    """
    base_delay = len(text) / 3.3   # seconds at avg speed
    # Add random human variation (±50%)
    variation  = random.uniform(0.5, 1.5)
    delay      = base_delay * variation
    return max(1.5, min(8.0, delay))


# ── User Profile Cache ────────────────────────────────────────────────────────

async def get_or_create_user_profile(pool, user_id: int, first_name: str,
                                      last_name: str = "", username: str = "") -> dict:
    """Store and retrieve user profile for personalization."""
    key = f"user_profile_{user_id}"
    if pool:
        try:
            row = await pool.fetchrow(
                "SELECT value FROM app_settings WHERE key = $1", key
            )
            if row and row["value"]:
                profile = json.loads(row["value"])
                # Update name if changed
                if first_name and profile.get("first_name") != first_name:
                    profile["first_name"] = first_name
                    await pool.execute(
                        "UPDATE app_settings SET value=$1 WHERE key=$2",
                        json.dumps(profile), key
                    )
                return profile
        except Exception:
            pass

    # Create new profile
    profile = {
        "user_id":    user_id,
        "first_name": first_name,
        "last_name":  last_name,
        "username":   username,
        "lang":       "fr",
        "interactions": 0,
        "first_seen":   datetime.now(timezone.utc).isoformat(),
    }
    if pool:
        try:
            await pool.execute(
                """INSERT INTO app_settings (key, value, description)
                   VALUES ($1, $2, 'user profile')
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
                key, json.dumps(profile, default=str)
            )
        except Exception:
            pass
    return profile
