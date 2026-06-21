"""
Automatic Telegram push notifications.
Polls DB every 60 s and sends alerts for:
  - New FloodWait events
  - Account health < 60 %
  - New pending escalations
  - Newly banned accounts
  - Campaign completions
"""
from __future__ import annotations

import asyncio
import logging
import os

logger = logging.getLogger(__name__)

ADMIN_ID = int(os.getenv("ADMIN_TELEGRAM_ID", "0"))
POLL_INTERVAL = 60  # seconds

# Track already-notified IDs to avoid spam
_seen_floodwaits: set[int] = set()
_seen_escalations: set[int] = set()
_seen_low_health: set[tuple] = set()
_seen_banned: set[int] = set()
_seen_campaigns_done: set[int] = set()


async def _send(bot, text: str) -> None:
    if not ADMIN_ID:
        return
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=text, parse_mode="HTML")
    except Exception as e:
        logger.warning("Notification send failed: %s", e)


# ── FloodWait ──────────────────────────────────────────────────────────────
async def _check_floodwaits(bot, pool) -> None:
    rows = await pool.fetch(
        """
        SELECT fe.id, fe.wait_seconds, fe.severity, fe.context, fe.triggered_at,
               ta.phone_number
        FROM flood_events fe
        LEFT JOIN telegram_accounts ta ON ta.id = fe.account_id
        WHERE fe.triggered_at > NOW() - INTERVAL '2 minutes'
        ORDER BY fe.triggered_at DESC
        LIMIT 20
        """
    )
    for r in rows:
        if r["id"] in _seen_floodwaits:
            continue
        _seen_floodwaits.add(r["id"])
        secs = r["wait_seconds"] or 0
        mins, sec = divmod(secs, 60)
        wait_str = f"{mins}m {sec}s" if mins else f"{secs}s"
        sev = (r["severity"] or "medium").lower()
        sev_emoji = {"critical": "🆘", "high": "🚨", "medium": "⚠️", "low": "ℹ️"}.get(sev, "⚠️")
        phone = r["phone_number"] or "inconnu"
        ctx = f"\n📍 Contexte : {r['context']}" if r["context"] else ""
        await _send(
            bot,
            f"{sev_emoji} <b>FloodWait détecté</b>\n"
            f"📱 Compte : <code>{phone}</code>\n"
            f"⏱ Attente : <b>{wait_str}</b>\n"
            f"🎯 Sévérité : {sev}{ctx}",
        )


# ── Account health ─────────────────────────────────────────────────────────
async def _check_health(bot, pool) -> None:
    rows = await pool.fetch(
        """
        SELECT id, phone_number, health_score, status
        FROM telegram_accounts
        WHERE health_score < 60 AND status != 'banned'
        """
    )
    for r in rows:
        # Re-alert at each 10-point bracket drop
        bracket = r["health_score"] // 10
        key = (r["id"], bracket)
        if key in _seen_low_health:
            continue
        _seen_low_health.add(key)
        score = r["health_score"] or 0
        emoji = "🔴" if score < 30 else "🟠"
        await _send(
            bot,
            f"{emoji} <b>Santé critique</b>\n"
            f"📱 Compte : <code>{r['phone_number']}</code>\n"
            f"💔 Score : <b>{score}/100</b>\n"
            f"⚠️ Statut : {r['status']}\n"
            f"👉 /health pour détails",
        )


# ── Escalations ────────────────────────────────────────────────────────────
async def _check_escalations(bot, pool) -> None:
    rows = await pool.fetch(
        """
        SELECT id, account_id, contact_phone, contact_username,
               contact_name, reason, created_at
        FROM escalations
        WHERE status = 'pending'
          AND created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY created_at DESC
        LIMIT 10
        """
    )
    for r in rows:
        if r["id"] in _seen_escalations:
            continue
        _seen_escalations.add(r["id"])
        reason = (r["reason"] or "human_needed").replace("_", " ")
        reason_emoji = {
            "angry": "😡", "suspicious": "🕵️", "human needed": "🧑",
            "spam detected": "🚫", "other": "❓",
        }.get(reason, "📋")
        contact = r["contact_name"] or r["contact_username"] or r["contact_phone"] or "inconnu"
        await _send(
            bot,
            f"🆘 <b>Escalation requise</b>\n"
            f"{reason_emoji} Raison : <b>{reason}</b>\n"
            f"👤 Contact : {contact}\n"
            f"🆔 ID : <code>{r['id']}</code>\n"
            f"👉 /resolve_escalation {r['id']}",
        )


# ── Banned accounts ────────────────────────────────────────────────────────
async def _check_bans(bot, pool) -> None:
    rows = await pool.fetch(
        """
        SELECT id, phone_number, updated_at
        FROM telegram_accounts
        WHERE status = 'banned'
          AND updated_at > NOW() - INTERVAL '2 minutes'
        """
    )
    for r in rows:
        if r["id"] in _seen_banned:
            continue
        _seen_banned.add(r["id"])
        await _send(
            bot,
            f"⛔ <b>Compte banni !</b>\n"
            f"📱 Téléphone : <code>{r['phone_number']}</code>\n"
            f"🕐 Détecté à : {r['updated_at'].strftime('%H:%M:%S')}\n"
            f"👉 /accounts pour gérer",
        )


# ── Campaign completions ───────────────────────────────────────────────────
async def _check_campaigns(bot, pool) -> None:
    rows = await pool.fetch(
        """
        SELECT id, name, updated_at
        FROM campaigns
        WHERE status = 'completed'
          AND updated_at > NOW() - INTERVAL '2 minutes'
        """
    )
    for r in rows:
        if r["id"] in _seen_campaigns_done:
            continue
        _seen_campaigns_done.add(r["id"])
        await _send(
            bot,
            f"✅ <b>Campagne terminée</b>\n"
            f"📢 Nom : <b>{r['name']}</b>\n"
            f"🕐 Fin : {r['updated_at'].strftime('%H:%M:%S')}\n"
            f"👉 /campaigns pour les stats",
        )


# ── Main loop ──────────────────────────────────────────────────────────────
async def notification_loop(bot, pool, stop_event: asyncio.Event) -> None:
    logger.info("🔔 Boucle de notifications démarrée (intervalle %ds)", POLL_INTERVAL)
    while not stop_event.is_set():
        try:
            await asyncio.gather(
                _check_floodwaits(bot, pool),
                _check_health(bot, pool),
                _check_escalations(bot, pool),
                _check_bans(bot, pool),
                _check_campaigns(bot, pool),
            )
        except Exception as e:
            logger.error("Erreur dans la boucle de notifications : %s", e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=POLL_INTERVAL)
        except asyncio.TimeoutError:
            pass  # Normal — just loop again
