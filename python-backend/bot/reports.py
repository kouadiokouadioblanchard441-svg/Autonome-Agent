"""
Automated Reports Engine
Generates and sends daily + weekly reports to admin via Telegram bot.
Also exposes get_report_data() for the dashboard API.
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

ADMIN_ID = int(os.getenv("ADMIN_TELEGRAM_ID", "0"))


async def _send(bot, text: str) -> None:
    if not ADMIN_ID:
        return
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="HTML")
    except Exception as e:
        logger.warning("Report send failed: %s", e)


# ── Stats helpers ──────────────────────────────────────────────────────────────

async def _collect_daily_stats(pool, since: datetime) -> dict:
    try:
        msgs = await pool.fetchrow(
            """SELECT COUNT(*) as total,
                      SUM(CASE WHEN is_ai_generated THEN 1 ELSE 0 END) as ai
               FROM messages WHERE created_at >= $1""",
            since,
        )
        accounts = await pool.fetchrow(
            """SELECT COUNT(*) as total,
                      SUM(CASE WHEN is_connected THEN 1 ELSE 0 END) as connected
               FROM telegram_accounts"""
        )
        groups   = await pool.fetchval("SELECT COUNT(*) FROM telegram_groups WHERE is_monitored = true") or 0
        channels = await pool.fetchval("SELECT COUNT(*) FROM telegram_channels WHERE is_auto_post = true") or 0
        threats  = await pool.fetchval("SELECT COUNT(*) FROM security_logs WHERE created_at >= $1", since) or 0
        ai_posts = await pool.fetchval(
            "SELECT COUNT(*) FROM ai_logs WHERE created_at >= $1 AND action = 'auto_post'", since
        ) or 0
        top_questions = await pool.fetch(
            """SELECT content FROM messages
               WHERE created_at >= $1 AND direction = 'inbound'
               ORDER BY created_at DESC LIMIT 5""",
            since,
        )
        return {
            "total_messages":   int(msgs["total"] or 0) if msgs else 0,
            "ai_messages":      int(msgs["ai"] or 0) if msgs else 0,
            "total_accounts":   int(accounts["total"] or 0) if accounts else 0,
            "connected":        int(accounts["connected"] or 0) if accounts else 0,
            "groups":           groups,
            "channels":         channels,
            "threats":          threats,
            "ai_posts":         ai_posts,
            "top_questions":    [r["content"][:80] for r in (top_questions or [])],
        }
    except Exception as e:
        logger.error("_collect_daily_stats: %s", e)
        return {}


async def _collect_weekly_stats(pool, since: datetime, prev_since: datetime) -> dict:
    try:
        this_msgs = await pool.fetchval("SELECT COUNT(*) FROM messages WHERE created_at >= $1", since) or 0
        prev_msgs = await pool.fetchval(
            "SELECT COUNT(*) FROM messages WHERE created_at >= $1 AND created_at < $2",
            prev_since, since,
        ) or 0
        ai_posts  = await pool.fetchval(
            "SELECT COUNT(*) FROM ai_logs WHERE created_at >= $1 AND action = 'auto_post'", since
        ) or 0
        new_groups   = await pool.fetchval("SELECT COUNT(*) FROM telegram_groups WHERE created_at >= $1", since) or 0
        new_channels = await pool.fetchval("SELECT COUNT(*) FROM telegram_channels WHERE created_at >= $1", since) or 0
        threats      = await pool.fetchval("SELECT COUNT(*) FROM security_logs WHERE created_at >= $1", since) or 0

        growth = 0
        if prev_msgs > 0:
            growth = round(((this_msgs - prev_msgs) / prev_msgs) * 100)

        if growth > 20:
            recommendation = "📈 Excellente semaine ! Activité en forte croissance. Continuez le rythme actuel."
        elif growth > 0:
            recommendation = "✅ Bonne progression. Envisagez d'augmenter la fréquence de publication."
        elif this_msgs == 0:
            recommendation = "⚠️ Aucune activité. Connectez au moins un compte Telegram."
        else:
            recommendation = "⚠️ Légère baisse. Vérifiez les paramètres du planificateur autonome."

        return {
            "this_week_messages": this_msgs,
            "prev_week_messages": prev_msgs,
            "growth_pct":         growth,
            "ai_posts":           ai_posts,
            "new_groups":         new_groups,
            "new_channels":       new_channels,
            "threats":            threats,
            "recommendation":     recommendation,
        }
    except Exception as e:
        logger.error("_collect_weekly_stats: %s", e)
        return {}


# ── Public: data for dashboard API ────────────────────────────────────────────

async def get_report_data(pool) -> dict:
    """Return combined stats for the dashboard monitoring page."""
    now     = datetime.utcnow()
    today   = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    prev_week = week_ago - timedelta(days=7)
    daily  = await _collect_daily_stats(pool, today)
    weekly = await _collect_weekly_stats(pool, week_ago, prev_week)
    return {"daily": daily, "weekly": weekly, "generated_at": now.isoformat()}


# ── Report generators ──────────────────────────────────────────────────────────

async def generate_daily_report(pool, bot) -> None:
    if not pool or not ADMIN_ID:
        return
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    s = await _collect_daily_stats(pool, today)
    if not s:
        return
    pct = round(s["ai_messages"] / s["total_messages"] * 100) if s["total_messages"] > 0 else 0
    date_str = today.strftime("%d/%m/%Y")

    lines = [
        f"📊 <b>RAPPORT QUOTIDIEN — {date_str}</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        "<b>📨 Messages</b>",
        f"  • Total : <b>{s['total_messages']}</b>",
        f"  • Générés par IA : <b>{s['ai_messages']}</b> ({pct}%)",
        "",
        "<b>👥 Comptes</b>",
        f"  • Total : {s['total_accounts']} | Connectés : <b>{s['connected']}</b>",
        "",
        "<b>🏘 Communautés</b>",
        f"  • Groupes surveillés : <b>{s['groups']}</b>",
        f"  • Canaux auto-post : <b>{s['channels']}</b>",
        "",
        "<b>🤖 Publications IA</b>",
        f"  • Posts automatiques aujourd'hui : <b>{s['ai_posts']}</b>",
        "",
        "<b>🛡 Sécurité</b>",
        f"  • Menaces détectées : <b>{s['threats']}</b>",
    ]
    if s.get("top_questions"):
        lines += ["", "<b>❓ Dernières questions reçues</b>"]
        for q in s["top_questions"][:3]:
            lines.append(f"  • {q}")
    lines += ["", "<i>Nexus AI — Système actif 24h/24</i>"]

    await _send(bot, "\n".join(lines))
    logger.info("📊 Daily report sent to admin")


async def generate_weekly_report(pool, bot) -> None:
    if not pool or not ADMIN_ID:
        return
    now      = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    prev     = week_ago - timedelta(days=7)
    s = await _collect_weekly_stats(pool, week_ago, prev)
    if not s:
        return

    trend    = "📈" if s["growth_pct"] >= 0 else "📉"
    sign     = "+" if s["growth_pct"] >= 0 else ""
    week_str = week_ago.strftime("%d/%m") + " – " + now.strftime("%d/%m/%Y")

    lines = [
        "📋 <b>RAPPORT HEBDOMADAIRE</b>",
        f"<i>{week_str}</i>",
        "━━━━━━━━━━━━━━━━━━━━",
        "",
        f"<b>{trend} Évolution des messages</b>",
        f"  • Cette semaine : <b>{s['this_week_messages']}</b>",
        f"  • Semaine précédente : {s['prev_week_messages']}",
        f"  • Variation : <b>{sign}{s['growth_pct']}%</b>",
        "",
        "<b>🤖 Publications IA</b>",
        f"  • Posts auto cette semaine : <b>{s['ai_posts']}</b>",
        "",
        "<b>🌱 Nouvelles communautés</b>",
        f"  • Groupes rejoints : <b>{s['new_groups']}</b>",
        f"  • Canaux gérés : <b>{s['new_channels']}</b>",
        "",
        "<b>🛡 Sécurité</b>",
        f"  • Menaces cette semaine : <b>{s['threats']}</b>",
        "",
        "<b>💡 Recommandation IA</b>",
        f"  {s['recommendation']}",
        "",
        "<i>Nexus AI — Rapport automatique hebdomadaire</i>",
    ]
    await _send(bot, "\n".join(lines))
    logger.info("📋 Weekly report sent to admin")


# ── Scheduler loop ─────────────────────────────────────────────────────────────

async def report_scheduler(pool, bot, stop_event: asyncio.Event) -> None:
    """
    Runs in background. Triggers:
      - Daily report  every day at 08:00 UTC
      - Weekly report every Monday at 08:00 UTC
    """
    logger.info("📅 Report scheduler started")
    last_daily:  str | None = None
    last_weekly: str | None = None

    while not stop_event.is_set():
        try:
            now     = datetime.utcnow()
            day_key = now.strftime("%Y-%m-%d")

            if now.hour == 8:
                if last_daily != day_key:
                    await generate_daily_report(pool, bot)
                    last_daily = day_key

                if now.weekday() == 0 and last_weekly != day_key:
                    await generate_weekly_report(pool, bot)
                    last_weekly = day_key

        except Exception as e:
            logger.error("report_scheduler: %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1800)
        except asyncio.TimeoutError:
            pass
