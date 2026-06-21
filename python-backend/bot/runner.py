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
    cmd_generate, cmd_personalities, cmd_ab_tests,
    cmd_leads,
    cmd_security, cmd_threats, cmd_ban, cmd_sanctions, cmd_floodwait,
    cmd_escalations, cmd_resolve_escalation,
    cmd_proxies, cmd_schedules, cmd_warmup,
    cmd_memories, cmd_settings, cmd_help,
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

    app.add_handler(CallbackQueryHandler(handle_callback))

    await app.bot.set_my_commands(COMMANDS)
    logger.info("✅ Bot Telegram configuré avec %d commandes", len(COMMANDS))
    return app


async def run_bot_polling(stop_event=None):
    if not BOT_TOKEN:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN absent — bot de commandes désactivé")
        return

    app = await build_app()
    await app.initialize()
    await app.start()
    await app.updater.start_polling(drop_pending_updates=True)
    logger.info("🤖 Bot de commandes actif en mode polling")

    if stop_event:
        await stop_event.wait()
        await app.updater.stop()
        await app.stop()
        await app.shutdown()
