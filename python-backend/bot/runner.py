from __future__ import annotations
import logging
import os
from telegram import BotCommand
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler
)
from .commands import (
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
    # Account connection commands
    cmd_otp, cmd_password,
    # Autonomous engine commands
    cmd_autonomous, cmd_post_now, cmd_autopost, cmd_autoreply, cmd_generate_image,
    # Persona commands
    cmd_persona_list, cmd_persona_view, cmd_persona_set, cmd_persona_reset,
    # Community Intelligence commands
    cmd_mission, cmd_mission_list, cmd_community_config, cmd_realtime, cmd_community_types,
    handle_callback,
)

logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

COMMANDS = [
    BotCommand("start", "Menu principal"),
    BotCommand("stats", "Statistiques globales"),
    BotCommand("status", "Statut du système"),
    BotCommand("accounts", "Gérer les comptes Telegram"),
    BotCommand("connect", "Connecter un compte: /connect +33612345678"),
    BotCommand("otp", "Valider OTP: /otp +33612345678 12345"),
    BotCommand("password", "2FA: /password +33612345678 <motdepasse>"),
    BotCommand("disconnect", "Déconnecter: /disconnect <id>"),
    BotCommand("health", "Santé des comptes"),
    BotCommand("campaigns", "Liste des campagnes"),
    BotCommand("start_campaign", "Démarrer une campagne: /start_campaign <id>"),
    BotCommand("stop_campaign", "Arrêter une campagne: /stop_campaign <id>"),
    BotCommand("groups", "Groupes surveillés"),
    BotCommand("channels", "Canaux"),
    BotCommand("messages", "10 derniers messages"),
    BotCommand("send", "Envoyer: /send <acc_id> <chat> <message>"),
    BotCommand("generate", "Générer contenu IA: /generate <type> <contexte>"),
    BotCommand("trust", "Fact-check un texte: /trust <texte à analyser>"),
    BotCommand("personalities", "Personnalités IA"),
    BotCommand("ab_tests", "Tests A/B"),
    BotCommand("leads", "Pipeline CRM"),
    BotCommand("security", "Dashboard sécurité"),
    BotCommand("threats", "Événements sécurité récents"),
    BotCommand("ban", "Bannir: /ban @username <raison>"),
    BotCommand("sanctions", "Sanctions actives"),
    BotCommand("floodwait", "Historique FloodWaits"),
    BotCommand("escalations", "Escalations en attente"),
    BotCommand("resolve_escalation", "Résoudre: /resolve_escalation <id>"),
    BotCommand("proxies", "Liste des proxies"),
    BotCommand("schedules", "Planifications cron"),
    BotCommand("warmup", "Plans de warmup"),
    BotCommand("memories", "Mémoires conversationnelles"),
    BotCommand("settings", "Paramètres système"),
    BotCommand("help", "Toutes les commandes"),
    # Autonomous engine
    BotCommand("autonomous", "Dashboard engine autonome"),
    BotCommand("post_now", "Forcer un post IA: /post_now <acc_id> <chat_id>"),
    BotCommand("autopost", "Toggle auto-post canal: /autopost <channel_id>"),
    BotCommand("autoreply", "Toggle auto-réponse groupe: /autoreply <group_id>"),
    BotCommand("generate_image", "Générer une image IA: /generate_image <desc>"),
    # Personas
    BotCommand("persona_list", "Toutes les personnalités actives"),
    BotCommand("persona_view", "Voir persona: /persona_view <group|channel> <id>"),
    BotCommand("persona_set", "Définir persona: /persona_set <type> <chat> <id>"),
    BotCommand("persona_reset", "Réinitialiser: /persona_reset <group|channel> <id>"),
    # Community Intelligence
    BotCommand("mission", "Profil communautaire: /mission <group|channel> <id>"),
    BotCommand("mission_list", "Tous les profils communautaires actifs"),
    BotCommand("community_config", "Configurer: /community_config <type> <id> [options]"),
    BotCommand("community_types", "22 types de communautés supportés"),
    BotCommand("realtime", "Données temps réel: /realtime <crypto|news|finance> [lang]"),
]


async def build_app() -> Application:
    if not BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN non configuré")

    app = Application.builder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("menu", cmd_menu))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("stats", cmd_stats))

    app.add_handler(CommandHandler("accounts", cmd_accounts))
    app.add_handler(CommandHandler("connect", cmd_connect))
    app.add_handler(CommandHandler("otp", cmd_otp))
    app.add_handler(CommandHandler("password", cmd_password))
    app.add_handler(CommandHandler("disconnect", cmd_disconnect))
    app.add_handler(CommandHandler("health", cmd_health))

    app.add_handler(CommandHandler("campaigns", cmd_campaigns))
    app.add_handler(CommandHandler("start_campaign", cmd_start_campaign))
    app.add_handler(CommandHandler("stop_campaign", cmd_stop_campaign))

    app.add_handler(CommandHandler("groups", cmd_groups))
    app.add_handler(CommandHandler("channels", cmd_channels))

    app.add_handler(CommandHandler("messages", cmd_messages))
    app.add_handler(CommandHandler("send", cmd_send))

    app.add_handler(CommandHandler("generate", cmd_generate))
    app.add_handler(CommandHandler("trust", cmd_trust))
    app.add_handler(CommandHandler("personalities", cmd_personalities))
    app.add_handler(CommandHandler("ab_tests", cmd_ab_tests))

    app.add_handler(CommandHandler("leads", cmd_leads))

    app.add_handler(CommandHandler("security", cmd_security))
    app.add_handler(CommandHandler("threats", cmd_threats))
    app.add_handler(CommandHandler("ban", cmd_ban))
    app.add_handler(CommandHandler("sanctions", cmd_sanctions))
    app.add_handler(CommandHandler("floodwait", cmd_floodwait))
    app.add_handler(CommandHandler("escalations", cmd_escalations))
    app.add_handler(CommandHandler("resolve_escalation", cmd_resolve_escalation))

    app.add_handler(CommandHandler("proxies", cmd_proxies))
    app.add_handler(CommandHandler("schedules", cmd_schedules))
    app.add_handler(CommandHandler("warmup", cmd_warmup))
    app.add_handler(CommandHandler("memories", cmd_memories))
    app.add_handler(CommandHandler("settings", cmd_settings))
    app.add_handler(CommandHandler("help", cmd_help))

    # Autonomous engine commands
    app.add_handler(CommandHandler("autonomous", cmd_autonomous))
    app.add_handler(CommandHandler("post_now", cmd_post_now))
    app.add_handler(CommandHandler("autopost", cmd_autopost))
    app.add_handler(CommandHandler("autoreply", cmd_autoreply))
    app.add_handler(CommandHandler("generate_image", cmd_generate_image))

    # Persona commands
    app.add_handler(CommandHandler("persona_list", cmd_persona_list))
    app.add_handler(CommandHandler("persona_view", cmd_persona_view))
    app.add_handler(CommandHandler("persona_set", cmd_persona_set))
    app.add_handler(CommandHandler("persona_reset", cmd_persona_reset))

    # Community Intelligence commands
    app.add_handler(CommandHandler("mission", cmd_mission))
    app.add_handler(CommandHandler("mission_list", cmd_mission_list))
    app.add_handler(CommandHandler("community_config", cmd_community_config))
    app.add_handler(CommandHandler("community_types", cmd_community_types))
    app.add_handler(CommandHandler("realtime", cmd_realtime))

    app.add_handler(CallbackQueryHandler(handle_callback))

    await app.bot.set_my_commands(COMMANDS)
    logger.info("✅ Bot Telegram configuré avec %d commandes", len(COMMANDS))
    return app


async def run_bot_polling(stop_event=None):
    if not BOT_TOKEN:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN absent — bot de commandes désactivé")
        return

    import asyncio

    max_retries = 10
    retry_delay = 20  # seconds between retries

    for attempt in range(1, max_retries + 1):
        if stop_event and stop_event.is_set():
            logger.info("🛑 Bot polling stopped before start (stop_event set)")
            return

        app = None
        try:
            app = await build_app()
            await app.initialize()

            # Force-delete any existing webhook and clear conflict state
            try:
                await app.bot.delete_webhook(drop_pending_updates=True)
                logger.info("🧹 Webhook supprimé, conflits résolus")
            except Exception as e:
                logger.warning("delete_webhook: %s", e)

            # Wait for Telegram to release any prior polling session
            wait = retry_delay if attempt > 1 else 15
            logger.info("⏳ Attente %ds avant démarrage du polling (tentative %d/%d)...", wait, attempt, max_retries)
            await asyncio.sleep(wait)

            if stop_event and stop_event.is_set():
                logger.info("🛑 Bot polling stopped after sleep (stop_event set)")
                return

            await app.start()
            await app.updater.start_polling(
                drop_pending_updates=True,
                allowed_updates=["message", "callback_query"],
                timeout=30,
            )
            logger.info("✅ 🤖 Bot de commandes ACTIF en mode polling (tentative %d)", attempt)

            # Keep alive until shutdown
            if stop_event:
                await stop_event.wait()
            else:
                # Fallback: keep alive indefinitely
                while True:
                    await asyncio.sleep(60)

            # Graceful shutdown
            try:
                await app.updater.stop()
                await app.stop()
                await app.shutdown()
            except Exception as e:
                logger.warning("Erreur lors de l'arrêt du bot: %s", e)
            logger.info("🛑 Bot polling arrêté proprement")
            return

        except Exception as e:
            logger.error("❌ Bot polling erreur (tentative %d/%d): %s: %s",
                         attempt, max_retries, type(e).__name__, e)
            if app:
                try:
                    await app.shutdown()
                except Exception:
                    pass
            if attempt < max_retries:
                logger.info("🔄 Nouvelle tentative dans %ds...", retry_delay)
                await asyncio.sleep(retry_delay)
            else:
                logger.error("❌ Bot polling abandonné après %d tentatives", max_retries)
                return
