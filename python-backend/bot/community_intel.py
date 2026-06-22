"""
Community Intelligence System
Discovers, profiles, and continuously learns from every Telegram group/channel.
Stores mission profiles, admin configs, and engagement data in app_settings.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass, field, asdict
from typing import Any, Optional

logger = logging.getLogger(__name__)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")

# ── 22 Community Types ─────────────────────────────────────────────────────────

COMMUNITY_TYPES = {
    "crypto":          "Cryptocurrency & Blockchain",
    "finance":         "Finance & Economics",
    "business":        "Business & Entrepreneurship",
    "marketing":       "Marketing & Growth",
    "politics":        "Politics & International Affairs",
    "technology":      "Technology & Software",
    "ai":              "Artificial Intelligence",
    "education":       "Education & Learning",
    "health":          "Health & Wellness",
    "sports":          "Sports & Fitness",
    "entertainment":   "Entertainment & Media",
    "religion":        "Religion & Spirituality",
    "realestate":      "Real Estate & Property",
    "ecommerce":       "E-commerce & Retail",
    "investment":      "Investment & Trading",
    "startups":        "Startups & Innovation",
    "gaming":          "Gaming & Esports",
    "science":         "Science & Research",
    "news":            "News & Current Affairs",
    "lifestyle":       "Lifestyle & Culture",
    "motivational":    "Motivation & Personal Development",
    "community":       "General Community",
}

# Keywords that map to community types
TYPE_KEYWORDS: dict[str, list[str]] = {
    "crypto":       ["crypto","bitcoin","btc","eth","ethereum","nft","defi","blockchain","token","altcoin","hodl","satoshi","binance","coinbase","web3","solana","matic","usdt"],
    "finance":      ["finance","économie","economics","forex","stock","bourse","cac40","dow jones","inflation","taux","banque","monnaie","dette"],
    "business":     ["business","entreprise","entrepreneuriat","entrepreneur","startup","pme","management","leadership","b2b","franchise","business plan"],
    "marketing":    ["marketing","growth","seo","social media","branding","publicité","advertising","contenu","content","influence","copywriting"],
    "politics":     ["politique","politique","election","gouvernement","parlement","président","democracia","géopolitique","international","diplomatie"],
    "technology":   ["tech","technology","développement","programmation","code","software","hardware","saas","cloud","cybersecurity","devops","api"],
    "ai":           ["intelligence artificielle","artificial intelligence","chatgpt","openai","llm","machine learning","deep learning","gpt","gemini","claude"],
    "education":    ["éducation","school","université","cours","formation","apprentissage","study","learning","tutoriel","certification","diplôme"],
    "health":       ["santé","health","fitness","médecine","sport","nutrition","bien-être","wellness","médecin","exercice","régime","mental health"],
    "sports":       ["sport","football","soccer","basket","basketball","tennis","rugby","cyclisme","natation","mma","boxe","ligue","championnat"],
    "entertainment":["entertainment","musique","music","film","cinema","série","streaming","netflix","youtube","podcast","art","culture"],
    "religion":     ["religion","islam","christianisme","bible","coran","allah","dieu","prière","faith","spiritualité","église","mosquée"],
    "realestate":   ["immobilier","real estate","appartement","maison","investissement immobilier","loyer","achat","promotion","agence","logement"],
    "ecommerce":    ["ecommerce","e-commerce","boutique","shopify","amazon","dropshipping","vente","produit","marketplace","achat en ligne"],
    "investment":   ["investissement","invest","bourse","trading","portefeuille","rendement","dividende","etf","action","obligation"],
    "startups":     ["startup","innovation","levée de fonds","vc","venture capital","incubateur","founder","scale","disruption","mvp"],
    "gaming":       ["gaming","jeux","games","esport","fortnite","lol","valorant","steam","twitch","playstation","xbox","nintendo"],
    "science":      ["science","recherche","physique","chimie","biologie","astronomie","découverte","laboratoire","étude","publication"],
    "news":         ["news","actualité","journal","breaking","info","presse","médias","reportage","investigation","dernière heure"],
    "lifestyle":    ["lifestyle","mode","fashion","voyage","travel","food","cuisine","design","beauté","beauty","photography"],
    "motivational": ["motivation","success","succès","mindset","développement personnel","coaching","vision","objectif","productivity"],
    "community":    ["communauté","community","groupe","network","forum","discussion","général","entraide","partage"],
}


# ── Data Structures ───────────────────────────────────────────────────────────

@dataclass
class CommunityProfile:
    tg_id: str
    title: str
    chat_type: str                       # "group" | "channel"
    community_type: str = "community"    # from COMMUNITY_TYPES keys
    community_type_label: str = "Community"
    language: str = "fr"                 # primary language
    languages: list[str] = field(default_factory=list)
    mission: str = ""                    # AI-generated mission statement
    objectives: list[str] = field(default_factory=list)
    audience_type: str = "general"       # "general" | "expert" | "beginner" | "mixed"
    tone: str = "casual"                 # communication tone
    content_strategy: list[str] = field(default_factory=list)
    posting_frequency: str = "daily"     # "hourly" | "daily" | "weekly"
    forbidden_topics: list[str] = field(default_factory=list)
    admin_instructions: str = ""
    about: str = ""
    pinned_summary: str = ""
    keywords: list[str] = field(default_factory=list)
    verified_sources: list[str] = field(default_factory=list)
    custom_config: dict = field(default_factory=dict)
    engagement_score: float = 0.0
    total_posts: int = 0

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "CommunityProfile":
        return cls(**d)


def default_profile(tg_id: str, title: str, chat_type: str) -> CommunityProfile:
    return CommunityProfile(
        tg_id=tg_id, title=title, chat_type=chat_type,
        community_type="community", community_type_label=COMMUNITY_TYPES["community"],
        language="fr", languages=["fr"],
        mission=f"Animer et informer la communauté {title}.",
        objectives=["Engager les membres", "Partager du contenu utile", "Créer de la valeur"],
        audience_type="general", tone="casual",
        content_strategy=["actualités", "questions", "contenus éducatifs"],
        posting_frequency="daily",
        forbidden_topics=[], admin_instructions="",
        about="", pinned_summary="", keywords=[],
        verified_sources=[], custom_config={},
        engagement_score=0.0, total_posts=0,
    )


# ── DB helpers ────────────────────────────────────────────────────────────────

def _profile_key(chat_type: str, tg_id: str) -> str:
    return f"community_profile_{chat_type}_{tg_id}"

def _config_key(chat_type: str, tg_id: str) -> str:
    return f"community_config_{chat_type}_{tg_id}"


async def save_profile(pool, profile: CommunityProfile) -> None:
    try:
        await pool.execute(
            """INSERT INTO app_settings (key, value, description)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
            _profile_key(profile.chat_type, profile.tg_id),
            json.dumps(profile.to_dict(), ensure_ascii=False, default=str),
            f"Community profile: {profile.title}",
        )
    except Exception as e:
        logger.warning("save_profile failed: %s", e)


async def load_profile(pool, chat_type: str, tg_id: str) -> Optional[CommunityProfile]:
    try:
        row = await pool.fetchrow(
            "SELECT value FROM app_settings WHERE key = $1",
            _profile_key(chat_type, tg_id),
        )
        if row and row["value"]:
            return CommunityProfile.from_dict(json.loads(row["value"]))
    except Exception as e:
        logger.warning("load_profile failed: %s", e)
    return None


async def save_admin_config(pool, chat_type: str, tg_id: str, config: dict) -> None:
    try:
        # Merge with existing
        existing = await load_admin_config(pool, chat_type, tg_id)
        existing.update(config)
        await pool.execute(
            """INSERT INTO app_settings (key, value, description)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
            _config_key(chat_type, tg_id),
            json.dumps(existing, ensure_ascii=False),
            f"Admin config for {chat_type} {tg_id}",
        )
    except Exception as e:
        logger.warning("save_admin_config failed: %s", e)


async def load_admin_config(pool, chat_type: str, tg_id: str) -> dict:
    try:
        row = await pool.fetchrow(
            "SELECT value FROM app_settings WHERE key = $1",
            _config_key(chat_type, tg_id),
        )
        if row and row["value"]:
            return json.loads(row["value"])
    except Exception:
        pass
    return {}


# ── Detection ─────────────────────────────────────────────────────────────────

def detect_community_type(title: str, about: str, keywords_found: list[str]) -> str:
    """Rule-based community type detection from text signals."""
    text = (title + " " + about + " " + " ".join(keywords_found)).lower()
    scores: dict[str, int] = {t: 0 for t in COMMUNITY_TYPES}
    for ctype, kws in TYPE_KEYWORDS.items():
        for kw in kws:
            if kw in text:
                scores[ctype] += 1
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "community"


def detect_language(text: str) -> tuple[str, list[str]]:
    """Simple language detection by character/word patterns."""
    langs = []
    ar_chars = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    if ar_chars > 10:
        langs.append("ar")
    fr_words = ["le","la","les","des","et","en","est","dans","que","qui","pour","avec","une","sur"]
    en_words = ["the","and","for","are","this","that","with","from","have","been"]
    es_words = ["los","las","del","para","con","que","una","por","como","más"]
    pt_words = ["para","com","uma","são","que","não","como","este","por","dos"]

    words = text.lower().split()
    fr_count = sum(1 for w in words if w in fr_words)
    en_count = sum(1 for w in words if w in en_words)
    es_count = sum(1 for w in words if w in es_words)
    pt_count = sum(1 for w in words if w in pt_words)

    scores = {"fr": fr_count, "en": en_count, "es": es_count, "pt": pt_count}
    if ar_chars > 10:
        scores["ar"] = ar_chars // 5

    primary = max(scores, key=lambda k: scores[k]) if any(scores.values()) else "fr"
    langs = [k for k, v in sorted(scores.items(), key=lambda x: -x[1]) if v > 0]
    if not langs:
        langs = ["fr"]
    return langs[0], langs[:3]


def extract_keywords(text: str) -> list[str]:
    """Extract meaningful keywords from text."""
    stopwords = {"le","la","les","des","et","en","est","dans","que","qui","pour","avec","une","sur",
                 "the","and","for","are","this","that","with","from","have","been","se","si","ou","de"}
    words = re.findall(r"\b[a-zA-ZÀ-ÿ]{4,}\b", text.lower())
    kws = [w for w in words if w not in stopwords]
    # Count frequency
    freq: dict[str, int] = {}
    for w in kws:
        freq[w] = freq.get(w, 0) + 1
    return sorted(freq, key=lambda k: -freq[k])[:20]


# ── AI Mission Generation ─────────────────────────────────────────────────────

MISSION_TEMPLATES = {
    "crypto":      "Éduquer les membres sur les cryptomonnaies, partager les actualités du marché, encourager l'investissement responsable et expliquer les développements blockchain.",
    "finance":     "Partager des analyses financières, éduquer sur la gestion d'actifs, suivre les marchés et aider les membres à prendre des décisions éclairées.",
    "business":    "Aider les entrepreneurs à développer leurs activités grâce à l'éducation, la motivation et des conseils pratiques.",
    "marketing":   "Partager les meilleures pratiques marketing, les nouvelles tendances digitales et aider les membres à booster leur visibilité.",
    "politics":    "Fournir des informations politiques équilibrées, analyser les politiques publiques et informer sans partialité.",
    "technology":  "Couvrir les innovations technologiques, partager des actualités tech et démystifier les nouvelles technologies.",
    "ai":          "Explorer les avancées en intelligence artificielle, partager des outils IA et éduquer sur l'impact de l'IA sur la société.",
    "education":   "Faciliter l'apprentissage, partager des ressources éducatives et encourager le développement des compétences.",
    "health":      "Promouvoir un mode de vie sain, partager des conseils médicaux vérifiés et soutenir le bien-être des membres.",
    "sports":      "Couvrir l'actualité sportive, analyser les performances et créer de l'enthousiasme autour du sport.",
    "entertainment":"Partager du divertissement de qualité, couvrir la culture pop et créer une ambiance positive.",
    "religion":    "Partager des messages spirituels inspirants, répondre aux questions religieuses avec respect et bienveillance.",
    "realestate":  "Informer sur le marché immobilier, partager des opportunités d'investissement et conseiller sur l'achat/vente.",
    "ecommerce":   "Aider les vendeurs et acheteurs en ligne, partager des stratégies e-commerce et découvrir les meilleures opportunités.",
    "investment":  "Analyser les marchés financiers, partager des stratégies d'investissement et éduquer sur la gestion de portefeuille.",
    "startups":    "Connecter les entrepreneurs, partager des ressources pour les startups et célébrer l'innovation.",
    "gaming":      "Couvrir l'actualité gaming, organiser des discussions sur les jeux et créer une communauté de joueurs passionnés.",
    "science":     "Vulgariser la science, partager les dernières découvertes et encourager la pensée critique.",
    "news":        "Fournir une information précise, rapide et équilibrée en évitant toute désinformation.",
    "lifestyle":   "Inspirer un mode de vie épanoui, partager du contenu lifestyle et créer une communauté positive.",
    "motivational":"Inspirer les membres à atteindre leurs objectifs, partager des outils de développement personnel et célébrer les succès.",
    "community":   "Animer la communauté, favoriser les échanges constructifs et créer un espace d'entraide.",
}

CONTENT_STRATEGIES = {
    "crypto":      ["price updates", "blockchain news", "educational threads", "market analysis", "DeFi highlights", "risk awareness"],
    "finance":     ["market recap", "economic indicators", "investment tips", "case studies", "financial literacy"],
    "business":    ["success stories", "productivity tips", "leadership lessons", "business tools", "networking"],
    "marketing":   ["growth hacks", "campaign examples", "social media tips", "SEO insights", "brand building"],
    "politics":    ["policy summaries", "election updates", "geopolitical analysis", "fact checks", "political education"],
    "technology":  ["product launches", "tech tutorials", "security alerts", "innovation news", "coding tips"],
    "ai":          ["AI tool reviews", "research papers simplified", "AI use cases", "ethics debates", "tutorials"],
    "education":   ["study tips", "course recommendations", "knowledge quizzes", "skill guides", "career advice"],
    "health":      ["nutrition facts", "exercise routines", "mental health tips", "medical news", "wellness habits"],
    "sports":      ["match results", "player analysis", "training tips", "sports trivia", "upcoming events"],
    "entertainment":["movie reviews", "music releases", "celebrity news", "cultural events", "trending content"],
    "religion":    ["daily prayers", "religious teachings", "inspirational stories", "Q&A sessions", "community events"],
    "realestate":  ["market reports", "investment opportunities", "renovation tips", "legal advice", "neighborhood spotlights"],
    "ecommerce":   ["product spotlight", "seller tips", "buyer guides", "discount alerts", "supplier reviews"],
    "investment":  ["portfolio strategies", "asset allocation", "risk management", "sector analysis", "economic forecasts"],
    "startups":    ["founder stories", "funding news", "product launches", "startup tools", "investor insights"],
    "gaming":      ["game reviews", "patch notes", "streaming highlights", "esports results", "gaming tips"],
    "science":     ["research breakthroughs", "science explained", "experiment ideas", "space updates", "scientific debates"],
    "news":        ["breaking news", "in-depth analysis", "fact checks", "regional coverage", "weekly digest"],
    "lifestyle":   ["travel guides", "recipe of the day", "fashion trends", "self-care rituals", "home decor"],
    "motivational":["daily motivation", "success stories", "book summaries", "habit hacks", "goal-setting guides"],
    "community":   ["community polls", "member spotlights", "open discussions", "weekly themes", "fun challenges"],
}


async def generate_mission_with_ai(
    title: str, about: str, community_type: str, language: str,
    pinned_summary: str = "", keywords: list[str] = []
) -> tuple[str, list[str]]:
    """Use AI to generate a custom mission + objectives for this specific community."""
    template_mission = MISSION_TEMPLATES.get(community_type, MISSION_TEMPLATES["community"])
    template_strategy = CONTENT_STRATEGIES.get(community_type, CONTENT_STRATEGIES["community"])

    if not OPENAI_API_KEY:
        return template_mission, template_strategy[:3]

    lang_map = {"fr": "French", "en": "English", "ar": "Arabic", "es": "Spanish", "pt": "Portuguese"}
    lang_name = lang_map.get(language, "French")

    try:
        import openai
        client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        resp = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{
                "role": "user",
                "content": (
                    f"You are building a mission profile for a Telegram community.\n\n"
                    f"Group title: {title}\n"
                    f"Description: {about or 'N/A'}\n"
                    f"Pinned message summary: {pinned_summary or 'N/A'}\n"
                    f"Community type: {COMMUNITY_TYPES.get(community_type, community_type)}\n"
                    f"Primary language: {lang_name}\n"
                    f"Key topics: {', '.join(keywords[:10])}\n\n"
                    "Generate a JSON response (no markdown) with:\n"
                    '{"mission": "2-3 sentence mission statement in ' + lang_name + '", '
                    '"objectives": ["obj1", "obj2", "obj3"], '
                    '"content_ideas": ["idea1", "idea2", "idea3", "idea4", "idea5"]}'
                )
            }],
            max_tokens=400,
            temperature=0.6,
        )
        text = (resp.choices[0].message.content or "").strip().strip("```json").strip("```").strip()
        data = json.loads(text)
        return data.get("mission", template_mission), data.get("objectives", []) + data.get("content_ideas", [])
    except Exception as e:
        logger.warning("AI mission generation failed: %s", e)
        return template_mission, template_strategy[:5]


# ── Full Discovery Pipeline ───────────────────────────────────────────────────

async def discover_community(
    client,   # Telethon client
    entity,   # Telethon entity
    pool,
    chat_type: str,
    account_id: int,
) -> CommunityProfile:
    """
    Full community discovery pipeline.
    Analyzes everything available and builds a CommunityProfile.
    """
    tg_id = str(entity.id)
    title = getattr(entity, "title", "") or getattr(entity, "username", "Unknown")
    about = getattr(entity, "about", "") or ""

    # Check for existing profile
    existing = await load_profile(pool, chat_type, tg_id)
    if existing:
        logger.info("[Intel] Loaded existing profile for '%s'", title)
        return existing

    # Step 1: Collect signals
    pinned_text = ""
    recent_msgs_text = ""
    try:
        # Fetch pinned message
        async for msg in client.iter_messages(entity, filter=None, limit=1, reverse=False):
            if getattr(msg, "pinned", False) or True:
                pinned_text = (getattr(msg, "message", "") or "")[:500]
                break
    except Exception:
        pass

    try:
        # Fetch last 20 messages for context
        msgs = []
        async for msg in client.iter_messages(entity, limit=20):
            txt = getattr(msg, "message", "") or ""
            if txt:
                msgs.append(txt[:200])
        recent_msgs_text = " ".join(msgs[:10])
    except Exception:
        pass

    # Step 2: Detect community type, language, keywords
    all_text = f"{title} {about} {pinned_text} {recent_msgs_text}"
    keywords = extract_keywords(all_text)
    community_type = detect_community_type(title, about, keywords)
    language, languages = detect_language(all_text)

    # Step 3: Load admin config overrides
    admin_config = await load_admin_config(pool, chat_type, tg_id)
    if admin_config.get("community_type"):
        community_type = admin_config["community_type"]
    if admin_config.get("language"):
        language = admin_config["language"]

    # Step 4: Generate AI mission
    mission, objectives_and_content = await generate_mission_with_ai(
        title=title, about=about,
        community_type=community_type,
        language=language,
        pinned_summary=pinned_text[:300],
        keywords=keywords,
    )

    objectives = [o for o in objectives_and_content if len(o) < 80][:3]
    content_strategy = CONTENT_STRATEGIES.get(community_type, CONTENT_STRATEGIES["community"])

    # Step 5: Determine verified sources for this community type
    sources = _get_verified_sources(community_type, language)

    # Step 6: Build profile
    profile = CommunityProfile(
        tg_id=tg_id,
        title=title,
        chat_type=chat_type,
        community_type=community_type,
        community_type_label=COMMUNITY_TYPES.get(community_type, "Community"),
        language=language,
        languages=languages,
        mission=mission,
        objectives=objectives,
        audience_type=admin_config.get("audience_type", "general"),
        tone=admin_config.get("tone", _default_tone(community_type)),
        content_strategy=content_strategy,
        posting_frequency=admin_config.get("posting_frequency", "daily"),
        forbidden_topics=admin_config.get("forbidden_topics", []),
        admin_instructions=admin_config.get("instructions", ""),
        about=about[:500],
        pinned_summary=pinned_text[:300],
        keywords=keywords[:15],
        verified_sources=sources,
        custom_config=admin_config,
        engagement_score=0.0,
        total_posts=0,
    )

    await save_profile(pool, profile)
    logger.info("[Intel] ✅ Profile built for '%s' → type=%s lang=%s", title, community_type, language)
    return profile


def _default_tone(community_type: str) -> str:
    tones = {
        "crypto": "crypto", "finance": "professional", "business": "professional",
        "politics": "news", "technology": "professional", "ai": "professional",
        "education": "professional", "health": "casual", "sports": "casual",
        "entertainment": "casual", "religion": "professional", "news": "news",
        "motivational": "motivational", "community": "casual",
    }
    return tones.get(community_type, "casual")


def _get_verified_sources(community_type: str, language: str) -> list[str]:
    sources = {
        "crypto":      ["CoinGecko", "CoinMarketCap", "CryptoCompare", "Decrypt", "The Block"],
        "finance":     ["Bloomberg", "Reuters", "Financial Times", "Les Échos", "Wall Street Journal"],
        "politics":    ["Reuters", "AFP", "BBC", "Le Monde", "Al Jazeera"],
        "technology":  ["TechCrunch", "The Verge", "Wired", "MIT Technology Review"],
        "ai":          ["OpenAI Blog", "DeepMind Blog", "Hugging Face", "ArXiv AI Papers"],
        "health":      ["WHO", "WebMD", "Mayo Clinic", "PubMed", "Santé Publique France"],
        "science":     ["Nature", "Science", "NASA", "National Geographic", "Scientific American"],
        "news":        ["Reuters", "AFP", "BBC", "Associated Press", "RFI"],
        "sports":      ["ESPN", "L'Équipe", "Eurosport", "BBC Sport", "Goal.com"],
        "investment":  ["Investopedia", "Morningstar", "Seeking Alpha", "MarketWatch"],
    }
    base = sources.get(community_type, ["Reuters", "AFP", "BBC"])
    if language == "fr":
        base += ["Le Monde", "Le Figaro", "RFI"]
    elif language == "ar":
        base += ["Al Jazeera Arabic", "BBC Arabic", "Al Arabiya"]
    return list(set(base))[:5]


# ── Community Learning ────────────────────────────────────────────────────────

async def update_engagement_score(pool, chat_type: str, tg_id: str, delta: float = 1.0) -> None:
    """Increment post count and engagement when a post is made."""
    profile = await load_profile(pool, chat_type, tg_id)
    if profile:
        profile.engagement_score = min(100.0, profile.engagement_score + delta)
        profile.total_posts += 1
        await save_profile(pool, profile)


async def learn_from_messages(pool, chat_type: str, tg_id: str, messages: list[str]) -> None:
    """Analyze recent messages to update community keywords and interests."""
    profile = await load_profile(pool, chat_type, tg_id)
    if not profile:
        return
    all_text = " ".join(messages)
    new_keywords = extract_keywords(all_text)
    # Merge with existing, keeping most relevant
    combined = list(dict.fromkeys(profile.keywords + new_keywords))[:20]
    profile.keywords = combined
    await save_profile(pool, profile)


# ── Formatting ────────────────────────────────────────────────────────────────

def format_profile_card(profile: CommunityProfile) -> str:
    type_emoji = {
        "crypto": "🪙", "finance": "💰", "business": "💼", "marketing": "📣",
        "politics": "🏛", "technology": "💻", "ai": "🤖", "education": "📚",
        "health": "❤️", "sports": "⚽", "entertainment": "🎬", "religion": "🕌",
        "realestate": "🏠", "ecommerce": "🛒", "investment": "📈",
        "startups": "🚀", "gaming": "🎮", "science": "🔬", "news": "📰",
        "lifestyle": "✨", "motivational": "💪", "community": "🤝",
    }.get(profile.community_type, "🌐")

    freq_emoji = {"hourly": "⏰", "daily": "📅", "weekly": "📆"}.get(profile.posting_frequency, "📅")

    lines = [
        f"{type_emoji} *{profile.title}*",
        f"🏷 Type: `{profile.community_type_label}`",
        f"🌍 Langue: `{profile.language}` ({', '.join(profile.languages)})",
        f"🎯 Audience: `{profile.audience_type}`",
        f"🎨 Ton: `{profile.tone}`",
        f"",
        f"📋 *Mission:*",
        f"_{profile.mission}_",
        f"",
        f"🎯 *Objectifs:*",
    ]
    for obj in profile.objectives[:3]:
        lines.append(f"  • {obj}")

    lines += [
        f"",
        f"💡 *Stratégie de contenu:*",
    ]
    for idea in profile.content_strategy[:4]:
        lines.append(f"  • {idea}")

    lines += [
        f"",
        f"{freq_emoji} Fréquence: `{profile.posting_frequency}`",
        f"📊 Posts: `{profile.total_posts}` | Score: `{profile.engagement_score:.0f}/100`",
    ]
    if profile.verified_sources:
        lines.append(f"✅ Sources: {', '.join(profile.verified_sources[:3])}")
    if profile.forbidden_topics:
        lines.append(f"🚫 Sujets exclus: {', '.join(profile.forbidden_topics)}")
    if profile.admin_instructions:
        lines.append(f"⚙️ Instructions: _{profile.admin_instructions[:100]}_")

    return "\n".join(lines)
