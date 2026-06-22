from __future__ import annotations
import logging
import asyncio
import os
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from telegram.constants import ParseMode

# Pending Telethon connections: phone → {client, phone_code_hash, awaiting_password}
_pending_connections: dict[str, dict] = {}

from .utils import (
    db_fetch, db_fetchrow, db_fetchval, db_execute,
    fmt_status, fmt_health, chunk_text, is_admin
)
from .keyboards import (
    main_menu_kb, accounts_kb, account_detail_kb, campaigns_kb,
    campaign_detail_kb, security_kb, system_kb, ai_menu_kb,
    leads_kb, back_to_menu_kb
)

logger = logging.getLogger(__name__)


def admin_only(func):
    async def wrapper(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not user or not is_admin(user.id):
            msg = update.message or (update.callback_query and update.callback_query.message)
            if msg:
                await msg.reply_text("⛔ Accès refusé. Tu n'es pas administrateur.")
            return
        return await func(update, ctx)
    return wrapper


# ── /start & /menu ────────────────────────────────────────────────────────────

@admin_only
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "👋 *Bienvenue sur Nexus AI Bot!*\n\n"
        "🤖 Contrôle complet de ton système Telegram directement d'ici.\n"
        "Utilise les boutons ci-dessous ou tape une commande.\n\n"
        "📌 *Commandes rapides:*\n"
        "/stats — Statistiques globales\n"
        "/accounts — Gérer les comptes\n"
        "/campaigns — Gérer les campagnes\n"
        "/groups — Groupes surveillés\n"
        "/leads — Pipeline CRM\n"
        "/security — Sécurité\n"
        "/send — Envoyer un message\n"
        "/generate — Générer contenu IA\n"
        "/help — Aide complète"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_kb())


@admin_only
async def cmd_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("🏠 *Menu principal*", parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_kb())


# ── /status & /stats ──────────────────────────────────────────────────────────

@admin_only
async def cmd_status(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await _send_stats(update.message)


@admin_only
async def cmd_stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await _send_stats(update.message)


async def _send_stats(msg):
    accounts = await db_fetch("SELECT status, health_score FROM telegram_accounts")
    groups = await db_fetchval("SELECT COUNT(*) FROM telegram_groups")
    channels = await db_fetchval("SELECT COUNT(*) FROM telegram_channels")
    campaigns = await db_fetch("SELECT status FROM campaigns")
    msgs_today = await db_fetchval(
        "SELECT COUNT(*) FROM messages WHERE created_at >= CURRENT_DATE"
    )
    ai_today = await db_fetchval(
        "SELECT COUNT(*) FROM messages WHERE is_ai_generated = true AND created_at >= CURRENT_DATE"
    )
    threats_24h = await db_fetchval(
        "SELECT COUNT(*) FROM security_logs WHERE created_at > NOW() - INTERVAL '24 hours'"
    )
    leads_hot = await db_fetchval("SELECT COUNT(*) FROM leads WHERE stage IN ('hot','interested','negotiating')")
    floodwaits = await db_fetchval(
        "SELECT COUNT(*) FROM flood_events WHERE created_at > NOW() - INTERVAL '24 hours'"
    )

    total_acc = len(accounts)
    active_acc = sum(1 for a in accounts if a["status"] == "active")
    at_risk = sum(1 for a in accounts if a["health_score"] < 60)
    avg_health = int(sum(a["health_score"] for a in accounts) / total_acc) if total_acc else 0
    active_campaigns = sum(1 for c in campaigns if c["status"] == "active")

    text = (
        "📊 *NEXUS AI — Tableau de bord*\n"
        f"🕐 {datetime.now().strftime('%d/%m/%Y %H:%M')}\n\n"
        f"👤 *Comptes Telegram*\n"
        f"  • Total: `{total_acc}` | Actifs: `{active_acc}`\n"
        f"  • Santé moyenne: {fmt_health(avg_health)}\n"
        f"  • À risque: `{at_risk}`\n\n"
        f"📣 *Campagnes*\n"
        f"  • Total: `{len(campaigns)}` | Actives: `{active_campaigns}`\n\n"
        f"💬 *Messages aujourd'hui*\n"
        f"  • Total: `{msgs_today}` | IA: `{ai_today}`\n\n"
        f"👥 Groupes: `{groups}` | 📺 Canaux: `{channels}`\n\n"
        f"🎯 Leads chauds: `{leads_hot}`\n\n"
        f"🛡 *Sécurité 24h*\n"
        f"  • Événements: `{threats_24h}` | FloodWaits: `{floodwaits}`\n"
    )
    await msg.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_kb())


# ── /accounts ─────────────────────────────────────────────────────────────────

@admin_only
async def cmd_accounts(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    accounts = await db_fetch(
        "SELECT id, phone_number, username, status, health_score, is_connected, messages_count FROM telegram_accounts ORDER BY id"
    )
    if not accounts:
        await update.message.reply_text(
            "👤 Aucun compte configuré.\n\n"
            "Pour ajouter un compte:\n`/connect +33612345678`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb()
        )
        return

    lines = ["👤 *Comptes Telegram*\n"]
    for a in accounts:
        name = a["username"] or a["phone_number"]
        lines.append(
            f"{fmt_health(a['health_score'])} *{name}*\n"
            f"  📱 {a['phone_number']} | {fmt_status(a['status'])}\n"
            f"  💬 {a['messages_count']} messages\n"
        )
    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.MARKDOWN,
        reply_markup=accounts_kb(list(accounts))
    )


@admin_only
async def cmd_connect(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/connect +33612345678 — Envoie le code OTP via Telethon et attend la vérification."""
    if not ctx.args:
        await update.message.reply_text(
            "📱 *Connecter un compte Telegram*\n\n"
            "Usage: `/connect +<indicatif><numéro>`\n\n"
            "Exemples:\n"
            "  `/connect +33612345678` (France)\n"
            "  `/connect +21261234567` (Maroc)\n"
            "  `/connect +12125551234` (USA)\n\n"
            "Un code OTP sera envoyé sur ce numéro par Telegram.",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    phone = ctx.args[0].strip()
    if not phone.startswith("+"):
        await update.message.reply_text(
            "❌ Le numéro doit commencer par `+` et l'indicatif pays.\n"
            "Exemple: `/connect +33612345678`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    API_ID   = os.getenv("TELEGRAM_API_ID")
    API_HASH = os.getenv("TELEGRAM_API_HASH")
    if not API_ID or not API_HASH:
        await update.message.reply_text("❌ TELEGRAM_API_ID/HASH non configurés dans les secrets.", parse_mode=ParseMode.MARKDOWN)
        return

    msg = await update.message.reply_text(
        f"📲 Envoi du code OTP vers `{phone}`...\n_Connexion à Telegram en cours..._",
        parse_mode=ParseMode.MARKDOWN
    )

    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        client = TelegramClient(StringSession(), int(API_ID), API_HASH)
        await client.connect()
        result = await client.send_code_request(phone)

        _pending_connections[phone] = {
            "client": client,
            "phone_code_hash": result.phone_code_hash,
            "awaiting_password": False,
        }

        await msg.edit_text(
            f"✅ *Code OTP envoyé sur `{phone}`!*\n\n"
            f"Ouvre Telegram sur ce téléphone, copie le code reçu et entre:\n\n"
            f"`/otp {phone} <code>`\n\n"
            f"Exemple: `/otp {phone} 12345`\n\n"
            f"⚠️ Le code expire dans 5 minutes.",
            parse_mode=ParseMode.MARKDOWN
        )

    except Exception as e:
        logger.error("cmd_connect error for %s: %s", phone, e)
        await msg.edit_text(
            f"❌ *Échec de l'envoi du code*\n\n`{e}`\n\n"
            f"Vérifie que le numéro est correct (avec indicatif +XX).",
            parse_mode=ParseMode.MARKDOWN
        )


async def _save_session(client, phone: str, msg) -> bool:
    """Save Telethon StringSession to DB after successful sign-in. Returns True on success."""
    try:
        session_string = client.session.save()
        me = await client.get_me()
        username     = getattr(me, "username", None) or ""
        first_name   = getattr(me, "first_name", "") or ""
        last_name    = getattr(me, "last_name", "") or ""
        display_name = f"{first_name} {last_name}".strip()

        await db_execute(
            """INSERT INTO telegram_accounts
               (phone_number, username, display_name, session_data, status, is_connected, health_score)
               VALUES ($1, $2, $3, $4, 'active', true, 100)
               ON CONFLICT (phone_number) DO UPDATE SET
                 username     = EXCLUDED.username,
                 display_name = EXCLUDED.display_name,
                 session_data = EXCLUDED.session_data,
                 status       = 'active',
                 is_connected = true,
                 health_score = 100,
                 last_seen    = NOW()""",
            phone, username, display_name, session_string,
        )

        mention = f"@{username}" if username else display_name or phone
        await msg.edit_text(
            f"✅ *Compte connecté avec succès!*\n\n"
            f"📱 Numéro: `{phone}`\n"
            f"👤 Compte: {mention}\n"
            f"🎯 Nom: {display_name or '—'}\n\n"
            f"🤖 L'engine autonome démarre automatiquement.\n"
            f"Utilise `/accounts` pour voir tes comptes.",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb()
        )
        logger.info("✅ Account connected: %s (@%s)", phone, username)
        return True
    except Exception as e:
        logger.error("_save_session failed for %s: %s", phone, e)
        await msg.edit_text(
            f"❌ Connexion réussie mais erreur de sauvegarde:\n`{e}`",
            parse_mode=ParseMode.MARKDOWN
        )
        return False


@admin_only
async def cmd_otp(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/otp +33612345678 12345 — Valide le code OTP et connecte le compte."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/otp <téléphone> <code>`\n\n"
            "Exemple: `/otp +33612345678 12345`\n\n"
            "Lance d'abord `/connect +33612345678` pour recevoir le code.",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    phone = args[0].strip()
    # Join all remaining args in case user typed code with spaces (e.g. "1 2 3 4 5")
    # Then strip everything except digits
    raw_code = " ".join(args[1:]).strip()
    code = "".join(filter(str.isdigit, raw_code))
    if not code:
        await update.message.reply_text(
            "❌ Code invalide — entre uniquement les chiffres.\n\n"
            f"Exemple: `/otp {phone} 12345`",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    pending = _pending_connections.get(phone)

    if not pending:
        await update.message.reply_text(
            f"❌ Aucune connexion en attente pour `{phone}`.\n\n"
            f"Lance d'abord: `/connect {phone}`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    msg = await update.message.reply_text("🔐 Vérification du code OTP...", parse_mode=ParseMode.MARKDOWN)
    client           = pending["client"]
    phone_code_hash  = pending["phone_code_hash"]

    try:
        from telethon.errors import SessionPasswordNeededError
        await client.sign_in(phone, code, phone_code_hash=phone_code_hash)

    except Exception as e:
        err_str = str(e).lower()
        if "password" in err_str or "two" in err_str or "2fa" in err_str:
            pending["awaiting_password"] = True
            await msg.edit_text(
                "🔒 *Authentification à deux facteurs (2FA) requise!*\n\n"
                f"Entre ton mot de passe 2FA Telegram:\n"
                f"`/password {phone} <mot_de_passe>`\n\n"
                f"Exemple: `/password {phone} MonMotDePasse123`",
                parse_mode=ParseMode.MARKDOWN
            )
        else:
            await msg.edit_text(
                f"❌ *Code invalide ou expiré*\n\n`{e}`\n\n"
                f"Renvoie le code avec `/connect {phone}`",
                parse_mode=ParseMode.MARKDOWN
            )
        return

    await _save_session(client, phone, msg)
    _pending_connections.pop(phone, None)


@admin_only
async def cmd_password(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/password +33612345678 <motdepasse> — Entre le mot de passe 2FA Telegram."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/password <téléphone> <mot_de_passe_2fa>`\n\n"
            "Exemple: `/password +33612345678 MonMotDePasse`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    phone    = args[0].strip()
    password = " ".join(args[1:]).strip()
    pending  = _pending_connections.get(phone)

    if not pending:
        await update.message.reply_text(
            f"❌ Aucune session 2FA en attente pour `{phone}`.\n"
            f"Lance d'abord `/connect {phone}`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    msg    = await update.message.reply_text("🔐 Vérification du mot de passe 2FA...", parse_mode=ParseMode.MARKDOWN)
    client = pending["client"]

    try:
        await client.sign_in(password=password)
    except Exception as e:
        await msg.edit_text(
            f"❌ *Mot de passe incorrect*\n\n`{e}`\n\n"
            f"Réessaie: `/password {phone} <mot_de_passe>`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    await _save_session(client, phone, msg)
    _pending_connections.pop(phone, None)


@admin_only
async def cmd_disconnect(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: `/disconnect <id>`", parse_mode=ParseMode.MARKDOWN)
        return
    acc_id = int(ctx.args[0])
    await db_execute(
        "UPDATE telegram_accounts SET is_connected = false, status = 'inactive' WHERE id = $1", acc_id
    )
    await update.message.reply_text(f"🔴 Compte `{acc_id}` déconnecté.", parse_mode=ParseMode.MARKDOWN)


@admin_only
async def cmd_health(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    accounts = await db_fetch(
        "SELECT id, phone_number, username, health_score, status, messages_count FROM telegram_accounts ORDER BY health_score ASC"
    )
    if not accounts:
        await update.message.reply_text("Aucun compte.", reply_markup=back_to_menu_kb())
        return

    lines = ["🏥 *Santé des comptes*\n"]
    for a in accounts:
        name = a["username"] or a["phone_number"]
        bar = "█" * (a["health_score"] // 10) + "░" * (10 - a["health_score"] // 10)
        lines.append(f"{fmt_health(a['health_score'])} *{name}*\n  `{bar}` | {fmt_status(a['status'])}")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /campaigns ────────────────────────────────────────────────────────────────

@admin_only
async def cmd_campaigns(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    campaigns = await db_fetch(
        "SELECT id, name, status, messages_sent, type FROM campaigns ORDER BY created_at DESC"
    )
    if not campaigns:
        await update.message.reply_text("📣 Aucune campagne.", reply_markup=back_to_menu_kb())
        return

    lines = ["📣 *Campagnes*\n"]
    for c in campaigns:
        lines.append(
            f"{fmt_status(c['status'])} *{c['name']}*\n"
            f"  📤 {c['messages_sent']} messages envoyés\n"
        )
    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.MARKDOWN,
        reply_markup=campaigns_kb(list(campaigns))
    )


@admin_only
async def cmd_start_campaign(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: `/start_campaign <id>`", parse_mode=ParseMode.MARKDOWN)
        return
    camp_id = int(ctx.args[0])
    camp = await db_fetchrow("SELECT name, status FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        await update.message.reply_text(f"❌ Campagne `{camp_id}` introuvable.", parse_mode=ParseMode.MARKDOWN)
        return
    await db_execute("UPDATE campaigns SET status = 'active' WHERE id = $1", camp_id)
    await update.message.reply_text(
        f"▶️ Campagne *{camp['name']}* démarrée!", parse_mode=ParseMode.MARKDOWN
    )


@admin_only
async def cmd_stop_campaign(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: `/stop_campaign <id>`", parse_mode=ParseMode.MARKDOWN)
        return
    camp_id = int(ctx.args[0])
    camp = await db_fetchrow("SELECT name FROM campaigns WHERE id = $1", camp_id)
    if not camp:
        await update.message.reply_text(f"❌ Campagne `{camp_id}` introuvable.", parse_mode=ParseMode.MARKDOWN)
        return
    await db_execute("UPDATE campaigns SET status = 'paused' WHERE id = $1", camp_id)
    await update.message.reply_text(
        f"⏸ Campagne *{camp['name']}* mise en pause.", parse_mode=ParseMode.MARKDOWN
    )


# ── /groups & /channels ───────────────────────────────────────────────────────

@admin_only
async def cmd_groups(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    groups = await db_fetch(
        "SELECT title, members_count, is_monitored, is_auto_reply, is_auto_moderate, messages_count FROM telegram_groups ORDER BY members_count DESC NULLS LAST LIMIT 15"
    )
    if not groups:
        await update.message.reply_text("👥 Aucun groupe enregistré.", reply_markup=back_to_menu_kb())
        return

    lines = ["👥 *Groupes surveillés*\n"]
    for g in groups:
        flags = []
        if g["is_monitored"]: flags.append("👁 Monitored")
        if g["is_auto_reply"]: flags.append("🤖 AutoReply")
        if g["is_auto_moderate"]: flags.append("🛡 AutoMod")
        members = g["members_count"] or "?"
        lines.append(
            f"📌 *{g['title']}*\n"
            f"  👥 {members} membres | 💬 {g['messages_count']} msg\n"
            f"  {' | '.join(flags) if flags else '—'}\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_channels(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    channels = await db_fetch(
        "SELECT title, subscribers_count, is_auto_post, posts_count FROM telegram_channels ORDER BY subscribers_count DESC NULLS LAST LIMIT 15"
    )
    if not channels:
        await update.message.reply_text("📺 Aucun canal enregistré.", reply_markup=back_to_menu_kb())
        return

    lines = ["📺 *Canaux*\n"]
    for c in channels:
        subs = c["subscribers_count"] or "?"
        auto = "🤖 AutoPost" if c["is_auto_post"] else "—"
        lines.append(f"📡 *{c['title']}*\n  👥 {subs} abonnés | 📤 {c['posts_count']} posts | {auto}\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /messages & /send ─────────────────────────────────────────────────────────

@admin_only
async def cmd_messages(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    msgs = await db_fetch(
        "SELECT content, direction, is_ai_generated, sender_username, created_at FROM messages ORDER BY created_at DESC LIMIT 10"
    )
    if not msgs:
        await update.message.reply_text("💬 Aucun message.", reply_markup=back_to_menu_kb())
        return

    lines = ["💬 *10 derniers messages*\n"]
    for m in msgs:
        icon = "📤" if m["direction"] == "outbound" else "📥"
        ai = " 🤖" if m["is_ai_generated"] else ""
        sender = f" @{m['sender_username']}" if m["sender_username"] else ""
        content = m["content"][:60] + ("…" if len(m["content"]) > 60 else "")
        ts = m["created_at"].strftime("%H:%M") if m["created_at"] else ""
        lines.append(f"{icon}{ai}{sender} `{ts}`\n  _{content}_\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_send(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args or len(ctx.args) < 3:
        await update.message.reply_text(
            "📤 *Envoyer un message*\n\n"
            "Usage: `/send <account_id> <chat_id> <message>`\n\n"
            "Exemple:\n`/send 1 @mongroupe Bonjour tout le monde!`",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    acc_id = ctx.args[0]
    chat_id = ctx.args[1]
    message = " ".join(ctx.args[2:])
    await db_execute(
        "INSERT INTO messages (account_id, content, direction, status, is_ai_generated) VALUES ($1, $2, 'outbound', 'sent', false)",
        int(acc_id), message
    )
    await update.message.reply_text(
        f"✅ Message envoyé!\n\n"
        f"📱 Compte: `{acc_id}`\n"
        f"📍 Destination: `{chat_id}`\n"
        f"💬 Contenu: _{message[:100]}_",
        parse_mode=ParseMode.MARKDOWN
    )


# ── /generate (IA) ────────────────────────────────────────────────────────────

@admin_only
async def cmd_generate(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    types = ["motivation", "crypto", "welcome", "general"]
    if not ctx.args:
        await update.message.reply_text(
            "🤖 *Générer un message IA*\n\n"
            f"Types disponibles: `{'` | `'.join(types)}`\n\n"
            "Usage: `/generate <type> <contexte optionnel>`\n"
            "Exemple: `/generate crypto Le BTC vient de passer 100k`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    msg_type = ctx.args[0] if ctx.args[0] in types else "general"
    context = " ".join(ctx.args[1:]) if len(ctx.args) > 1 else ""
    await update.message.reply_text("⏳ Génération en cours...")

    import os, random
    templates = {
        "motivation": [
            "Chaque grand voyage commence par un premier pas. Continuez d'avancer! 💪",
            "La différence entre où vous êtes et où vous voulez être, c'est ce que vous faites aujourd'hui. 🚀",
            "Le succès n'est pas une destination — c'est un engagement quotidien. ⭐",
        ],
        "crypto": [
            "Le marché consolide mais les fondamentaux restent forts. HODL! 💎",
            "DCA à travers la volatilité. Le temps sur le marché bat le timing du marché. 📈",
            "Les mains fortes se construisent pendant les marchés baissiers. 🔥",
        ],
        "welcome": [
            "Bienvenue dans la communauté! N'hésitez pas à vous présenter. 👋",
            "Welcome! Great to have you here. Feel free to introduce yourself. 🎉",
        ],
        "general": [
            "Merci pour votre message! 🙏",
            "Bonne question! Je reviens vers vous rapidement. ⚡",
        ],
    }

    openai_key = os.getenv("OPENAI_API_KEY")
    content = None

    if openai_key:
        try:
            import openai as oa
            client = oa.AsyncOpenAI(api_key=openai_key)
            resp = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "Tu es un expert en communication Telegram. Génère un message court, naturel et engageant en français."},
                    {"role": "user", "content": f"Type: {msg_type}. Contexte: {context or 'général'}. Génère un message Telegram."},
                ],
                max_tokens=200,
            )
            content = resp.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI error: {e}")

    if not content:
        content = random.choice(templates.get(msg_type, templates["general"]))

    # ── Trust / Fact-Check ──
    try:
        from .trust_checker import check_content, format_trust_report, score_color
        trust = await check_content(content)
        trust_block = (
            f"\n\n─────────────────────\n"
            f"🔍 *Trust & Fact-Check*\n"
            f"{score_color(trust.score)} {trust.label} | Score: `{trust.score}/100`\n"
            f"📝 _{trust.reasoning}_"
            + (f"\n⚠️ Alertes: {' • '.join(trust.warnings)}" if trust.warnings else "")
        )
    except Exception as e:
        logger.warning("Trust check failed in cmd_generate: %s", e)
        trust_block = ""

    await update.message.reply_text(
        f"✨ *Message généré ({msg_type})*\n\n{content}{trust_block}\n\n"
        f"_Copie ce message ou utilise /send pour l'envoyer_",
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=back_to_menu_kb()
    )


# ── /trust ────────────────────────────────────────────────────────────────────

@admin_only
async def cmd_trust(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/trust <texte> — Analyse Trust & Fact-Check d'un texte quelconque"""
    text = " ".join(ctx.args) if ctx.args else ""
    if not text:
        await update.message.reply_text(
            "🔍 *Trust & Fact-Check*\n\n"
            "Analyse la fiabilité d'un texte et détecte si c'est un fait, une opinion, "
            "du contenu promotionnel ou potentiellement trompeur.\n\n"
            "Usage: `/trust <ton texte ici>`\n\n"
            "Exemple:\n"
            "`/trust Bitcoin a augmenté de 150% cette année selon CoinGecko`\n\n"
            "📊 *Labels possibles:*\n"
            "✅ Vérifié — Faits vérifiables\n"
            "💡 Opinion — Point de vue subjectif\n"
            "🔄 Mixte — Mélange fait/opinion\n"
            "⚠️ Non vérifiable — Claims douteux\n"
            "📊 Données — Statistiques\n"
            "🔥 Tendance — Contenu viral\n"
            "📣 Promotionnel — Marketing",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb(),
        )
        return

    await update.message.reply_text("🔍 Analyse en cours...")

    try:
        from .trust_checker import check_content, format_trust_report, score_color
        trust = await check_content(text)
        report = format_trust_report(trust)
        color  = score_color(trust.score)

        # Visual score bar
        bar_filled = "█" * (trust.score // 10)
        bar_empty  = "░" * (10 - trust.score // 10)
        header = (
            f"🔍 *Analyse Trust & Fact-Check*\n\n"
            f"*Texte analysé:*\n_{text[:200]}{'...' if len(text)>200 else ''}_\n\n"
        )

        result_text = (
            f"{header}"
            f"─────────────────────\n"
            f"{color} {trust.label} | Score: `{trust.score}/100`\n"
            f"`{bar_filled}{bar_empty}`\n"
            f"Confiance: `{trust.confidence}%`\n\n"
        )

        if trust.reasoning:
            result_text += f"📝 *Analyse:* _{trust.reasoning}_\n\n"

        if trust.claims:
            result_text += "📌 *Claims factuels détectés:*\n"
            for c in trust.claims:
                result_text += f"  • {c}\n"
            result_text += "\n"

        if trust.warnings:
            result_text += "⚠️ *Signaux d'alerte:*\n"
            for w in trust.warnings:
                result_text += f"  • {w}\n"

        await update.message.reply_text(
            result_text,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb(),
        )
    except Exception as e:
        logger.error("cmd_trust error: %s", e)
        await update.message.reply_text(
            f"❌ Erreur lors de l'analyse: `{e}`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb(),
        )


# ── /personalities ────────────────────────────────────────────────────────────

@admin_only
async def cmd_personalities(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    persos = await db_fetch("SELECT name, type, tone, energy_level, is_default FROM ai_personalities ORDER BY id")
    if not persos:
        await update.message.reply_text(
            "🎭 Aucune personnalité configurée.\n"
            "Crée-en une depuis le panel admin → AI Engine.",
            reply_markup=back_to_menu_kb()
        )
        return

    lines = ["🎭 *Personnalités IA*\n"]
    for p in persos:
        default = " ⭐ Défaut" if p["is_default"] else ""
        energy_bar = "⚡" * (p["energy_level"] // 20)
        lines.append(
            f"*{p['name']}*{default}\n"
            f"  Type: `{p['type']}` | Ton: `{p['tone']}`\n"
            f"  Énergie: {energy_bar} ({p['energy_level']}/100)\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /leads & /pipeline ────────────────────────────────────────────────────────

@admin_only
async def cmd_leads(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    stats = await db_fetchrow("""
        SELECT
            COUNT(*) FILTER (WHERE stage = 'cold') as cold,
            COUNT(*) FILTER (WHERE stage = 'contacted') as contacted,
            COUNT(*) FILTER (WHERE stage = 'interested') as interested,
            COUNT(*) FILTER (WHERE stage = 'negotiating') as negotiating,
            COUNT(*) FILTER (WHERE stage = 'converted') as converted,
            COUNT(*) FILTER (WHERE stage = 'lost') as lost,
            COUNT(*) as total,
            COALESCE(SUM(value) FILTER (WHERE stage = 'converted'), 0) as total_value
        FROM leads
    """)
    total = stats["total"] or 0
    converted = stats["converted"] or 0
    rate = round((converted / total * 100), 1) if total > 0 else 0
    value_eur = (stats["total_value"] or 0) / 100

    text = (
        "🎯 *Pipeline CRM — Leads*\n\n"
        f"🧊 Cold: `{stats['cold']}`\n"
        f"📨 Contactés: `{stats['contacted']}`\n"
        f"👀 Intéressés: `{stats['interested']}`\n"
        f"🤝 En négociation: `{stats['negotiating']}`\n"
        f"💰 Convertis: `{stats['converted']}`\n"
        f"❌ Perdus: `{stats['lost']}`\n\n"
        f"📊 Total: `{total}` leads\n"
        f"📈 Taux de conversion: `{rate}%`\n"
        f"💵 Valeur convertie: `{value_eur:.2f}€`"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=leads_kb())


# ── /security & /threats ──────────────────────────────────────────────────────

@admin_only
async def cmd_security(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    events = await db_fetchval("SELECT COUNT(*) FROM security_logs WHERE created_at > NOW() - INTERVAL '24 hours'")
    floods = await db_fetchval("SELECT COUNT(*) FROM flood_events WHERE created_at > NOW() - INTERVAL '24 hours'")
    sanctions = await db_fetchval("SELECT COUNT(*) FROM sanctions WHERE is_active = true")
    escalations = await db_fetchval("SELECT COUNT(*) FROM escalations WHERE status = 'pending'")
    at_risk = await db_fetchval("SELECT COUNT(*) FROM telegram_accounts WHERE health_score < 60")

    overall = "🟢 Sain" if (events == 0 and at_risk == 0) else ("🟡 Attention" if at_risk < 2 else "🔴 Critique")

    text = (
        f"🛡 *Tableau de bord Sécurité*\n\n"
        f"Statut global: {overall}\n\n"
        f"🚨 Événements 24h: `{events}`\n"
        f"🌊 FloodWaits 24h: `{floods}`\n"
        f"⛔ Sanctions actives: `{sanctions}`\n"
        f"⚠️ Escalations en attente: `{escalations}`\n"
        f"💔 Comptes à risque: `{at_risk}`"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=security_kb())


@admin_only
async def cmd_threats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    logs = await db_fetch(
        "SELECT event_type, severity, description, created_at FROM security_logs ORDER BY created_at DESC LIMIT 10"
    )
    if not logs:
        await update.message.reply_text("✅ Aucun événement de sécurité récent.", reply_markup=back_to_menu_kb())
        return

    lines = ["🚨 *Événements sécurité récents*\n"]
    for l in logs:
        sev_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(l["severity"], "⚪")
        ts = l["created_at"].strftime("%d/%m %H:%M") if l["created_at"] else ""
        lines.append(f"{sev_icon} `{l['event_type']}` — {ts}\n  _{l['description'][:80]}_\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_ban(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args or len(ctx.args) < 2:
        await update.message.reply_text(
            "⛔ *Bannir un utilisateur*\n\n"
            "Usage: `/ban <@username> <raison>`\n"
            "Exemple: `/ban @spammer123 Spam répété`",
            parse_mode=ParseMode.MARKDOWN
        )
        return
    username = ctx.args[0].lstrip("@")
    reason = " ".join(ctx.args[1:])
    await db_execute(
        "INSERT INTO sanctions (type, target_username, reason, is_active) VALUES ('ban', $1, $2, true)",
        username, reason
    )
    await db_execute(
        "INSERT INTO security_logs (event_type, severity, target_username, description) VALUES ('manual_ban', 'high', $1, $2)",
        username, f"Ban manuel: {reason}"
    )
    await update.message.reply_text(
        f"⛔ *@{username} banni!*\n📝 Raison: _{reason}_",
        parse_mode=ParseMode.MARKDOWN
    )


@admin_only
async def cmd_sanctions(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    sanctions = await db_fetch(
        "SELECT type, target_username, reason, created_at FROM sanctions WHERE is_active = true ORDER BY created_at DESC LIMIT 15"
    )
    if not sanctions:
        await update.message.reply_text("✅ Aucune sanction active.", reply_markup=back_to_menu_kb())
        return

    lines = ["⛔ *Sanctions actives*\n"]
    for s in sanctions:
        icon = {"ban": "⛔", "mute": "🔇", "warn": "⚠️", "kick": "👢"}.get(s["type"], "❓")
        ts = s["created_at"].strftime("%d/%m") if s["created_at"] else ""
        lines.append(f"{icon} @{s['target_username']} — `{ts}`\n  _{s['reason'][:60]}_\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /floodwait ────────────────────────────────────────────────────────────────

@admin_only
async def cmd_floodwait(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    floods = await db_fetch(
        "SELECT account_id, wait_seconds, severity, context, triggered_at, resolved FROM flood_events ORDER BY triggered_at DESC LIMIT 10"
    )
    if not floods:
        await update.message.reply_text("✅ Aucun FloodWait récent.", reply_markup=back_to_menu_kb())
        return

    lines = ["🌊 *FloodWaits récents*\n"]
    for f in floods:
        sev_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(f["severity"], "⚪")
        status = "✅" if f["resolved"] else "⏳"
        ts = f["triggered_at"].strftime("%d/%m %H:%M") if f["triggered_at"] else ""
        lines.append(
            f"{sev_icon} Compte `{f['account_id']}` — ⏱ {f['wait_seconds']}s {status}\n"
            f"  📍 {f['context'] or 'N/A'} | {ts}\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /escalations ──────────────────────────────────────────────────────────────

@admin_only
async def cmd_escalations(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    escs = await db_fetch(
        "SELECT id, contact_name, contact_username, reason, sentiment_score, status, created_at FROM escalations WHERE status = 'pending' ORDER BY created_at DESC LIMIT 10"
    )
    if not escs:
        await update.message.reply_text("✅ Aucune escalation en attente.", reply_markup=back_to_menu_kb())
        return

    lines = ["⚠️ *Escalations en attente*\n"]
    for e in escs:
        sentiment = "😊" if e["sentiment_score"] > 0.3 else ("😐" if e["sentiment_score"] > -0.3 else "😡")
        name = e["contact_name"] or f"@{e['contact_username']}" or "Inconnu"
        ts = e["created_at"].strftime("%d/%m %H:%M") if e["created_at"] else ""
        lines.append(
            f"{sentiment} *{name}* — `#{e['id']}`\n"
            f"  📋 {e['reason']} | {ts}\n"
            f"  Résoudre: `/resolve_escalation {e['id']}`\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_resolve_escalation(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Usage: `/resolve_escalation <id>`", parse_mode=ParseMode.MARKDOWN)
        return
    esc_id = int(ctx.args[0])
    await db_execute(
        "UPDATE escalations SET status = 'resolved', resolved_at = NOW() WHERE id = $1", esc_id
    )
    await update.message.reply_text(f"✅ Escalation `#{esc_id}` résolue.", parse_mode=ParseMode.MARKDOWN)


# ── /proxies ──────────────────────────────────────────────────────────────────

@admin_only
async def cmd_proxies(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    proxies = await db_fetch(
        "SELECT name, host, port, type, is_active, last_check_status, response_time_ms, country FROM proxies ORDER BY id LIMIT 15"
    )
    if not proxies:
        await update.message.reply_text("🌐 Aucun proxy configuré.", reply_markup=back_to_menu_kb())
        return

    lines = ["🌐 *Proxies*\n"]
    for p in proxies:
        active = "🟢" if p["is_active"] else "🔴"
        status = {"ok": "✅", "timeout": "⏱", "banned": "⛔", "error": "❌"}.get(p["last_check_status"] or "", "❓")
        speed = f"{p['response_time_ms']}ms" if p["response_time_ms"] else "N/A"
        country = f"🏳 {p['country']}" if p["country"] else ""
        lines.append(f"{active} *{p['name']}* {country}\n  `{p['host']}:{p['port']}` ({p['type']}) {status} {speed}\n")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /schedules ────────────────────────────────────────────────────────────────

@admin_only
async def cmd_schedules(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    schedules = await db_fetch(
        "SELECT name, cron_expression, is_active, run_count, last_run, next_run FROM schedules ORDER BY id LIMIT 10"
    )
    if not schedules:
        await update.message.reply_text("🗓 Aucun schedule configuré.", reply_markup=back_to_menu_kb())
        return

    lines = ["🗓 *Schedules*\n"]
    for s in schedules:
        active = "🟢" if s["is_active"] else "⏸"
        next_run = s["next_run"].strftime("%d/%m %H:%M") if s["next_run"] else "N/A"
        lines.append(
            f"{active} *{s['name']}*\n"
            f"  ⏰ `{s['cron_expression']}` | Runs: `{s['run_count']}`\n"
            f"  Prochain: `{next_run}`\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /warmup ───────────────────────────────────────────────────────────────────

@admin_only
async def cmd_warmup(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    plans = await db_fetch(
        "SELECT account_id, status, current_day, total_days, today_count, today_limit, growth_type FROM warmup_plans ORDER BY id LIMIT 10"
    )
    if not plans:
        await update.message.reply_text("🔥 Aucun plan de warmup.", reply_markup=back_to_menu_kb())
        return

    lines = ["🔥 *Plans de Warmup*\n"]
    for w in plans:
        progress = int((w["current_day"] / w["total_days"]) * 10) if w["total_days"] else 0
        bar = "🟧" * progress + "⬜" * (10 - progress)
        lines.append(
            f"{fmt_status(w['status'])} Compte `{w['account_id']}`\n"
            f"  Jour `{w['current_day']}/{w['total_days']}` ({w['growth_type']})\n"
            f"  {bar}\n"
            f"  Aujourd'hui: `{w['today_count']}/{w['today_limit']}` messages\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /memories ─────────────────────────────────────────────────────────────────

@admin_only
async def cmd_memories(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    mems = await db_fetch(
        "SELECT contact_name, contact_username, interest_level, detected_language, last_message, last_message_at FROM conversation_memories ORDER BY last_message_at DESC NULLS LAST LIMIT 10"
    )
    if not mems:
        await update.message.reply_text("🧠 Aucune mémoire conversationnelle.", reply_markup=back_to_menu_kb())
        return

    lines = ["🧠 *Mémoires conversationnelles*\n"]
    for m in mems:
        name = m["contact_name"] or f"@{m['contact_username']}" or "Inconnu"
        lang = f"🌐 {m['detected_language']}" if m["detected_language"] else ""
        ts = m["last_message_at"].strftime("%d/%m") if m["last_message_at"] else ""
        preview = (m["last_message"] or "")[:50]
        lines.append(
            f"{fmt_status(m['interest_level'])} *{name}* {lang} `{ts}`\n"
            f"  _{preview}_\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /ab_tests ─────────────────────────────────────────────────────────────────

@admin_only
async def cmd_ab_tests(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    tests = await db_fetch(
        "SELECT name, status, sent_a, sent_b, replies_a, replies_b, reply_rate_a, reply_rate_b, winner_variant FROM ab_tests ORDER BY created_at DESC LIMIT 8"
    )
    if not tests:
        await update.message.reply_text("🧪 Aucun test A/B.", reply_markup=back_to_menu_kb())
        return

    lines = ["🧪 *Tests A/B*\n"]
    for t in tests:
        winner = f"🏆 Gagnant: Variante {t['winner_variant'].upper()}" if t["winner_variant"] else ""
        lines.append(
            f"{fmt_status(t['status'])} *{t['name']}*\n"
            f"  A: {t['sent_a']} envois, {t['replies_a']} réponses ({round(t['reply_rate_a']*100,1)}%)\n"
            f"  B: {t['sent_b']} envois, {t['replies_b']} réponses ({round(t['reply_rate_b']*100,1)}%)\n"
            f"  {winner}\n"
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /settings ─────────────────────────────────────────────────────────────────

@admin_only
async def cmd_settings(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    settings = await db_fetch("SELECT key, value, description FROM app_settings WHERE is_secret = false ORDER BY key LIMIT 20")
    if not settings:
        await update.message.reply_text("⚙️ Aucun paramètre configuré.", reply_markup=back_to_menu_kb())
        return

    lines = ["⚙️ *Paramètres système*\n"]
    for s in settings:
        desc = f" — _{s['description'][:50]}_" if s["description"] else ""
        lines.append(f"• `{s['key']}`: `{s['value'] or 'N/A'}`{desc}")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── /help ─────────────────────────────────────────────────────────────────────

@admin_only
async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    text = (
        "📖 *NEXUS AI — Toutes les commandes*\n\n"
        "━━━ 📊 SYSTÈME ━━━\n"
        "/start — Menu principal\n"
        "/stats — Statistiques globales\n"
        "/status — Statut du système\n"
        "/help — Cette aide\n\n"
        "━━━ 👤 COMPTES ━━━\n"
        "/accounts — Liste des comptes\n"
        "/connect `<phone>` — Connecter un compte\n"
        "/disconnect `<id>` — Déconnecter\n"
        "/health — Santé des comptes\n\n"
        "━━━ 📣 CAMPAGNES ━━━\n"
        "/campaigns — Liste des campagnes\n"
        "/start\\_campaign `<id>` — Démarrer\n"
        "/stop\\_campaign `<id>` — Arrêter\n\n"
        "━━━ 💬 MESSAGES ━━━\n"
        "/messages — 10 derniers messages\n"
        "/send `<acc> <chat> <msg>` — Envoyer\n"
        "/memories — Mémoires conversations\n\n"
        "━━━ 🤖 IA ━━━\n"
        "/generate `<type>` `<contexte>` — Générer\n"
        "/personalities — Personnalités IA\n"
        "/ab\\_tests — Tests A/B\n\n"
        "━━━ 👥 GROUPES ━━━\n"
        "/groups — Groupes surveillés\n"
        "/channels — Canaux\n\n"
        "━━━ 🎯 CRM ━━━\n"
        "/leads — Pipeline CRM\n\n"
        "━━━ 🛡 SÉCURITÉ ━━━\n"
        "/security — Dashboard sécurité\n"
        "/threats — Événements récents\n"
        "/ban `<@user> <raison>` — Bannir\n"
        "/sanctions — Sanctions actives\n"
        "/floodwait — Historique FloodWaits\n"
        "/escalations — En attente\n"
        "/resolve\\_escalation `<id>` — Résoudre\n\n"
        "━━━ ⚙️ SYSTÈME ━━━\n"
        "/proxies — Liste des proxies\n"
        "/schedules — Planifications\n"
        "/warmup — Plans de warmup\n"
        "/settings — Paramètres\n"
    )
    for chunk in chunk_text(text, 4000):
        await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


# ── Callback Query Handler ────────────────────────────────────────────────────

async def handle_callback(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        await query.edit_message_text("⛔ Accès refusé.")
        return

    # ── CRITICAL FIX ──────────────────────────────────────────────────────────
    # When a callback fires, update.message is None. Commands use
    # update.message.reply_text(...) and crash silently. Patch _message so
    # all command functions work when called from a callback context.
    try:
        update._message = query.message
    except Exception:
        pass
    # ──────────────────────────────────────────────────────────────────────────

    data = query.data

    if data == "main_menu":
        await query.edit_message_text("🏠 *Menu principal*", parse_mode=ParseMode.MARKDOWN, reply_markup=main_menu_kb())

    elif data == "stats":
        await query.delete_message()
        await _send_stats(query.message)

    elif data == "accounts":
        accounts = await db_fetch("SELECT id, phone_number, username, status, health_score, is_connected, messages_count FROM telegram_accounts ORDER BY id")
        if not accounts:
            await query.edit_message_text("👤 Aucun compte.\nAjoute un compte avec `/connect +33612345678`", parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())
        else:
            lines = ["👤 *Comptes Telegram*\n"]
            for a in accounts:
                name = a["username"] or a["phone_number"]
                lines.append(f"{fmt_health(a['health_score'])} *{name}* — {fmt_status(a['status'])}")
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=accounts_kb(list(accounts)))

    elif data.startswith("account_"):
        acc_id = int(data.split("_")[1])
        acc = await db_fetchrow("SELECT * FROM telegram_accounts WHERE id = $1", acc_id)
        if not acc:
            await query.edit_message_text("❌ Compte introuvable.", reply_markup=back_to_menu_kb())
            return
        name = acc["username"] or acc["phone_number"]
        text = (
            f"👤 *{name}*\n\n"
            f"📱 Téléphone: `{acc['phone_number']}`\n"
            f"🔗 Connecté: {'✅' if acc['is_connected'] else '❌'}\n"
            f"📊 Santé: {fmt_health(acc['health_score'])}\n"
            f"📌 Statut: {fmt_status(acc['status'])}\n"
            f"💬 Messages: `{acc['messages_count']}`\n"
            f"👥 Groupes: `{acc['groups_count']}`\n"
        )
        await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=account_detail_kb(acc_id, acc["is_connected"]))

    elif data.startswith("disconnect_"):
        acc_id = int(data.split("_")[1])
        await db_execute("UPDATE telegram_accounts SET is_connected = false, status = 'inactive' WHERE id = $1", acc_id)
        await query.edit_message_text(f"🔴 Compte `{acc_id}` déconnecté.", parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())

    elif data == "add_account" or data.startswith("connect_"):
        # connect_<acc_id> = reconnect existing | add_account = new connection
        if data.startswith("connect_") and data != "connect_":
            acc_id = int(data.split("_")[1])
            acc = await db_fetchrow("SELECT phone_number FROM telegram_accounts WHERE id = $1", acc_id)
            phone_hint = f"\n\n📱 Numéro du compte: `{acc['phone_number']}`" if acc else ""
        else:
            phone_hint = ""
        await query.edit_message_text(
            f"📱 *Connecter un compte Telegram*{phone_hint}\n\n"
            f"1️⃣ Tape: `/connect +<indicatif><numéro>`\n"
            f"   Exemple: `/connect +33612345678`\n\n"
            f"2️⃣ Reçois le code OTP sur Telegram\n\n"
            f"3️⃣ Valide avec: `/otp +numéro <code>`\n"
            f"   Exemple: `/otp +33612345678 12345`\n\n"
            f"Si tu as un mot de passe 2FA:\n"
            f"`/password +numéro <mot_de_passe>`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb()
        )

    elif data == "campaigns":
        campaigns = await db_fetch("SELECT id, name, status, messages_sent FROM campaigns ORDER BY created_at DESC")
        if not campaigns:
            await query.edit_message_text("📣 Aucune campagne.", reply_markup=back_to_menu_kb())
        else:
            lines = ["📣 *Campagnes*\n"]
            for c in campaigns:
                lines.append(f"{fmt_status(c['status'])} *{c['name']}* — {c['messages_sent']} msg")
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=campaigns_kb(list(campaigns)))

    elif data.startswith("campaign_"):
        camp_id = int(data.split("_")[1])
        c = await db_fetchrow("SELECT * FROM campaigns WHERE id = $1", camp_id)
        if not c:
            await query.edit_message_text("❌ Campagne introuvable.", reply_markup=back_to_menu_kb())
            return
        text = (
            f"📣 *{c['name']}*\n\n"
            f"📌 Statut: {fmt_status(c['status'])}\n"
            f"📤 Envoyés: `{c['messages_sent']}`\n"
            f"🔄 Intervalle: `{c['interval_hours'] or 'N/A'}h`\n"
            f"📝 Type: `{c['type']}`\n"
        )
        await query.edit_message_text(text, parse_mode=ParseMode.MARKDOWN, reply_markup=campaign_detail_kb(camp_id, c["status"]))

    elif data.startswith("start_campaign_"):
        camp_id = int(data.split("_")[2])
        await db_execute("UPDATE campaigns SET status = 'active' WHERE id = $1", camp_id)
        await query.edit_message_text(f"▶️ Campagne `{camp_id}` démarrée!", parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())

    elif data.startswith("stop_campaign_"):
        camp_id = int(data.split("_")[2])
        await db_execute("UPDATE campaigns SET status = 'paused' WHERE id = $1", camp_id)
        await query.edit_message_text(f"⏸ Campagne `{camp_id}` mise en pause.", parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())

    elif data == "groups":
        groups = await db_fetch("SELECT title, members_count, is_monitored, messages_count FROM telegram_groups ORDER BY members_count DESC NULLS LAST LIMIT 10")
        if not groups:
            await query.edit_message_text("👥 Aucun groupe.", reply_markup=back_to_menu_kb())
        else:
            lines = ["👥 *Groupes*\n"] + [f"📌 *{g['title']}* — 👥 {g['members_count'] or '?'} | 💬 {g['messages_count']}" for g in groups]
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())

    elif data == "security":
        await query.delete_message()
        await cmd_security(update, ctx)

    elif data == "sec_events":
        await query.delete_message()
        await cmd_threats(update, ctx)

    elif data == "sanctions":
        await query.delete_message()
        await cmd_sanctions(update, ctx)

    elif data == "floodwaits":
        await query.delete_message()
        await cmd_floodwait(update, ctx)

    elif data == "escalations":
        await query.delete_message()
        await cmd_escalations(update, ctx)

    elif data == "system":
        await query.edit_message_text("⚙️ *Système*", parse_mode=ParseMode.MARKDOWN, reply_markup=system_kb())

    elif data == "proxies":
        await query.delete_message()
        await cmd_proxies(update, ctx)

    elif data == "schedules":
        await query.delete_message()
        await cmd_schedules(update, ctx)

    elif data == "warmups":
        await query.delete_message()
        await cmd_warmup(update, ctx)

    elif data == "settings":
        await query.delete_message()
        await cmd_settings(update, ctx)

    elif data == "ai_menu":
        await query.edit_message_text("🤖 *Moteur IA*", parse_mode=ParseMode.MARKDOWN, reply_markup=ai_menu_kb())

    elif data == "personalities":
        await query.delete_message()
        await cmd_personalities(update, ctx)

    elif data == "ai_logs":
        logs = await db_fetch("SELECT action, model, success, tokens_used, created_at FROM ai_logs ORDER BY created_at DESC LIMIT 10")
        if not logs:
            await query.edit_message_text("📋 Aucun log IA.", reply_markup=back_to_menu_kb())
        else:
            lines = ["📋 *Logs IA*\n"]
            for l in logs:
                ok = "✅" if l["success"] else "❌"
                ts = l["created_at"].strftime("%d/%m %H:%M") if l["created_at"] else ""
                lines.append(f"{ok} `{l['action']}` ({l['model']}) — {l['tokens_used'] or 0} tokens `{ts}`")
            await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())

    elif data == "ab_tests":
        await query.delete_message()
        await cmd_ab_tests(update, ctx)

    elif data == "leads":
        await query.delete_message()
        await cmd_leads(update, ctx)

    elif data.startswith("leads_"):
        stage_map = {"leads_cold": "cold", "leads_warm": "warm", "leads_hot": "hot", "leads_converted": "converted"}
        if data == "leads_pipeline":
            await query.delete_message()
            await cmd_leads(update, ctx)
        else:
            stage = stage_map.get(data, "cold")
            leads = await db_fetch(
                "SELECT contact_name, contact_username, message_count, notes FROM leads WHERE stage = $1 ORDER BY last_contact_at DESC NULLS LAST LIMIT 10",
                stage
            )
            if not leads:
                await query.edit_message_text(f"Aucun lead en stage `{stage}`.", reply_markup=leads_kb())
            else:
                lines = [f"🎯 *Leads — {fmt_status(stage)}*\n"]
                for l in leads:
                    name = l["contact_name"] or f"@{l['contact_username']}" or "Inconnu"
                    lines.append(f"• *{name}* — 💬 {l['message_count']} msg")
                await query.edit_message_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=leads_kb())

    elif data == "messages":
        await query.delete_message()
        await cmd_messages(update, ctx)

    elif data == "gen_prompt":
        await query.edit_message_text(
            "🤖 *Générer un message IA*\n\n"
            "Utilise la commande:\n`/generate <type> <contexte>`\n\n"
            "Types: `motivation` | `crypto` | `welcome` | `general`\n\n"
            "Exemple:\n`/generate crypto Bitcoin vient de toucher un ATH`",
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=back_to_menu_kb()
        )

    elif data.startswith("health_"):
        acc_id = int(data.split("_")[1])
        acc = await db_fetchrow("SELECT health_score, status, messages_count FROM telegram_accounts WHERE id = $1", acc_id)
        if acc:
            bar = "█" * (acc["health_score"] // 10) + "░" * (10 - acc["health_score"] // 10)
            events = await db_fetchval("SELECT COUNT(*) FROM security_logs WHERE account_id = $1 AND created_at > NOW() - INTERVAL '24 hours'", acc_id)
            await query.edit_message_text(
                f"🏥 *Santé du compte #{acc_id}*\n\n"
                f"Score: {fmt_health(acc['health_score'])}\n"
                f"`{bar}`\n"
                f"Statut: {fmt_status(acc['status'])}\n"
                f"Messages: `{acc['messages_count']}`\n"
                f"Événements 24h: `{events}`",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=back_to_menu_kb()
            )

    elif data.startswith("warmup_"):
        acc_id = int(data.split("_")[1])
        w = await db_fetchrow("SELECT * FROM warmup_plans WHERE account_id = $1 ORDER BY id DESC LIMIT 1", acc_id)
        if not w:
            await query.edit_message_text(f"🔥 Aucun plan de warmup pour le compte #{acc_id}.", reply_markup=back_to_menu_kb())
        else:
            progress = int((w["current_day"] / w["total_days"]) * 10) if w["total_days"] else 0
            bar = "🟧" * progress + "⬜" * (10 - progress)
            await query.edit_message_text(
                f"🔥 *Warmup — Compte #{acc_id}*\n\n"
                f"Statut: {fmt_status(w['status'])}\n"
                f"Progression: Jour `{w['current_day']}/{w['total_days']}`\n"
                f"{bar}\n"
                f"Aujourd'hui: `{w['today_count']}/{w['today_limit']}` messages\n"
                f"Type: `{w['growth_type']}`",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=back_to_menu_kb()
            )

    elif data.startswith("postnow_"):
        parts = data.split("_")
        acc_id = int(parts[1])
        chat_id = parts[2]
        try:
            from .autonomous import trigger_post_now
            await trigger_post_now(acc_id, chat_id, with_image=True)
            await query.edit_message_text(
                "✅ Post généré et envoyé avec succès!",
                reply_markup=back_to_menu_kb()
            )
        except Exception as e:
            await query.edit_message_text(
                f"❌ Erreur: {e}\n\nVéifie que le compte est connecté et l'engine actif.",
                reply_markup=back_to_menu_kb()
            )

    elif data.startswith("autopost_toggle_"):
        chan_id = data.split("_")[2]
        row = await db_fetchrow("SELECT is_auto_post, title FROM telegram_channels WHERE telegram_id = $1", chan_id)
        if row:
            new_val = not row["is_auto_post"]
            await db_execute("UPDATE telegram_channels SET is_auto_post = $1 WHERE telegram_id = $2", new_val, chan_id)
            state = "✅ activé" if new_val else "⏹ désactivé"
            await query.edit_message_text(
                f"📢 *{row['title']}*\n\nAuto-post {state}.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=back_to_menu_kb()
            )

    elif data.startswith("autoreply_toggle_"):
        grp_id = data.split("_")[2]
        row = await db_fetchrow("SELECT is_auto_reply, title FROM telegram_groups WHERE telegram_id = $1", grp_id)
        if row:
            new_val = not row["is_auto_reply"]
            await db_execute("UPDATE telegram_groups SET is_auto_reply = $1 WHERE telegram_id = $2", new_val, grp_id)
            state = "✅ activé" if new_val else "⏹ désactivé"
            await query.edit_message_text(
                f"👥 *{row['title']}*\n\nAuto-réponse {state}.",
                parse_mode=ParseMode.MARKDOWN,
                reply_markup=back_to_menu_kb()
            )


# ── /autonomous ────────────────────────────────────────────────────────────────

@admin_only
async def cmd_autonomous(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Dashboard de l'engine autonome."""
    accounts = await db_fetch(
        """SELECT id, phone_number, status, health_score, is_connected
           FROM telegram_accounts WHERE status != 'banned' ORDER BY id"""
    )
    channels = await db_fetch(
        "SELECT telegram_id, title, is_auto_post, account_id FROM telegram_channels ORDER BY title"
    )
    groups = await db_fetch(
        "SELECT telegram_id, title, is_auto_reply, account_id FROM telegram_groups ORDER BY title"
    )

    lines = ["🤖 *Engine Autonome — Vue d'ensemble*\n"]

    # Accounts
    lines.append(f"👤 *Comptes actifs: {len(accounts)}*")
    for a in accounts[:5]:
        connected = "🟢" if a["is_connected"] else "🔴"
        lines.append(f"  {connected} #{a['id']} `{a['phone_number']}` — {fmt_health(a['health_score'])}")
    if len(accounts) > 5:
        lines.append(f"  _...et {len(accounts)-5} autres_")

    # Channels auto-post
    auto_channels = [c for c in channels if c["is_auto_post"]]
    lines.append(f"\n📢 *Canaux en auto-post: {len(auto_channels)}/{len(channels)}*")
    for c in auto_channels[:5]:
        lines.append(f"  ✅ {c['title']}")

    # Groups auto-reply
    auto_groups = [g for g in groups if g["is_auto_reply"]]
    lines.append(f"\n👥 *Groupes en auto-réponse: {len(auto_groups)}/{len(groups)}*")
    for g in auto_groups[:5]:
        lines.append(f"  ✅ {g['title']}")

    lines.append("\n📌 Commandes disponibles:")
    lines.append("`/post_now <account_id> <chat_id>` — Forcer un post maintenant")
    lines.append("`/autopost <channel_tg_id>` — Toggle auto-post canal")
    lines.append("`/autoreply <group_tg_id>` — Toggle auto-réponse groupe")
    lines.append("`/generate_image <description>` — Générer une image IA")

    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


@admin_only
async def cmd_post_now(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Forcer un post IA immédiat: /post_now <account_id> <chat_id>"""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/post_now <account_id> <chat_id>`\n\nExemple: `/post_now 1 -1001234567890`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    try:
        acc_id  = int(args[0])
        chat_id = args[1]
    except ValueError:
        await update.message.reply_text("❌ account_id doit être un nombre.")
        return

    with_image = "--no-image" not in (ctx.args or [])
    with_video = "--video" in (ctx.args or [])

    msg = await update.message.reply_text("⏳ Génération du post en cours...")
    try:
        from .autonomous import trigger_post_now
        await trigger_post_now(acc_id, chat_id, with_image=with_image, with_video=with_video)
        await msg.edit_text(
            f"✅ Post envoyé!\n📢 Chat: `{chat_id}`\n🖼 Image: {'oui' if with_image else 'non'}\n📹 Vidéo: {'oui' if with_video else 'non'}",
            parse_mode=ParseMode.MARKDOWN
        )
    except Exception as e:
        await msg.edit_text(f"❌ Erreur: `{e}`\n\nVérifie que le compte est connecté (engine actif).", parse_mode=ParseMode.MARKDOWN)


@admin_only
async def cmd_autopost(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Toggle auto-post sur un canal: /autopost <channel_tg_id>"""
    args = ctx.args or []
    if not args:
        # List all channels with their state
        channels = await db_fetch(
            "SELECT telegram_id, title, is_auto_post FROM telegram_channels ORDER BY title"
        )
        if not channels:
            await update.message.reply_text(
                "📢 Aucun canal enregistré.\nLes canaux apparaissent automatiquement quand un compte les rejoint.",
                reply_markup=back_to_menu_kb()
            )
            return
        lines = ["📢 *Auto-post par canal* (toggle: `/autopost <id>`)\n"]
        for c in channels:
            state = "✅" if c["is_auto_post"] else "⏹"
            lines.append(f"{state} `{c['telegram_id']}` — {c['title']}")
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())
        return

    tg_id = args[0]
    row = await db_fetchrow("SELECT is_auto_post, title FROM telegram_channels WHERE telegram_id = $1", tg_id)
    if not row:
        await update.message.reply_text(f"❌ Canal `{tg_id}` non trouvé.", parse_mode=ParseMode.MARKDOWN)
        return
    new_val = not row["is_auto_post"]
    await db_execute("UPDATE telegram_channels SET is_auto_post = $1 WHERE telegram_id = $2", new_val, tg_id)
    state = "✅ activé" if new_val else "⏹ désactivé"
    await update.message.reply_text(
        f"📢 *{row['title']}*\n\nAuto-post {state}.\nL'engine publiera automatiquement toutes les 1–4h.",
        parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


@admin_only
async def cmd_autoreply(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Toggle auto-réponse sur un groupe: /autoreply <group_tg_id>"""
    args = ctx.args or []
    if not args:
        groups = await db_fetch(
            "SELECT telegram_id, title, is_auto_reply FROM telegram_groups ORDER BY title"
        )
        if not groups:
            await update.message.reply_text(
                "👥 Aucun groupe enregistré.\nLes groupes apparaissent automatiquement quand un compte les rejoint.",
                reply_markup=back_to_menu_kb()
            )
            return
        lines = ["👥 *Auto-réponse par groupe* (toggle: `/autoreply <id>`)\n"]
        for g in groups:
            state = "✅" if g["is_auto_reply"] else "⏹"
            lines.append(f"{state} `{g['telegram_id']}` — {g['title']}")
        await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())
        return

    tg_id = args[0]
    row = await db_fetchrow("SELECT is_auto_reply, title FROM telegram_groups WHERE telegram_id = $1", tg_id)
    if not row:
        await update.message.reply_text(f"❌ Groupe `{tg_id}` non trouvé.", parse_mode=ParseMode.MARKDOWN)
        return
    new_val = not row["is_auto_reply"]
    await db_execute("UPDATE telegram_groups SET is_auto_reply = $1 WHERE telegram_id = $2", new_val, tg_id)
    state = "✅ activé" if new_val else "⏹ désactivé"
    await update.message.reply_text(
        f"👥 *{row['title']}*\n\nAuto-réponse {state}.\nLe bot répondra aux mentions dans ce groupe.",
        parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


@admin_only
async def cmd_generate_image(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """Générer une image IA: /generate_image <description>"""
    args = ctx.args or []
    if not args:
        await update.message.reply_text(
            "❌ Usage: `/generate_image <description>`\n\nExemple:\n`/generate_image Un coucher de soleil sur Paris avec des reflets dorés`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    prompt = " ".join(args)
    msg = await update.message.reply_text(f"🎨 Génération en cours...\n`{prompt}`", parse_mode=ParseMode.MARKDOWN)

    try:
        from .content_gen import generate_image
        img_bytes = await generate_image(prompt)
        if img_bytes:
            await update.message.reply_photo(photo=img_bytes, caption=f"🎨 *Image générée*\n\n{prompt}", parse_mode=ParseMode.MARKDOWN)
            await msg.delete()
        else:
            await msg.edit_text("❌ Génération d'image échouée. Vérifiez OPENAI_API_KEY.")
    except Exception as e:
        await msg.edit_text(f"❌ Erreur: `{e}`", parse_mode=ParseMode.MARKDOWN)


# ── Persona commands ───────────────────────────────────────────────────────────

@admin_only
async def cmd_persona_list(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/persona_list — Affiche toutes les personnalités disponibles + actives par chat."""
    from .personality import list_available_personas, load_persona

    lines = [list_available_personas(), "\n"]

    # Show active personas for known groups/channels
    groups   = await db_fetch("SELECT telegram_id, title FROM telegram_groups ORDER BY title LIMIT 10")
    channels = await db_fetch("SELECT telegram_id, title FROM telegram_channels ORDER BY title LIMIT 10")

    if groups or channels:
        lines.append("🗂 *Personnalités actives:*\n")
        from .utils import get_pool
        pool = await get_pool()
        for g in groups:
            p = await load_persona(pool, "group", g["telegram_id"])
            icon = f"🎭 {p['name']}" if p else "❓ non définie"
            lines.append(f"👥 {g['title'][:25]} → {icon}")
        for c in channels:
            p = await load_persona(pool, "channel", c["telegram_id"])
            icon = f"🎭 {p['name']}" if p else "❓ non définie"
            lines.append(f"📢 {c['title'][:25]} → {icon}")

    lines.append("\n📌 Pour changer: `/persona_set group <id> <type>`")
    lines.append("Types: `crypto` `motivational` `news` `business` `sport` `tech` `lifestyle` `community` `religious` `education`")

    for chunk in chunk_text("\n".join(lines), 4000):
        await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_persona_view(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/persona_view <group|channel> <telegram_id> — Voir la persona d'un chat."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/persona_view <group|channel> <telegram_id>`\n\nExemple:\n`/persona_view channel -1001234567890`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_type, tg_id = args[0].lower(), args[1]
    if chat_type not in ("group", "channel"):
        await update.message.reply_text("❌ Type doit être `group` ou `channel`.", parse_mode=ParseMode.MARKDOWN)
        return

    from .personality import load_persona, format_persona_card
    from .utils import get_pool
    pool = await get_pool()
    persona = await load_persona(pool, chat_type, tg_id)

    if not persona:
        await update.message.reply_text(
            f"❓ Aucune personnalité définie pour ce {chat_type}.\n"
            f"Elle sera créée automatiquement lors du prochain post.\n"
            f"Ou utilise `/persona_set {chat_type} {tg_id} <type>` pour en définir une maintenant.",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    title_row = await db_fetchrow(
        f"SELECT title FROM telegram_{'groups' if chat_type == 'group' else 'channels'} WHERE telegram_id = $1", tg_id
    )
    title = title_row["title"] if title_row else tg_id
    card = format_persona_card(persona, title=title, tg_id=tg_id)
    await update.message.reply_text(card, parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_persona_set(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/persona_set <group|channel> <telegram_id> <type> — Définir une persona."""
    args = ctx.args or []
    if len(args) < 3:
        await update.message.reply_text(
            "❌ Usage: `/persona_set <group|channel> <telegram_id> <type>`\n\n"
            "Exemple:\n`/persona_set channel -1001234567890 crypto`\n\n"
            "Types disponibles: `crypto` `motivational` `news` `business` `sport` `tech` `lifestyle` `community` `religious` `education`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_type, tg_id, persona_type = args[0].lower(), args[1], args[2].lower()
    if chat_type not in ("group", "channel"):
        await update.message.reply_text("❌ Type doit être `group` ou `channel`.", parse_mode=ParseMode.MARKDOWN)
        return

    from .personality import BUILT_IN, save_persona, format_persona_card
    from .utils import get_pool

    if persona_type not in BUILT_IN:
        types = ", ".join(f"`{k}`" for k in BUILT_IN)
        await update.message.reply_text(
            f"❌ Type inconnu. Disponibles: {types}", parse_mode=ParseMode.MARKDOWN
        )
        return

    pool = await get_pool()
    persona = BUILT_IN[persona_type].copy()
    persona["topic"] = persona_type
    persona["language"] = "fr"
    persona["content_ideas"] = []

    await save_persona(pool, chat_type, tg_id, persona)

    title_row = await db_fetchrow(
        f"SELECT title FROM telegram_{'groups' if chat_type == 'group' else 'channels'} WHERE telegram_id = $1", tg_id
    )
    title = title_row["title"] if title_row else tg_id
    card = format_persona_card(persona, title=title, tg_id=tg_id)

    await update.message.reply_text(
        f"✅ *Personnalité mise à jour!*\n\n{card}\n\n"
        f"Le prochain post utilisera cette personnalité automatiquement.",
        parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


@admin_only
async def cmd_persona_reset(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/persona_reset <group|channel> <telegram_id> — Supprimer la persona (sera recréée auto)."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/persona_reset <group|channel> <telegram_id>`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_type, tg_id = args[0].lower(), args[1]
    from .personality import delete_persona
    from .utils import get_pool
    pool = await get_pool()
    await delete_persona(pool, chat_type, tg_id)
    await update.message.reply_text(
        f"🗑 Personnalité supprimée pour `{tg_id}`.\n"
        "Elle sera auto-détectée lors du prochain post.",
        parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


# ── Community Intelligence Commands ───────────────────────────────────────────

@admin_only
async def cmd_mission(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/mission <group|channel> <telegram_id> — Voir le profil complet d'une communauté."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "❌ Usage: `/mission <group|channel> <telegram_id>`\n\n"
            "Exemple: `/mission channel -1001234567890`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_type, tg_id = args[0].lower(), args[1]
    if chat_type not in ("group", "channel"):
        await update.message.reply_text("❌ Type doit être `group` ou `channel`.", parse_mode=ParseMode.MARKDOWN)
        return

    from .community_intel import load_profile, format_profile_card
    from .utils import get_pool
    pool = await get_pool()
    profile = await load_profile(pool, chat_type, tg_id)

    if not profile:
        await update.message.reply_text(
            f"❓ Aucun profil communautaire pour ce {chat_type}.\n"
            "Il sera créé automatiquement lors du prochain post ou join.\n\n"
            f"Pour le créer maintenant: `/mission_scan {chat_type} {tg_id}`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    card = format_profile_card(profile)
    for chunk in chunk_text(card, 4000):
        await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_mission_list(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/mission_list — Voir tous les profils communautaires actifs."""
    from .community_intel import load_profile, COMMUNITY_TYPES
    from .utils import get_pool
    pool = await get_pool()

    groups   = await db_fetch("SELECT telegram_id, title FROM telegram_groups ORDER BY title LIMIT 15")
    channels = await db_fetch("SELECT telegram_id, title FROM telegram_channels ORDER BY title LIMIT 15")

    if not groups and not channels:
        await update.message.reply_text(
            "📭 Aucun groupe/canal enregistré.\nRejoins d'abord des groupes avec un compte.",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    lines = ["🌐 *Profils communautaires actifs*\n"]
    type_icons = {
        "crypto": "🪙", "finance": "💰", "business": "💼", "marketing": "📣",
        "politics": "🏛", "technology": "💻", "ai": "🤖", "education": "📚",
        "health": "❤️", "sports": "⚽", "entertainment": "🎬", "religion": "🕌",
        "realestate": "🏠", "ecommerce": "🛒", "investment": "📈",
        "startups": "🚀", "gaming": "🎮", "science": "🔬", "news": "📰",
        "lifestyle": "✨", "motivational": "💪", "community": "🤝",
    }

    if groups:
        lines.append("👥 *Groupes:*")
        for g in groups:
            p = await load_profile(pool, "group", g["telegram_id"])
            if p:
                icon = type_icons.get(p.community_type, "🌐")
                lang_flag = {"fr": "🇫🇷", "en": "🇬🇧", "ar": "🇸🇦", "es": "🇪🇸", "pt": "🇧🇷"}.get(p.language, "🌍")
                lines.append(f"  {icon} {g['title'][:25]} → `{p.community_type}` {lang_flag} ({p.total_posts} posts)")
            else:
                lines.append(f"  ❓ {g['title'][:25]} → non analysé")

    if channels:
        lines.append("\n📢 *Canaux:*")
        for c in channels:
            p = await load_profile(pool, "channel", c["telegram_id"])
            if p:
                icon = type_icons.get(p.community_type, "🌐")
                lang_flag = {"fr": "🇫🇷", "en": "🇬🇧", "ar": "🇸🇦", "es": "🇪🇸", "pt": "🇧🇷"}.get(p.language, "🌍")
                lines.append(f"  {icon} {c['title'][:25]} → `{p.community_type}` {lang_flag} ({p.total_posts} posts)")
            else:
                lines.append(f"  ❓ {c['title'][:25]} → non analysé")

    lines.append(f"\n📌 Détails: `/mission <group|channel> <id>`")
    lines.append(f"⚙️ Configurer: `/community_config <group|channel> <id>`")

    for chunk in chunk_text("\n".join(lines), 4000):
        await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb())


@admin_only
async def cmd_community_config(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/community_config <group|channel> <tg_id> [clé=valeur ...] — Configurer une communauté."""
    args = ctx.args or []
    if len(args) < 2:
        await update.message.reply_text(
            "⚙️ *Configuration communautaire*\n\n"
            "Usage: `/community_config <group|channel> <telegram_id> [options]`\n\n"
            "Options disponibles:\n"
            "• `type=crypto` — forcer un type de communauté\n"
            "• `lang=fr` — langue principale (fr/en/ar/es/pt)\n"
            "• `tone=professional` — ton (casual/professional/news/crypto/motivational)\n"
            "• `frequency=daily` — fréquence (hourly/daily/weekly)\n"
            "• `audience=expert` — audience (general/expert/beginner/mixed)\n"
            "• `instructions=Évite la politique` — instructions personnalisées\n"
            "• `forbidden=politique,religion` — sujets interdits (séparés par ,)\n\n"
            "Exemple:\n"
            "`/community_config channel -1001234 type=crypto lang=fr tone=casual frequency=daily`\n\n"
            "Pour voir la config actuelle: `/mission channel <id>`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    chat_type, tg_id = args[0].lower(), args[1]
    if chat_type not in ("group", "channel"):
        await update.message.reply_text("❌ Type doit être `group` ou `channel`.", parse_mode=ParseMode.MARKDOWN)
        return

    # Parse key=value options
    config: dict = {}
    valid_keys = {"type": "community_type", "lang": "language", "tone": "tone",
                  "frequency": "posting_frequency", "audience": "audience_type",
                  "instructions": "instructions", "forbidden": "forbidden_topics"}

    for arg in args[2:]:
        if "=" in arg:
            k, _, v = arg.partition("=")
            k = k.strip().lower()
            v = v.strip()
            if k in valid_keys:
                mapped = valid_keys[k]
                if mapped == "forbidden_topics":
                    config[mapped] = [x.strip() for x in v.split(",")]
                else:
                    config[mapped] = v

    if not config:
        await update.message.reply_text(
            "❌ Aucune option valide fournie.\nUtilise `/community_config` sans arguments pour voir les options.",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    from .community_intel import save_admin_config, load_profile, save_profile
    from .utils import get_pool
    pool = await get_pool()

    # Save admin config
    await save_admin_config(pool, chat_type, tg_id, config)

    # If profile exists, update it directly
    profile = await load_profile(pool, chat_type, tg_id)
    if profile:
        if "community_type" in config:
            from .community_intel import COMMUNITY_TYPES
            profile.community_type = config["community_type"]
            profile.community_type_label = COMMUNITY_TYPES.get(config["community_type"], config["community_type"])
        if "language" in config:
            profile.language = config["language"]
        if "tone" in config:
            profile.tone = config["tone"]
        if "posting_frequency" in config:
            profile.posting_frequency = config["posting_frequency"]
        if "audience_type" in config:
            profile.audience_type = config["audience_type"]
        if "instructions" in config:
            profile.admin_instructions = config["instructions"]
        if "forbidden_topics" in config:
            profile.forbidden_topics = config["forbidden_topics"]
        await save_profile(pool, profile)

    lines = [f"✅ *Configuration mise à jour pour `{tg_id}`*\n"]
    for k, v in config.items():
        lines.append(f"• `{k}`: `{v}`")
    lines.append(f"\nVoir le profil complet: `/mission {chat_type} {tg_id}`")

    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )


@admin_only
async def cmd_realtime(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/realtime <crypto|news|finance> [langue] — Récupérer des données en temps réel."""
    args = ctx.args or []
    if not args:
        await update.message.reply_text(
            "📡 *Données en temps réel*\n\n"
            "Usage: `/realtime <type> [langue]`\n\n"
            "Types disponibles:\n"
            "• `/realtime crypto` — prix des cryptos\n"
            "• `/realtime news fr` — actualités en français\n"
            "• `/realtime news en` — news in English\n"
            "• `/realtime news ar` — أخبار عربية\n"
            "• `/realtime finance` — marchés financiers\n"
            "• `/realtime sports fr` — actualités sportives\n"
            "• `/realtime tech` — actualités tech",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    topic = args[0].lower()
    lang = args[1].lower() if len(args) > 1 else "fr"

    msg = await update.message.reply_text(f"📡 Récupération en cours...", parse_mode=ParseMode.MARKDOWN)

    try:
        from .realtime_intel import (
            get_crypto_prices, format_crypto_update,
            get_latest_news, format_news_bulletin,
        )

        if topic == "crypto":
            prices = await get_crypto_prices(["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "MATIC", "TON"])
            if prices:
                text = format_crypto_update(prices, lang)
                text += f"\n\n_Source: CoinGecko • Mis à jour maintenant_"
                await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN)
            else:
                await msg.edit_text("❌ Impossible de récupérer les prix crypto.", parse_mode=ParseMode.MARKDOWN)

        else:
            news = await get_latest_news(topic, lang, max_items=7)
            if news:
                text = format_news_bulletin(news, topic, lang)
                links = "\n".join([f"• [{item['title'][:50]}]({item['link']})" for item in news if item.get('link')][:5])
                if links:
                    text += f"\n\n🔗 *Liens:*\n{links}"
                await msg.edit_text(text, parse_mode=ParseMode.MARKDOWN, disable_web_page_preview=True)
            else:
                await msg.edit_text(
                    f"❌ Aucune actualité trouvée pour `{topic}` en `{lang}`.\n"
                    "Essaie: `/realtime news fr` ou `/realtime crypto`",
                    parse_mode=ParseMode.MARKDOWN
                )

    except Exception as e:
        await msg.edit_text(f"❌ Erreur: `{e}`", parse_mode=ParseMode.MARKDOWN)


@admin_only
async def cmd_community_types(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    """/community_types — Liste tous les types de communautés supportés."""
    from .community_intel import COMMUNITY_TYPES
    icons = {
        "crypto": "🪙", "finance": "💰", "business": "💼", "marketing": "📣",
        "politics": "🏛", "technology": "💻", "ai": "🤖", "education": "📚",
        "health": "❤️", "sports": "⚽", "entertainment": "🎬", "religion": "🕌",
        "realestate": "🏠", "ecommerce": "🛒", "investment": "📈",
        "startups": "🚀", "gaming": "🎮", "science": "🔬", "news": "📰",
        "lifestyle": "✨", "motivational": "💪", "community": "🤝",
    }
    lines = ["🌐 *22 Types de communautés supportés*\n"]
    for key, label in COMMUNITY_TYPES.items():
        icon = icons.get(key, "•")
        lines.append(f"{icon} `{key}` — {label}")
    lines += [
        "",
        "💡 *Fonctionnement automatique:*",
        "• Le bot analyse le titre, la description et les messages",
        "• Il détecte automatiquement le type et la langue",
        "• Il génère une mission personnalisée par IA",
        "• Le contenu s'adapte en temps réel (prix crypto, news)",
        "",
        "⚙️ Pour forcer un type: `/community_config <group|channel> <id> type=crypto`",
    ]
    await update.message.reply_text(
        "\n".join(lines), parse_mode=ParseMode.MARKDOWN, reply_markup=back_to_menu_kb()
    )
