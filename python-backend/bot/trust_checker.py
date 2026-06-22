"""
Trust & Fact-Checking Engine — Nexus AI
========================================
Analyse chaque contenu généré et lui attribue :
  - Un score de fiabilité (0–100)
  - Un type : fact | opinion | mixed | unverifiable | stats | trending
  - Un label prêt à afficher : ✅ Vérifié | 💡 Opinion | ⚠️ Non vérifiable | etc.
  - Les allégations détectées et vérifiées/réfutées

Chaîne de vérification :
  1. Détection rapide par règles (keywords, patterns)
  2. Analyse IA (GPT-4o-mini ou Gemini)
  3. Score final composite
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
from dataclasses import dataclass, field
from typing import Literal, Optional

logger = logging.getLogger(__name__)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY  = os.getenv("GEMINI_API_KEY", "")

# ── Types ─────────────────────────────────────────────────────────────────────

ContentType = Literal["fact", "opinion", "mixed", "unverifiable", "stats", "trending", "promotional"]

LABEL_MAP: dict[ContentType, str] = {
    "fact":          "✅ Vérifié",
    "opinion":       "💡 Opinion",
    "mixed":         "🔄 Mixte",
    "unverifiable":  "⚠️ Non vérifiable",
    "stats":         "📊 Données",
    "trending":      "🔥 Tendance",
    "promotional":   "📣 Promotionnel",
}

LABEL_MAP_EN: dict[ContentType, str] = {
    "fact":          "✅ Verified",
    "opinion":       "💡 Opinion",
    "mixed":         "🔄 Mixed",
    "unverifiable":  "⚠️ Unverifiable",
    "stats":         "📊 Data",
    "trending":      "🔥 Trending",
    "promotional":   "📣 Promotional",
}

LABEL_MAP_AR: dict[ContentType, str] = {
    "fact":          "✅ موثّق",
    "opinion":       "💡 رأي",
    "mixed":         "🔄 مختلط",
    "unverifiable":  "⚠️ غير قابل للتحقق",
    "stats":         "📊 بيانات",
    "trending":      "🔥 رائج",
    "promotional":   "📣 ترويجي",
}


@dataclass
class TrustResult:
    """Complete trust analysis result for a piece of content."""
    score: int                          # 0–100 (100 = fully trustworthy)
    content_type: ContentType           # Classification
    label: str                          # Display label with emoji
    confidence: int                     # How confident the analyzer is (0–100)
    claims: list[str] = field(default_factory=list)     # Detected factual claims
    warnings: list[str] = field(default_factory=list)   # Red flags found
    reasoning: str = ""                 # Brief explanation
    language: str = "fr"
    
    @property
    def badge(self) -> str:
        """Short badge line for appending to content."""
        bar_filled = "█" * (self.score // 10)
        bar_empty  = "░" * (10 - self.score // 10)
        return f"\n\n{self.label} | Fiabilité: {bar_filled}{bar_empty} {self.score}/100"

    @property
    def compact_badge(self) -> str:
        """One-liner badge."""
        return f"{self.label} ({self.score}/100)"

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "content_type": self.content_type,
            "label": self.label,
            "confidence": self.confidence,
            "claims": self.claims,
            "warnings": self.warnings,
            "reasoning": self.reasoning,
            "language": self.language,
        }


# ── Rule-Based Detection ──────────────────────────────────────────────────────

# Keywords that signal opinion (lower factual weight)
OPINION_SIGNALS = [
    "je pense", "à mon avis", "selon moi", "il me semble", "je crois",
    "probablement", "peut-être", "il est possible", "il se pourrait",
    "i think", "in my opinion", "i believe", "probably", "maybe", "seems like",
    "أعتقد", "في رأيي", "ربما", "يبدو",
    "personnellement", "pour moi", "de mon côté",
]

# Keywords that signal facts/data
FACT_SIGNALS = [
    r"\d+[\.,]\d+\s*%",        # percentages
    r"\d+\s*(millions?|milliards?|billions?)",  # big numbers
    r"selon\s+(une\s+étude|les\s+données|le\s+rapport)",
    r"according\s+to",
    r"study\s+shows",
    r"researchers\s+(found|discovered)",
    r"data\s+shows",
    r"\$\s*[\d,]+",             # dollar amounts
    r"€\s*[\d,]+",              # euro amounts
    r"(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+20\d\d",
]

# Keywords that signal promotional/marketing content
PROMO_SIGNALS = [
    "rejoins", "inscris-toi", "clique ici", "lien en bio", "offre limitée",
    "join now", "sign up", "click here", "limited offer", "don't miss",
    "🔗", "👇", "⬇️", "inscription", "gratuit", "free", "discount",
    "promo", "deal", "🎁", "💰💰", "🤑",
]

# Red-flag patterns (misinformation signals)
RED_FLAGS = [
    r"100\s*%\s*(garanti|sûr|certain|sure|guaranteed)",
    r"(tout le monde|everyone|everybody)\s+(sait|knows|said)",
    r"les\s+médias\s+cachent",
    r"media\s+(hide|hidden|won't tell)",
    r"secret\s+(révélé|revealed|exposed)",
    r"(banques?|gouvernement|government)\s+(cache|cachent|hiding)",
    r"miracle",
    r"x\d+\s*(profit|gain|retour|return)",    # unrealistic returns
]


def _rule_based_precheck(text: str) -> dict:
    """
    Quick rule-based analysis. Returns partial signals for the AI to complete.
    """
    text_lower = text.lower()
    
    opinion_count  = sum(1 for kw in OPINION_SIGNALS if kw in text_lower)
    fact_count     = sum(1 for pat in FACT_SIGNALS if re.search(pat, text_lower))
    promo_count    = sum(1 for kw in PROMO_SIGNALS if kw in text_lower)
    red_flag_count = sum(1 for pat in RED_FLAGS if re.search(pat, text_lower))
    
    # Detect numeric claims
    number_matches = re.findall(r"\d+[\.,]?\d*\s*(%|€|\$|BTC|ETH)", text)
    
    # Detect absolute/sensationalist language
    absolutes = len(re.findall(
        r"\b(jamais|toujours|absolument|obligatoirement|never|always|absolutely|definitely)\b",
        text_lower
    ))
    
    return {
        "opinion_signals": opinion_count,
        "fact_signals": fact_count,
        "promo_signals": promo_count,
        "red_flags": red_flag_count,
        "numeric_claims": number_matches,
        "absolute_language": absolutes,
    }


def _detect_language(text: str) -> str:
    ar = sum(1 for c in text if "\u0600" <= c <= "\u06ff")
    if ar > 5: return "ar"
    en_words = {"the", "is", "are", "you", "how", "what", "why", "when", "i", "we", "they"}
    if len(set(text.lower().split()) & en_words) >= 2: return "en"
    return "fr"


# ── AI Analysis ───────────────────────────────────────────────────────────────

TRUST_SYSTEM_PROMPT = """Tu es un expert en fact-checking et analyse de contenu.
Analyse le texte fourni et retourne UNIQUEMENT un objet JSON valide avec exactement ces champs :
{
  "content_type": "fact" | "opinion" | "mixed" | "unverifiable" | "stats" | "trending" | "promotional",
  "score": <entier 0-100 représentant la fiabilité factuelle>,
  "confidence": <entier 0-100 représentant ta confiance dans cette évaluation>,
  "claims": [<liste des affirmations factuelles détectées, max 3>],
  "warnings": [<liste des signaux d'alerte (exagérations, claims non vérifiables), max 3>],
  "reasoning": "<explication courte en 1 phrase>"
}

Grille de scoring :
- 90-100 : Faits vérifiables, sources citées, aucune exagération
- 70-89 : Principalement factuel, quelques opinions mineures
- 50-69 : Mélange fait/opinion, certains claims non vérifiables
- 30-49 : Principalement opinion ou claims non vérifiables
- 10-29 : Contenu promotionnel ou très subjectif
- 0-9   : Red flags : informations trompeuses ou fausses probables

NE réponds QUE avec le JSON, aucun texte avant ou après."""


async def _ai_analysis(text: str, precheck: dict) -> Optional[dict]:
    """Run AI fact-checking analysis. Returns parsed JSON or None."""
    prompt = (
        f"Texte à analyser:\n---\n{text[:800]}\n---\n\n"
        f"Signaux pré-détectés:\n"
        f"- Signaux opinion: {precheck['opinion_signals']}\n"
        f"- Signaux factuels: {precheck['fact_signals']}\n"
        f"- Signaux promotionnels: {precheck['promo_signals']}\n"
        f"- Red flags: {precheck['red_flags']}\n"
        f"- Claims numériques: {precheck['numeric_claims']}\n"
    )

    # Try OpenAI
    if OPENAI_API_KEY:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": TRUST_SYSTEM_PROMPT},
                    {"role": "user",   "content": prompt},
                ],
                max_tokens=400,
                temperature=0.1,   # Low temp for consistency
                response_format={"type": "json_object"},
            )
            raw = resp.choices[0].message.content or "{}"
            return json.loads(raw)
        except Exception as e:
            logger.warning("OpenAI trust analysis failed: %s", e)

    # Fallback: Gemini
    if GEMINI_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            full = TRUST_SYSTEM_PROMPT + "\n\n" + prompt
            resp = await model.generate_content_async(full)
            raw = resp.text or "{}"
            raw = raw.strip().strip("```json").strip("```").strip()
            return json.loads(raw)
        except Exception as e:
            logger.warning("Gemini trust analysis failed: %s", e)

    return None


# ── Rule-Based Scoring (fallback when no AI) ──────────────────────────────────

def _rule_based_score(text: str, precheck: dict) -> TrustResult:
    """
    Enhanced rule-based scoring — precise even without AI.
    Uses weighted multi-signal scoring for each content type.
    """
    lang = _detect_language(text)
    labels = LABEL_MAP if lang == "fr" else (LABEL_MAP_EN if lang == "en" else LABEL_MAP_AR)
    text_lower = text.lower()

    op  = precheck["opinion_signals"]
    fct = precheck["fact_signals"]
    prm = precheck["promo_signals"]
    rf  = precheck["red_flags"]
    abs_lang = precheck["absolute_language"]
    nums = precheck["numeric_claims"]

    # ── 1. Red flags — check first (highest priority) ──
    if rf >= 2 or (rf >= 1 and abs_lang >= 2):
        score = max(5, 25 - rf * 8 - abs_lang * 3)
        return TrustResult(
            score=score, content_type="unverifiable",
            label=labels["unverifiable"], confidence=75,
            warnings=["Langage absolu ou exagéré détecté", "Claims potentiellement trompeurs"],
            reasoning="Signaux d'alerte détectés — vérifier les claims avant de partager.",
            language=lang,
        )

    # ── 2. Promotional content ──
    if prm >= 3 or (prm >= 2 and fct == 0 and op == 0):
        score = max(15, 30 - prm * 3)
        return TrustResult(
            score=score, content_type="promotional",
            label=labels["promotional"], confidence=78,
            reasoning="Contenu principalement promotionnel ou marketing.",
            language=lang,
        )

    # ── 3. Strong opinion signals — dedicated opinion keywords ──
    strong_opinion_patterns = [
        r"\bje\s+pense\b", r"\bà\s+mon\s+avis\b", r"\bselon\s+moi\b",
        r"\bpersonnellement\b", r"\bi\s+think\b", r"\bin\s+my\s+opinion\b",
        r"\bأعتقد\b", r"\bفي\s+رأيي\b",
        r"\bje\s+crois\b", r"\bje\s+trouve\b", r"\bil\s+me\s+semble\b",
    ]
    strong_op = sum(1 for p in strong_opinion_patterns if re.search(p, text_lower))

    if strong_op >= 1 and fct == 0 and prm == 0:
        score = max(30, 50 - strong_op * 5 + op * 2)
        return TrustResult(
            score=score, content_type="opinion",
            label=labels["opinion"], confidence=80,
            reasoning="Contenu subjectif — point de vue personnel exprimé.",
            language=lang,
        )

    # ── 4. Motivational / inspirational (often opinion-adjacent) ──
    motivational_patterns = [
        r"\bchaque\s+(grand\s+)?voyage\b", r"\bsuccès\b.*\bappartient\b",
        r"\bcontinuez\b", r"\bpersist\b", r"\bbelieve\s+in\b",
        r"\bvous\s+êtes\s+capables\b", r"\byou\s+can\b.*\bdo\s+it\b",
        r"\bnever\s+give\s+up\b", r"\bchaque\s+jour\b.*\bopportunité\b",
    ]
    motivational = sum(1 for p in motivational_patterns if re.search(p, text_lower))
    if motivational >= 1 and fct == 0:
        return TrustResult(
            score=48, content_type="opinion",
            label=labels["opinion"], confidence=72,
            reasoning="Contenu inspirationnel ou motivationnel — subjectif par nature.",
            language=lang,
        )

    # ── 5. Factual with numbers and sources ──
    source_patterns = [
        r"\bselon\b", r"\bd'après\b", r"\baccording\s+to\b",
        r"\bstudy\b", r"\brapport\b", r"\bétude\b", r"\bdata\b",
        r"\bstatistic\b", r"\bsurvey\b", r"\bresearch\b",
        r"\بحسب\b", r"\bوفقًا\s+لـ\b",
    ]
    source_count = sum(1 for p in source_patterns if re.search(p, text_lower))

    if (fct >= 2 or source_count >= 1) and op == 0 and rf == 0:
        score = min(85, 65 + fct * 5 + source_count * 8 + len(nums) * 3)
        return TrustResult(
            score=min(85, score), content_type="fact",
            label=labels["fact"], confidence=68,
            claims=[m[0] if isinstance(m, tuple) else str(m) for m in nums[:3]],
            reasoning="Contenu factuel avec données numériques ou sources citées.",
            language=lang,
        )

    if fct >= 3 and op == 0:
        return TrustResult(
            score=75, content_type="fact",
            label=labels["fact"], confidence=62,
            reasoning="Contenu principalement factuel.",
            language=lang,
        )

    # ── 6. Mixed content ──
    if fct > 0 and (op > 0 or strong_op > 0):
        score = min(72, 50 + fct * 6 - op * 4 + source_count * 5)
        return TrustResult(
            score=max(35, score), content_type="mixed",
            label=labels["mixed"], confidence=60,
            reasoning="Mélange d'éléments factuels et d'opinions personnelles.",
            language=lang,
        )

    # ── 7. Trending / social content (emojis, hashtags, viral language) ──
    trending_signals = len(re.findall(r"[🔥🚀💥⚡🌟🎯💎🏆]|#\w+|\bviral\b|\btrending\b", text))
    if trending_signals >= 3:
        return TrustResult(
            score=52, content_type="trending",
            label=labels["trending"], confidence=65,
            reasoning="Contenu à fort potentiel viral — fiabilité modérée.",
            language=lang,
        )

    # ── 8. Generic fallback — neutral content ──
    base = 55 + fct * 4 - op * 2 - prm * 3
    return TrustResult(
        score=max(20, min(70, base)), content_type="mixed",
        label=labels["mixed"], confidence=45,
        reasoning="Contenu neutre — classification automatique.",
        language=lang,
    )


# ── Main Public Function ──────────────────────────────────────────────────────

async def check_content(text: str, language: str = "auto") -> TrustResult:
    """
    Main entry point: analyse text and return a complete TrustResult.
    
    Args:
        text: The content to analyze
        language: 'fr' | 'en' | 'ar' | 'auto' (auto-detects)
    
    Returns:
        TrustResult with score, type, label, claims, warnings, badge
    """
    if not text or len(text.strip()) < 10:
        return TrustResult(score=50, content_type="unverifiable",
                           label="⚠️ Trop court", confidence=100,
                           reasoning="Contenu trop court pour être analysé.")

    lang = _detect_language(text) if language == "auto" else language
    labels = LABEL_MAP if lang == "fr" else (LABEL_MAP_EN if lang == "en" else LABEL_MAP_AR)

    # Step 1: Rule-based precheck (fast, always runs)
    precheck = _rule_based_precheck(text)

    # Step 2: AI analysis
    ai_result = None
    try:
        ai_result = await asyncio.wait_for(_ai_analysis(text, precheck), timeout=8.0)
    except asyncio.TimeoutError:
        logger.warning("Trust AI analysis timed out — using rule-based fallback")
    except Exception as e:
        logger.warning("Trust AI error: %s", e)

    if ai_result:
        ct: ContentType = ai_result.get("content_type", "mixed")
        if ct not in LABEL_MAP:
            ct = "mixed"
        
        # Composite score: blend AI score with rule-based signals
        ai_score  = int(ai_result.get("score", 60))
        rb_adjust = 0
        if precheck["red_flags"] >= 2: rb_adjust -= 15
        if precheck["promo_signals"] >= 3: rb_adjust -= 10
        if precheck["fact_signals"] >= 3: rb_adjust += 5
        final_score = max(0, min(100, ai_score + rb_adjust))
        
        return TrustResult(
            score=final_score,
            content_type=ct,
            label=labels.get(ct, labels["mixed"]),
            confidence=int(ai_result.get("confidence", 70)),
            claims=ai_result.get("claims", [])[:3],
            warnings=ai_result.get("warnings", [])[:3],
            reasoning=ai_result.get("reasoning", ""),
            language=lang,
        )

    # Fallback: pure rule-based
    rb = _rule_based_score(text, precheck)
    rb.label = labels.get(rb.content_type, rb.label)
    rb.language = lang
    return rb


async def check_and_label(text: str, append_badge: bool = True,
                           language: str = "auto") -> tuple[str, TrustResult]:
    """
    Convenience wrapper: returns (labeled_text, trust_result).
    If append_badge=True, appends the compact badge to the text.
    """
    result = await check_content(text, language)
    labeled = text
    if append_badge:
        labeled = text.rstrip() + result.badge
    return labeled, result


# ── Batch Processing ──────────────────────────────────────────────────────────

async def check_batch(texts: list[str]) -> list[TrustResult]:
    """Analyze multiple texts concurrently (max 5 at a time)."""
    sem = asyncio.Semaphore(5)

    async def _one(t):
        async with sem:
            return await check_content(t)

    return list(await asyncio.gather(*[_one(t) for t in texts]))


# ── Formatting Helpers ────────────────────────────────────────────────────────

def format_trust_report(result: TrustResult) -> str:
    """Format a human-readable trust report for Telegram (Markdown)."""
    score_bar = "█" * (result.score // 10) + "░" * (10 - result.score // 10)
    
    lines = [
        f"🔍 *Analyse Trust & Fact-Check*",
        f"",
        f"{result.label} | Score: `{result.score}/100`",
        f"`{score_bar}`",
        f"Confiance: `{result.confidence}%`",
    ]

    if result.reasoning:
        lines.append(f"📝 {result.reasoning}")

    if result.claims:
        lines.append(f"\n📌 *Claims détectés:*")
        for c in result.claims:
            lines.append(f"  • {c}")

    if result.warnings:
        lines.append(f"\n⚠️ *Alertes:*")
        for w in result.warnings:
            lines.append(f"  • {w}")

    return "\n".join(lines)


def score_color(score: int) -> str:
    """Return a color indicator based on score."""
    if score >= 75: return "🟢"
    if score >= 50: return "🟡"
    if score >= 25: return "🟠"
    return "🔴"
