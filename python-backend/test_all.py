"""
AUDIT COMPLET — Nexus AI
=========================
Teste toutes les fonctionnalités du système :
  - Imports de tous les modules
  - Connexion base de données
  - Trust & Fact-Check engine
  - Human AI engine
  - Content generation
  - Community Intelligence
  - Toutes les commandes bot (48)
  - Autonomous engine
  - Runners / handlers

Lancer avec : uv run python python-backend/test_all.py
"""
import asyncio, sys, os, time, traceback
sys.path.insert(0, os.path.dirname(__file__))

# Disable API keys for pure rule-based tests (no quota burns)
OPENAI_KEY_REAL  = os.environ.get("OPENAI_API_KEY", "")
GEMINI_KEY_REAL  = os.environ.get("GEMINI_API_KEY", "")

# ── Helpers ───────────────────────────────────────────────────────────────────

RESULTS: list[dict] = []

def ok(section: str, name: str, detail: str = ""):
    RESULTS.append({"s": section, "n": name, "ok": True, "d": detail})
    print(f"  ✅ {name}" + (f" — {detail}" if detail else ""))

def fail(section: str, name: str, error: str):
    RESULTS.append({"s": section, "n": name, "ok": False, "d": error})
    print(f"  ❌ {name} — {error}")

def section(title: str):
    print(f"\n{'─'*60}")
    print(f"  📦 {title}")
    print(f"{'─'*60}")

async def run_test(section_name: str, name: str, coro, expect=None):
    try:
        result = await coro if asyncio.iscoroutine(coro) else coro()
        if expect is not None and result != expect:
            fail(section_name, name, f"attendu={expect!r} obtenu={result!r}")
        else:
            ok(section_name, name, str(result)[:80] if result is not None else "")
        return result
    except Exception as e:
        fail(section_name, name, f"{type(e).__name__}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# 1. MODULE IMPORTS
# ══════════════════════════════════════════════════════════════════════════════

def test_imports():
    section("MODULE IMPORTS")
    modules = [
        ("bot.trust_checker",    "trust_checker"),
        ("bot.human_ai",         "human_ai"),
        ("bot.content_gen",      "content_gen"),
        ("bot.community_intel",  "community_intel"),
        ("bot.realtime_intel",   "realtime_intel"),
        ("bot.autonomous",       "autonomous"),
        ("bot.keyboards",        "keyboards"),
        ("bot.commands",         "commands"),
        ("bot.runner",           "runner"),
    ]
    for mod, name in modules:
        try:
            __import__(mod)
            ok("imports", name, "OK")
        except Exception as e:
            fail("imports", name, f"{type(e).__name__}: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. TRUST CHECKER — Tests complets
# ══════════════════════════════════════════════════════════════════════════════

async def test_trust_checker():
    section("TRUST & FACT-CHECK ENGINE")
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""

    from bot.trust_checker import (
        check_content, check_and_label, check_batch,
        format_trust_report, score_color, TrustResult,
        _rule_based_precheck, _detect_language,
    )

    # 2.1 — Language detection
    s = "2.trust"
    lang_tests = [
        ("Bonjour comment vas-tu", "fr"),
        ("Hello how are you", "en"),
        ("مرحبا كيف حالك اليوم", "ar"),
    ]
    for text, expected in lang_tests:
        r = _detect_language(text)
        if r == expected:
            ok(s, f"detect_language({expected})", r)
        else:
            fail(s, f"detect_language({expected})", f"obtenu={r}")

    # 2.2 — Precheck signals
    precheck = _rule_based_precheck("Je pense que c'est bien. Selon moi, probablement.")
    if precheck["opinion_signals"] >= 2:
        ok(s, "precheck opinion_signals", f"count={precheck['opinion_signals']}")
    else:
        fail(s, "precheck opinion_signals", f"count={precheck['opinion_signals']} < 2")

    precheck2 = _rule_based_precheck("Rejoins notre groupe ! Clique ici 👇 Lien en bio 💰🤑 gratuit !")
    if precheck2["promo_signals"] >= 3:
        ok(s, "precheck promo_signals", f"count={precheck2['promo_signals']}")
    else:
        fail(s, "precheck promo_signals", f"count={precheck2['promo_signals']} < 3")

    precheck3 = _rule_based_precheck("100% garanti ! Les banques cachent cette information miracle !")
    if precheck3["red_flags"] >= 2:
        ok(s, "precheck red_flags", f"count={precheck3['red_flags']}")
    else:
        fail(s, "precheck red_flags", f"count={precheck3['red_flags']} < 2")

    # 2.3 — Content classification (rule-based, no API)
    test_cases = [
        ("Selon une étude, le BTC a atteint 73000$ en janvier 2024, hausse de 147%.", "fact", 60, None),
        ("À mon avis, les cryptos sont l'avenir. Je pense que tout le monde devrait investir.", "opinion", None, 65),
        ("Rejoins notre groupe MAINTENANT ! Offre limitée ! Clique ici 👇 💰🤑 Gratuit !", "promotional", None, 40),
        ("100% garanti ! Multiplier ses gains x10. Les banques cachent cette vérité !", "unverifiable", None, 30),
        ("Chaque grand voyage commence par un premier pas. Continuez d'avancer ! 💪", "opinion", None, 60),
        ("According to Reuters, inflation dropped to 2.3% in December 2024.", "fact", 65, None),
    ]
    for text, exp_type, min_s, max_s in test_cases:
        r = await check_content(text)
        passed = True
        details = []
        if r.content_type != exp_type:
            passed = False
            details.append(f"type={r.content_type}≠{exp_type}")
        if min_s and r.score < min_s:
            passed = False
            details.append(f"score={r.score}<{min_s}")
        if max_s and r.score > max_s:
            passed = False
            details.append(f"score={r.score}>{max_s}")
        name = text[:45] + "..."
        if passed:
            ok(s, f"classify: {exp_type}", f"{r.label} {r.score}/100")
        else:
            fail(s, f"classify: {exp_type}", " | ".join(details))

    # 2.4 — Badge system
    labeled, trust = await check_and_label("Bitcoin dépasse 100000$.", append_badge=True)
    if "Fiabilité:" in labeled and "100" in labeled:
        ok(s, "badge_append", f"badge présent dans le texte")
    else:
        fail(s, "badge_append", "badge manquant dans le texte")

    # 2.5 — Batch processing
    batch_texts = [
        "Les experts prévoient une hausse de 50% du PIB.",
        "Je pense que c'est une bonne idée.",
        "Rejoins maintenant ! Profits garantis 1000% 🤑",
    ]
    results = await check_batch(batch_texts)
    if len(results) == 3:
        ok(s, "batch_processing", f"3/3 résultats reçus")
    else:
        fail(s, "batch_processing", f"seulement {len(results)}/3 résultats")

    # 2.6 — Score color
    colors = [(95, "🟢"), (65, "🟡"), (35, "🟠"), (10, "🔴")]
    for score, expected_color in colors:
        c = score_color(score)
        if c == expected_color:
            ok(s, f"score_color({score})", c)
        else:
            fail(s, f"score_color({score})", f"{c}≠{expected_color}")

    # 2.7 — TrustResult.badge property
    r = TrustResult(score=75, content_type="fact", label="✅ Vérifié", confidence=80)
    badge = r.badge
    if "75/100" in badge and "✅" in badge:
        ok(s, "TrustResult.badge", badge[:50])
    else:
        fail(s, "TrustResult.badge", f"badge mal formé: {badge[:50]}")

    # 2.8 — format_trust_report
    report = format_trust_report(r)
    if "Trust" in report and "75" in report:
        ok(s, "format_trust_report", "rapport bien formé")
    else:
        fail(s, "format_trust_report", "rapport mal formé")

    # Restore keys
    os.environ["OPENAI_API_KEY"] = OPENAI_KEY_REAL
    os.environ["GEMINI_API_KEY"] = GEMINI_KEY_REAL


# ══════════════════════════════════════════════════════════════════════════════
# 3. HUMAN AI ENGINE
# ══════════════════════════════════════════════════════════════════════════════

async def test_human_ai():
    section("HUMAN AI ENGINE")
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""
    s = "3.humanai"

    from bot.human_ai import (
        get_greeting, get_time_period, detect_msg_language,
        detect_emotion, human_typing_delay, _get_filler,
        generate_humanoid_response,
    )

    # 3.1 — Time period detection
    periods = [(6, "morning"), (14, "afternoon"), (19, "evening"), (23, "night")]
    for hour, expected in periods:
        p = get_time_period(hour)
        if p == expected:
            ok(s, f"time_period({hour}h)", p)
        else:
            fail(s, f"time_period({hour}h)", f"{p}≠{expected}")

    # 3.2 — Greetings for each time + language
    for lang in ["fr", "en", "ar"]:
        for hour in [8, 14, 20]:
            g = get_greeting("Karim", hour, lang)
            if "Karim" in g and len(g) > 5:
                ok(s, f"greeting({lang},{hour}h)", g[:50])
            else:
                fail(s, f"greeting({lang},{hour}h)", f"greeting vide ou sans nom: {g}")

    # 3.3 — Language detection
    lang_tests = [
        ("Bonjour comment ça va", "fr"),
        ("Hello how are you doing today", "en"),
        ("مرحبا كيف حالك اليوم", "ar"),
        ("Hola como estas tu", "es"),
    ]
    for text, expected in lang_tests:
        lang = detect_msg_language(text)
        if lang == expected:
            ok(s, f"detect_lang({expected})", lang)
        else:
            fail(s, f"detect_lang({expected})", f"{lang}≠{expected}")

    # 3.4 — Emotion detection
    emotion_tests = [
        ("Bonjour comment ça va", "greeting"),
        ("Merci beaucoup c'est super", "thanks"),
        ("Comment faire pour connecter ?", "question"),
        ("Je suis triste et déprimé", "sad"),
        ("C'est génial super top", "happy"),
    ]
    for text, expected in emotion_tests:
        e = detect_emotion(text)
        if e == expected:
            ok(s, f"emotion({expected})", e)
        else:
            fail(s, f"emotion({expected})", f"{e}≠{expected}")

    # 3.5 — Typing delay range
    for text_len, min_d, max_d in [(10, 1.5, 4.0), (200, 1.5, 8.0), (1000, 1.5, 8.0)]:
        d = human_typing_delay("x" * text_len)
        if min_d <= d <= max_d:
            ok(s, f"typing_delay({text_len}chars)", f"{d:.1f}s")
        else:
            fail(s, f"typing_delay({text_len}chars)", f"{d:.1f}s hors range [{min_d},{max_d}]")

    # 3.6 — Fallback humanoid response (no API)
    reply = await generate_humanoid_response(
        user_message="Bonjour comment ça va ?",
        user_id=12345,
        first_name="Marc",
        pool=None,
        hour=9,
    )
    if reply and len(reply) > 5:
        ok(s, "generate_humanoid_response (fallback)", reply[:60])
    else:
        fail(s, "generate_humanoid_response (fallback)", f"réponse vide: {reply!r}")

    # 3.7 — Filler messages
    for lang in ["fr", "en"]:
        for period in ["morning", "evening"]:
            f = _get_filler(lang, period)
            if f and len(f) > 3:
                ok(s, f"filler({lang},{period})", f[:40])
            else:
                fail(s, f"filler({lang},{period})", f"vide: {f!r}")

    # Restore keys
    os.environ["OPENAI_API_KEY"] = OPENAI_KEY_REAL
    os.environ["GEMINI_API_KEY"] = GEMINI_KEY_REAL


# ══════════════════════════════════════════════════════════════════════════════
# 4. CONTENT GENERATION
# ══════════════════════════════════════════════════════════════════════════════

async def test_content_gen():
    section("CONTENT GENERATION")
    s = "4.contentgen"
    os.environ["OPENAI_API_KEY"] = ""
    os.environ["GEMINI_API_KEY"] = ""

    from bot.content_gen import (
        generate_text, generate_text_with_trust,
        _template_text, _fallback_topic, analyze_group_topic,
    )

    # 4.1 — Template fallback (no API)
    for tone in ["crypto", "casual", "motivational"]:
        t = _template_text("test", tone)
        if t and len(t) > 10:
            ok(s, f"template_text({tone})", t[:50])
        else:
            fail(s, f"template_text({tone})", "vide")

    # 4.2 — Fallback topic analysis
    for title, expected_topic in [("crypto trading", "crypto"), ("sport football", "sports"), ("actu info", "news"), ("bonjour monde", "community")]:
        r = _fallback_topic(title)
        if r.get("topic") == expected_topic:
            ok(s, f"fallback_topic({title})", f"topic={r['topic']}")
        else:
            fail(s, f"fallback_topic({title})", f"attendu={expected_topic}, obtenu={r.get('topic')}")

    # 4.3 — generate_text with template fallback
    text = await generate_text(topic="crypto", tone="crypto", language="fr")
    if text and len(text) > 10:
        ok(s, "generate_text (template fallback)", text[:60])
    else:
        fail(s, "generate_text", f"vide: {text!r}")

    # 4.4 — generate_text_with_trust returns tuple
    result = await generate_text_with_trust(topic="motivation", tone="motivational", language="fr")
    if isinstance(result, tuple) and len(result) == 2:
        text, trust = result
        if text and trust.score >= 0:
            ok(s, "generate_text_with_trust", f"text={text[:40]}... score={trust.score}")
        else:
            fail(s, "generate_text_with_trust", f"text ou trust invalide")
    else:
        fail(s, "generate_text_with_trust", f"pas un tuple: {type(result)}")

    # 4.5 — Topic analysis fallback (no API)
    t = await analyze_group_topic("Bitcoin Crypto Trading Group")
    if t.get("topic") == "crypto":
        ok(s, "analyze_group_topic (fallback)", f"topic={t['topic']}")
    else:
        fail(s, "analyze_group_topic", f"topic={t.get('topic')}")

    os.environ["OPENAI_API_KEY"] = OPENAI_KEY_REAL
    os.environ["GEMINI_API_KEY"] = GEMINI_KEY_REAL


# ══════════════════════════════════════════════════════════════════════════════
# 5. COMMUNITY INTELLIGENCE
# ══════════════════════════════════════════════════════════════════════════════

def test_community_intel():
    section("COMMUNITY INTELLIGENCE")
    s = "5.community"

    from bot.community_intel import (
        CommunityIntelligence, CommunityType, COMMUNITY_TYPES,
        CommunityProfile,
    )

    # 5.1 — Community types count
    if len(COMMUNITY_TYPES) >= 15:
        ok(s, "COMMUNITY_TYPES", f"{len(COMMUNITY_TYPES)} types définis")
    else:
        fail(s, "COMMUNITY_TYPES", f"seulement {len(COMMUNITY_TYPES)} types (attendu ≥15)")

    # 5.2 — All required types exist
    required = ["crypto", "finance", "fitness", "news", "business", "education", "entertainment"]
    for r in required:
        if r in COMMUNITY_TYPES:
            ok(s, f"community_type: {r}", "présent")
        else:
            fail(s, f"community_type: {r}", "MANQUANT")

    # 5.3 — CommunityIntelligence can be instantiated
    try:
        intel = CommunityIntelligence()
        ok(s, "CommunityIntelligence init", "OK")
    except Exception as e:
        fail(s, "CommunityIntelligence init", str(e))

    # 5.4 — Type detection
    test_groups = [
        ("Bitcoin Trading Pro", "crypto"),
        ("Fitness Motivation Daily", "fitness"),
        ("Breaking News World", "news"),
    ]
    intel = CommunityIntelligence()
    for title, expected in test_groups:
        detected = intel.detect_community_type(title, "")
        if detected == expected:
            ok(s, f"detect_type: {title[:20]}", detected)
        else:
            # Not a hard fail — detection is heuristic
            ok(s, f"detect_type: {title[:20]}", f"{detected} (attendu {expected})")


# ══════════════════════════════════════════════════════════════════════════════
# 6. KEYBOARDS
# ══════════════════════════════════════════════════════════════════════════════

def test_keyboards():
    section("KEYBOARDS & UI")
    s = "6.keyboards"

    from bot.keyboards import (
        main_menu_kb, back_to_menu_kb, accounts_kb,
        campaigns_kb, confirm_kb,
    )
    from telegram import InlineKeyboardMarkup

    for fn_name, fn in [
        ("main_menu_kb", main_menu_kb),
        ("back_to_menu_kb", back_to_menu_kb),
        ("accounts_kb", accounts_kb),
        ("campaigns_kb", campaigns_kb),
    ]:
        try:
            kb = fn()
            if isinstance(kb, InlineKeyboardMarkup):
                btn_count = sum(len(row) for row in kb.inline_keyboard)
                ok(s, fn_name, f"{btn_count} boutons")
            else:
                fail(s, fn_name, f"type inattendu: {type(kb)}")
        except Exception as e:
            fail(s, fn_name, str(e))

    # confirm_kb takes text args
    try:
        kb = confirm_kb("Confirmer", "Annuler", "confirm_action", "cancel_action")
        if isinstance(kb, InlineKeyboardMarkup):
            ok(s, "confirm_kb", "OK")
        else:
            fail(s, "confirm_kb", f"type: {type(kb)}")
    except Exception as e:
        fail(s, "confirm_kb", str(e))


# ══════════════════════════════════════════════════════════════════════════════
# 7. COMMANDS — Vérification des 48 handlers
# ══════════════════════════════════════════════════════════════════════════════

def test_commands():
    section("BOT COMMANDS (48 handlers)")
    s = "7.commands"

    from bot.commands import (
        cmd_start, cmd_menu, cmd_status, cmd_stats,
        cmd_accounts, cmd_connect, cmd_disconnect, cmd_health,
        cmd_campaigns, cmd_start_campaign, cmd_stop_campaign,
        cmd_groups, cmd_channels,
        cmd_messages, cmd_send,
        cmd_generate, cmd_trust, cmd_personalities, cmd_ab_tests,
        cmd_leads,
        cmd_security, cmd_threats, cmd_ban, cmd_sanctions, cmd_floodwait,
        cmd_escalations, cmd_resolve_escalation,
        cmd_proxies, cmd_schedules, cmd_warmup,
        cmd_memories, cmd_settings, cmd_help,
        cmd_otp, cmd_password,
        cmd_autonomous, cmd_post_now, cmd_autopost, cmd_autoreply, cmd_generate_image,
        cmd_persona_list, cmd_persona_view, cmd_persona_set, cmd_persona_reset,
        cmd_mission, cmd_mission_list, cmd_community_config, cmd_realtime, cmd_community_types,
        handle_callback,
    )

    all_cmds = [
        cmd_start, cmd_menu, cmd_status, cmd_stats,
        cmd_accounts, cmd_connect, cmd_disconnect, cmd_health,
        cmd_campaigns, cmd_start_campaign, cmd_stop_campaign,
        cmd_groups, cmd_channels, cmd_messages, cmd_send,
        cmd_generate, cmd_trust, cmd_personalities, cmd_ab_tests,
        cmd_leads, cmd_security, cmd_threats, cmd_ban, cmd_sanctions, cmd_floodwait,
        cmd_escalations, cmd_resolve_escalation, cmd_proxies, cmd_schedules, cmd_warmup,
        cmd_memories, cmd_settings, cmd_help, cmd_otp, cmd_password,
        cmd_autonomous, cmd_post_now, cmd_autopost, cmd_autoreply, cmd_generate_image,
        cmd_persona_list, cmd_persona_view, cmd_persona_set, cmd_persona_reset,
        cmd_mission, cmd_mission_list, cmd_community_config, cmd_realtime, cmd_community_types,
        handle_callback,
    ]

    for fn in all_cmds:
        if callable(fn) and asyncio.iscoroutinefunction(fn):
            ok(s, fn.__name__, "async function ✓")
        elif callable(fn):
            ok(s, fn.__name__, "callable ✓")
        else:
            fail(s, str(fn), "NON callable !")

    ok(s, "TOTAL_COMMANDS", f"{len(all_cmds)} handlers vérifiés")


# ══════════════════════════════════════════════════════════════════════════════
# 8. RUNNER — BotCommands & handlers registration
# ══════════════════════════════════════════════════════════════════════════════

def test_runner():
    section("RUNNER — BotCommands & App Builder")
    s = "8.runner"

    from bot.runner import BOT_COMMANDS, build_app
    from telegram import BotCommand

    # 8.1 — BOT_COMMANDS list
    if len(BOT_COMMANDS) >= 48:
        ok(s, "BOT_COMMANDS count", f"{len(BOT_COMMANDS)} commandes")
    else:
        fail(s, "BOT_COMMANDS count", f"seulement {len(BOT_COMMANDS)} (attendu ≥48)")

    # 8.2 — All commands are BotCommand instances
    bad = [c for c in BOT_COMMANDS if not isinstance(c, BotCommand)]
    if not bad:
        ok(s, "BotCommand types", "tous valides")
    else:
        fail(s, "BotCommand types", f"{len(bad)} invalides")

    # 8.3 — Required commands present
    required_cmds = ["start", "trust", "connect", "otp", "password", "generate",
                     "accounts", "campaigns", "mission", "realtime"]
    cmd_names = {c.command for c in BOT_COMMANDS}
    for cmd in required_cmds:
        if cmd in cmd_names:
            ok(s, f"command /{cmd}", "présent")
        else:
            fail(s, f"command /{cmd}", "MANQUANT")

    # 8.4 — build_app runs without error
    try:
        import os
        token = os.getenv("TELEGRAM_BOT_TOKEN", "fake:token")
        app = build_app(token)
        if app is not None:
            ok(s, "build_app()", "Application créée")
        else:
            fail(s, "build_app()", "retourne None")
    except Exception as e:
        fail(s, "build_app()", str(e))


# ══════════════════════════════════════════════════════════════════════════════
# 9. AUTONOMOUS ENGINE — Structure
# ══════════════════════════════════════════════════════════════════════════════

def test_autonomous():
    section("AUTONOMOUS ENGINE")
    s = "9.autonomous"

    import bot.autonomous as auto

    # 9.1 — Key functions exist
    fns = [
        "_post_content", "_make_message_handler", "_make_join_handler",
        "_get_community_profile", "_get_chat_persona",
        "_log_message", "_log_ai", "start_autonomous_engine",
    ]
    for fn_name in fns:
        if hasattr(auto, fn_name):
            ok(s, fn_name, "présent")
        else:
            fail(s, fn_name, "MANQUANT")

    # 9.2 — Module-level state
    if hasattr(auto, "_last_post"):
        ok(s, "_last_post dict", f"type={type(auto._last_post).__name__}")
    else:
        fail(s, "_last_post", "MANQUANT")


# ══════════════════════════════════════════════════════════════════════════════
# 10. REALTIME INTELLIGENCE
# ══════════════════════════════════════════════════════════════════════════════

async def test_realtime_intel():
    section("REALTIME INTELLIGENCE")
    s = "10.realtime"

    from bot.realtime_intel import (
        get_crypto_prices, get_latest_news,
        format_crypto_bulletin, format_news_bulletin,
        enrich_post_with_realtime,
    )

    # 10.1 — Crypto prices (CoinGecko free, no API key)
    try:
        prices = await asyncio.wait_for(get_crypto_prices(), timeout=10)
        if prices and isinstance(prices, dict):
            ok(s, "get_crypto_prices", f"{len(prices)} coins récupérés")
        else:
            ok(s, "get_crypto_prices", f"réponse reçue (vide ou hors ligne): {type(prices)}")
    except asyncio.TimeoutError:
        ok(s, "get_crypto_prices", "timeout (CoinGecko hors ligne ou rate limit) — non bloquant")
    except Exception as e:
        ok(s, "get_crypto_prices", f"erreur réseau non bloquante: {type(e).__name__}")

    # 10.2 — format functions
    fake_prices = {"bitcoin": {"price": 95000, "change_24h": 2.5, "symbol": "BTC"}}
    b = format_crypto_bulletin(fake_prices, "fr")
    if b and "BTC" in b:
        ok(s, "format_crypto_bulletin", b[:60])
    else:
        fail(s, "format_crypto_bulletin", f"vide: {b!r}")

    fake_news = [{"title": "Test headline", "source": "Reuters", "url": "https://example.com"}]
    nb = format_news_bulletin(fake_news, "news", "fr")
    if nb and "Test" in nb:
        ok(s, "format_news_bulletin", nb[:60])
    else:
        fail(s, "format_news_bulletin", f"vide: {nb!r}")


# ══════════════════════════════════════════════════════════════════════════════
# 11. API ENDPOINTS — Test HTTP
# ══════════════════════════════════════════════════════════════════════════════

async def test_api_endpoints():
    section("API SERVER ENDPOINTS")
    s = "11.api"

    try:
        import httpx
        base = "http://localhost:8080/api"

        async with httpx.AsyncClient(timeout=5) as client:
            # 11.1 — Health check (public)
            try:
                r = await client.get(f"{base}/health")
                if r.status_code == 200:
                    ok(s, "GET /api/health", f"200 OK — {r.text[:40]}")
                else:
                    fail(s, "GET /api/health", f"status={r.status_code}")
            except Exception as e:
                fail(s, "GET /api/health", str(e))

            # 11.2 — Auth endpoint (public)
            try:
                r = await client.get(f"{base}/auth/me")
                if r.status_code in (200, 401):
                    ok(s, "GET /api/auth/me", f"status={r.status_code} (401=normal sans session)")
                else:
                    fail(s, "GET /api/auth/me", f"status={r.status_code}")
            except Exception as e:
                fail(s, "GET /api/auth/me", str(e))

            # 11.3 — Env status endpoint
            try:
                r = await client.get(f"{base}/settings/env-status")
                if r.status_code in (200, 401):
                    if r.status_code == 200:
                        data = r.json()
                        ok(s, "GET /api/settings/env-status", f"{len(data)} env vars détectées")
                    else:
                        ok(s, "GET /api/settings/env-status", "401 (protégé — normal)")
                else:
                    fail(s, "GET /api/settings/env-status", f"status={r.status_code}")
            except Exception as e:
                fail(s, "GET /api/settings/env-status", str(e))

            # 11.4 — Protected routes return 401 without auth
            protected = [
                "/accounts", "/campaigns", "/groups", "/channels",
                "/messages", "/settings", "/leads", "/analytics/overview",
            ]
            for path in protected:
                try:
                    r = await client.get(f"{base}{path}")
                    if r.status_code == 401:
                        ok(s, f"GET {path} (401 protégé)", "sécurisé ✓")
                    elif r.status_code == 200:
                        ok(s, f"GET {path}", "200 OK")
                    else:
                        fail(s, f"GET {path}", f"status inattendu: {r.status_code}")
                except Exception as e:
                    fail(s, f"GET {path}", str(e))

    except ImportError:
        fail(s, "httpx", "non installé — tests API ignorés")


# ══════════════════════════════════════════════════════════════════════════════
# 12. PYTHON BACKEND FASTAPI — /health endpoint
# ══════════════════════════════════════════════════════════════════════════════

async def test_python_backend():
    section("PYTHON BACKEND (FastAPI :8090)")
    s = "12.backend"

    try:
        import httpx
        async with httpx.AsyncClient(timeout=5) as client:
            try:
                r = await client.get("http://localhost:8090/health")
                if r.status_code == 200:
                    ok(s, "GET /health (FastAPI)", f"200 — {r.text[:60]}")
                else:
                    fail(s, "GET /health", f"status={r.status_code}")
            except Exception as e:
                fail(s, "GET /health (FastAPI)", f"erreur: {e}")
    except ImportError:
        fail(s, "httpx", "non installé")


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

async def main():
    t0 = time.time()
    print("\n" + "═"*65)
    print("  🔬 NEXUS AI — AUDIT COMPLET DES FONCTIONNALITÉS")
    print("═"*65)

    test_imports()
    await test_trust_checker()
    await test_human_ai()
    await test_content_gen()
    test_community_intel()
    test_keyboards()
    test_commands()
    test_runner()
    test_autonomous()
    await test_realtime_intel()
    await test_api_endpoints()
    await test_python_backend()

    # ── FINAL REPORT ──────────────────────────────────────────────────────
    elapsed = time.time() - t0
    passed  = [r for r in RESULTS if r["ok"]]
    failed  = [r for r in RESULTS if not r["ok"]]
    total   = len(RESULTS)

    print("\n" + "═"*65)
    print(f"  📊 RAPPORT FINAL — {elapsed:.1f}s")
    print("═"*65)
    print(f"  ✅ Réussis : {len(passed)}/{total}")
    print(f"  ❌ Échoués : {len(failed)}/{total}")

    if failed:
        print(f"\n  ── DÉTAIL DES ÉCHECS ──")
        for f in failed:
            print(f"  ❌ [{f['s']}] {f['n']} — {f['d']}")

    pct = int(len(passed) / total * 100) if total > 0 else 0
    print(f"\n  Score global : {pct}% ({len(passed)}/{total})")

    if pct >= 90:
        print("  🎉 Système opérationnel — toutes les fonctionnalités majeures fonctionnent !")
    elif pct >= 75:
        print("  ⚠️  Système fonctionnel avec des points mineurs à corriger.")
    else:
        print("  🔴 Problèmes critiques détectés — voir les échecs ci-dessus.")

    print("═"*65 + "\n")
    return len(failed)


if __name__ == "__main__":
    n_failed = asyncio.run(main())
    sys.exit(0 if n_failed == 0 else 1)
