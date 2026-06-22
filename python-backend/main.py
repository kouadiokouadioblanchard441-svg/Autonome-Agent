"""
Telegram AI Autonomous System - Python Backend
Handles Telethon connections, human behavior simulation, and anti-ban logic.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from telethon import TelegramClient, events
    from telethon.sessions import StringSession
    TELETHON_AVAILABLE = True
except ImportError:
    TELETHON_AVAILABLE = False
    logging.warning("Telethon not installed — running in simulation mode")

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

API_ID = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")
DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Active Telethon clients per account
active_clients: dict[int, Any] = {}
# phone_code_hash returned by send_code_request, keyed by account_id
pending_codes: dict[int, str] = {}
db_pool: asyncpg.Pool | None = None


_bot_stop_event: asyncio.Event | None = None
_bot_task: asyncio.Task | None = None
_notif_task: asyncio.Task | None = None
_auto_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, _bot_stop_event, _bot_task, _notif_task, _auto_task
    if DATABASE_URL:
        try:
            try:
                db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10, ssl="require", statement_cache_size=0)
            except Exception:
                db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10, ssl=False, statement_cache_size=0)
            logger.info("Database pool created")
        except Exception as e:
            logger.error(f"Failed to create DB pool: {e}")

    # Shared stop event for all background services
    _bot_stop_event = asyncio.Event()

    # Start Telegram command bot + notification loop + report scheduler
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if bot_token:
        try:
            from bot.runner import run_bot_polling
            from bot.notifications import notification_loop
            # Only ONE Application does polling — avoids 409 Conflict
            _bot_task = asyncio.create_task(run_bot_polling(_bot_stop_event))

            def _bot_task_done(task: asyncio.Task):
                if task.cancelled():
                    logger.warning("⚠️ Bot task annulée")
                elif task.exception():
                    logger.error("❌ Bot task exception: %s", task.exception())
                else:
                    logger.info("ℹ️ Bot task terminée normalement")

            _bot_task.add_done_callback(_bot_task_done)
            logger.info("🤖 Telegram command bot started")

            if db_pool:
                # Use a lightweight Bot (no polling) just for sending notifications + reports
                from telegram import Bot as TGBot
                _notif_bot = TGBot(token=bot_token)
                _notif_task = asyncio.create_task(
                    notification_loop(_notif_bot, db_pool, _bot_stop_event)
                )
                logger.info("🔔 Notification loop started")

                # Automated daily/weekly reports
                from bot.reports import report_scheduler
                asyncio.create_task(report_scheduler(db_pool, _notif_bot, _bot_stop_event))
                logger.info("📅 Report scheduler started")
        except Exception as e:
            logger.error(f"Failed to start command bot: {e}")

    # Start autonomous engine for all connected accounts
    if TELETHON_AVAILABLE and API_ID and API_HASH and db_pool:
        try:
            from bot.autonomous import start_all_engines
            _auto_task = asyncio.create_task(
                start_all_engines(db_pool, _bot_stop_event)
            )
            logger.info("🚀 Autonomous engine started")
        except Exception as e:
            logger.error(f"Failed to start autonomous engine: {e}")

    yield

    # Graceful shutdown
    if _bot_stop_event:
        _bot_stop_event.set()

    try:
        from bot.autonomous import stop_all_engines
        await stop_all_engines()
    except Exception:
        pass

    for task in [_bot_task, _notif_task, _auto_task]:
        if task:
            try:
                await asyncio.wait_for(task, timeout=5)
            except Exception:
                pass

    if db_pool:
        await db_pool.close()
    for client in active_clients.values():
        try:
            await client.disconnect()
        except Exception:
            pass


app = FastAPI(title="Telegram AI Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────────────────────

class AccountConnectRequest(BaseModel):
    account_id: int
    phone_number: str
    session_data: str | None = None

class VerifyCodeRequest(BaseModel):
    account_id: int
    phone_number: str
    code: str

class Verify2FARequest(BaseModel):
    account_id: int
    password: str

class SendMessageRequest(BaseModel):
    account_id: int
    chat_id: str
    message: str
    delay_seconds: float = 0
    simulate_typing: bool = True

class JoinGroupRequest(BaseModel):
    account_id: int
    invite_link: str

class GenerateMessageRequest(BaseModel):
    personality_type: str = "professional"
    context: str = ""
    message_type: str = "general"
    language: str = "fr"


# ── Human Behavior Simulation ─────────────────────────────────────────────────

async def human_delay(min_s: float = 1.5, max_s: float = 8.0):
    """Simulate human reaction time with gaussian distribution."""
    delay = random.gauss((min_s + max_s) / 2, (max_s - min_s) / 4)
    delay = max(min_s, min(max_s, delay))
    await asyncio.sleep(delay)


async def simulate_typing_delay(message: str) -> float:
    """Calculate realistic typing time based on message length."""
    chars_per_minute = random.uniform(180, 320)
    typing_time = (len(message) / chars_per_minute) * 60
    typing_time = max(2.0, min(15.0, typing_time))
    await asyncio.sleep(typing_time)
    return typing_time


def get_safe_interval(base_messages_today: int) -> float:
    """Anti-ban: calculate safe interval between messages."""
    if base_messages_today < 10:
        return random.uniform(30, 90)
    elif base_messages_today < 50:
        return random.uniform(120, 300)
    elif base_messages_today < 100:
        return random.uniform(300, 900)
    else:
        return random.uniform(900, 3600)


# ── AI Content Generation ─────────────────────────────────────────────────────

PERSONALITY_PROMPTS = {
    "professional": "You are a professional business communicator. Keep responses concise and formal.",
    "crypto": "You are an enthusiastic crypto community manager. Use market terminology and maintain bullish energy.",
    "motivational": "You are a powerful motivational coach. Inspire action with empowering language.",
    "friendly": "You are a warm and friendly community member. Be natural and conversational.",
    "support": "You are a patient support agent. Be clear, helpful and solution-focused.",
}

TEMPLATE_MESSAGES = {
    "motivation": [
        "Chaque grand voyage commence par un premier pas. Continuez d'avancer!",
        "La difference entre ou vous etes et ou vous voulez etre, c'est ce que vous faites aujourd'hui.",
        "Le succes n'est pas une destination — c'est un engagement quotidien.",
    ],
    "crypto": [
        "Le marche consolide mais les fondamentaux restent forts. HODL!",
        "DCA a travers la volatilite. Le temps sur le marche bat le timing du marche.",
        "Les mains fortes se construisent pendant les marches baissiers.",
    ],
    "welcome": [
        "Bienvenue dans la communaute! N'hesitez pas a vous presenter.",
        "Welcome! Great to have you here. Feel free to introduce yourself.",
    ],
    "general": [
        "Merci pour votre message!",
        "Bonne question! Je reviens vers vous rapidement.",
    ],
}


async def generate_ai_message(personality_type: str, context: str, message_type: str, language: str) -> str:
    """Generate content using OpenAI or fallback to templates."""
    if OPENAI_AVAILABLE and OPENAI_API_KEY:
        try:
            client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
            system_prompt = PERSONALITY_PROMPTS.get(personality_type, PERSONALITY_PROMPTS["friendly"])
            lang_instruction = f"Respond in {'French' if language == 'fr' else 'English'}."
            
            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": f"{system_prompt} {lang_instruction}"},
                    {"role": "user", "content": context or f"Generate a {message_type} message for a Telegram group."},
                ],
                max_tokens=300,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"OpenAI generation failed: {e}")

    templates = TEMPLATE_MESSAGES.get(message_type, TEMPLATE_MESSAGES["general"])
    return random.choice(templates)


# ── Telethon Client Management ────────────────────────────────────────────────

async def get_or_create_client(account_id: int, phone_number: str, session_data: str | None = None) -> Any:
    """Get or create a Telethon client for an account."""
    if not TELETHON_AVAILABLE:
        raise HTTPException(status_code=503, detail="Telethon not available. Install telethon package.")
    if not API_ID or not API_HASH:
        raise HTTPException(status_code=503, detail="TELEGRAM_API_ID and TELEGRAM_API_HASH not configured.")

    if account_id in active_clients:
        return active_clients[account_id]

    session = StringSession(session_data) if session_data else StringSession()
    client = TelegramClient(session, int(API_ID), API_HASH)
    await client.connect()
    active_clients[account_id] = client
    return client


async def log_security_event(event_type: str, severity: str, description: str, account_id: int | None = None):
    """Log a security event to the database."""
    if not db_pool:
        return
    try:
        await db_pool.execute(
            """INSERT INTO security_logs (event_type, severity, description, account_id)
               VALUES ($1, $2, $3, $4)""",
            event_type, severity, description, account_id
        )
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")


async def log_message(account_id: int, content: str, is_ai: bool, group_id: int | None = None):
    """Log a sent message to the database."""
    if not db_pool:
        return
    try:
        await db_pool.execute(
            """INSERT INTO messages (account_id, group_id, content, direction, status, is_ai_generated)
               VALUES ($1, $2, $3, 'outbound', 'sent', $4)""",
            account_id, group_id, content, is_ai
        )
        await db_pool.execute(
            "UPDATE telegram_accounts SET messages_count = messages_count + 1, last_seen = NOW() WHERE id = $1",
            account_id
        )
    except Exception as e:
        logger.error(f"Failed to log message: {e}")


# ── API Routes ────────────────────────────────────────────────────────────────

@app.get("/telegram/status")
async def get_status():
    """Check Telethon engine status."""
    return {
        "telethon_available": TELETHON_AVAILABLE,
        "openai_available": OPENAI_AVAILABLE and bool(OPENAI_API_KEY),
        "gemini_available": bool(GEMINI_API_KEY),
        "api_configured": bool(API_ID and API_HASH),
        "active_clients": len(active_clients),
        "db_connected": db_pool is not None,
    }


@app.post("/telegram/connect")
async def connect_account(req: AccountConnectRequest):
    """Step 1 — Send OTP code to the phone number via Telethon."""
    if not TELETHON_AVAILABLE:
        return {"success": False, "message": "Telethon not available", "simulated": True}
    if not API_ID or not API_HASH:
        return {"success": False, "message": "TELEGRAM_API_ID and TELEGRAM_API_HASH non configurés", "simulated": True}

    try:
        # Always create a fresh client for new connect requests so the session is clean
        if req.account_id in active_clients:
            try:
                await active_clients[req.account_id].disconnect()
            except Exception:
                pass
            del active_clients[req.account_id]

        session = StringSession(req.session_data) if req.session_data else StringSession()
        client = TelegramClient(session, int(API_ID), API_HASH)
        await client.connect()
        active_clients[req.account_id] = client

        # If already authorized (existing session), mark connected immediately
        if await client.is_user_authorized():
            me = await client.get_me()
            session_string = client.session.save()
            if db_pool:
                await db_pool.execute(
                    """UPDATE telegram_accounts
                       SET is_connected = true, status = 'active', username = $2,
                           session_data = $3, last_seen = NOW()
                       WHERE id = $1""",
                    req.account_id, me.username if me else None, session_string
                )
            return {"success": True, "message": "Compte déjà connecté", "needs_code": False, "username": me.username if me else None}

        # Send OTP — store phone_code_hash for the verify step
        result = await client.send_code_request(req.phone_number)
        pending_codes[req.account_id] = result.phone_code_hash
        logger.info(f"OTP envoyé au compte {req.account_id}, hash stocké")
        return {"success": True, "message": "Code OTP envoyé sur votre Telegram", "needs_code": True}

    except Exception as e:
        logger.error(f"Connexion échouée pour le compte {req.account_id}: {e}")
        await log_security_event("bot_detected", "high", f"Connection error: {str(e)}", req.account_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/telegram/verify")
async def verify_code(req: VerifyCodeRequest):
    """Step 2 — Verify the OTP code and complete sign-in."""
    phone_code_hash = pending_codes.get(req.account_id)
    if not phone_code_hash:
        raise HTTPException(status_code=400, detail="Aucun code en attente. Demandez un nouveau code d'abord.")

    client = active_clients.get(req.account_id)
    if not client:
        raise HTTPException(status_code=400, detail="Aucun client actif. Relancez la connexion.")

    try:
        from telethon.errors import SessionPasswordNeededError
        # Sanitize: keep digits only (handles spaces, dots, dashes Telegram may show)
        clean_code = "".join(filter(str.isdigit, req.code))
        await client.sign_in(req.phone_number, clean_code, phone_code_hash=phone_code_hash)

        me = await client.get_me()
        session_string = client.session.save()
        pending_codes.pop(req.account_id, None)

        if db_pool:
            await db_pool.execute(
                """UPDATE telegram_accounts
                   SET is_connected = true, status = 'active', username = $2,
                       session_data = $3, last_seen = NOW()
                   WHERE id = $1""",
                req.account_id, me.username if me else None, session_string
            )
        logger.info(f"Compte {req.account_id} connecté avec succès (@{me.username if me else '?'})")
        return {"success": True, "message": "Compte connecté avec succès", "needs_2fa": False, "username": me.username if me else None}

    except Exception as e:
        err = str(e)
        # Telegram requires 2FA password
        if "SessionPasswordNeeded" in err or "two-step" in err.lower():
            logger.info(f"Compte {req.account_id} nécessite 2FA")
            return {"success": False, "needs_2fa": True, "message": "Mot de passe 2FA requis"}
        logger.error(f"Vérification code échouée pour compte {req.account_id}: {e}")
        raise HTTPException(status_code=400, detail=err)


@app.post("/telegram/verify-2fa")
async def verify_2fa(req: Verify2FARequest):
    """Step 3 (optional) — Verify the 2FA password."""
    client = active_clients.get(req.account_id)
    if not client:
        raise HTTPException(status_code=400, detail="Aucun client actif. Relancez la connexion.")

    try:
        await client.sign_in(password=req.password)
        me = await client.get_me()
        session_string = client.session.save()

        if db_pool:
            await db_pool.execute(
                """UPDATE telegram_accounts
                   SET is_connected = true, status = 'active', username = $2,
                       session_data = $3, last_seen = NOW()
                   WHERE id = $1""",
                req.account_id, me.username if me else None, session_string
            )
        logger.info(f"Compte {req.account_id} connecté via 2FA (@{me.username if me else '?'})")
        return {"success": True, "message": "Compte connecté avec succès (2FA)", "username": me.username if me else None}

    except Exception as e:
        logger.error(f"2FA échoué pour compte {req.account_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/telegram/send")
async def send_message(req: SendMessageRequest, background_tasks: BackgroundTasks):
    """Send a message with human-like behavior simulation."""
    async def _send():
        client = None
        if TELETHON_AVAILABLE and API_ID and API_HASH:
            try:
                if db_pool:
                    row = await db_pool.fetchrow(
                        "SELECT phone_number, session_data FROM telegram_accounts WHERE id = $1",
                        req.account_id
                    )
                    if row:
                        client = await get_or_create_client(req.account_id, row["phone_number"], row["session_data"])
            except Exception as e:
                logger.error(f"Client creation failed: {e}")

        if req.delay_seconds > 0:
            await asyncio.sleep(req.delay_seconds)

        if req.simulate_typing:
            await simulate_typing_delay(req.message)
        else:
            await human_delay(0.5, 2.0)

        if client:
            try:
                await client.send_message(req.chat_id, req.message)
                await log_message(req.account_id, req.message, False)
                logger.info(f"[Account {req.account_id}] Sent to {req.chat_id}: {req.message[:50]}")
            except Exception as e:
                logger.error(f"Send failed: {e}")
                if "FloodWait" in str(e):
                    await log_security_event("floodwait", "medium", f"FloodWait triggered: {str(e)}", req.account_id)
                    if db_pool:
                        await db_pool.execute(
                            "UPDATE telegram_accounts SET status = 'cooldown', health_score = GREATEST(0, health_score - 15) WHERE id = $1",
                            req.account_id
                        )
        else:
            await log_message(req.account_id, req.message, False)
            logger.info(f"[SIMULATED] Account {req.account_id} → {req.chat_id}: {req.message[:50]}")

    background_tasks.add_task(_send)
    return {"success": True, "message": "Message queued for delivery", "simulated": not TELETHON_AVAILABLE}


@app.post("/telegram/generate-and-send")
async def generate_and_send(req: GenerateMessageRequest, account_id: int, chat_id: str, background_tasks: BackgroundTasks):
    """Generate AI content and send it with human-like behavior."""
    content = await generate_ai_message(req.personality_type, req.context, req.message_type, req.language)
    
    send_req = SendMessageRequest(
        account_id=account_id,
        chat_id=chat_id,
        message=content,
        simulate_typing=True,
    )
    
    async def _send_generated():
        client = None
        if TELETHON_AVAILABLE and API_ID and API_HASH:
            try:
                if db_pool:
                    row = await db_pool.fetchrow(
                        "SELECT phone_number, session_data FROM telegram_accounts WHERE id = $1",
                        account_id
                    )
                    if row:
                        client = await get_or_create_client(account_id, row["phone_number"], row["session_data"])
            except Exception as e:
                logger.error(f"Client creation failed: {e}")

        await simulate_typing_delay(content)
        if client:
            try:
                await client.send_message(chat_id, content)
            except Exception as e:
                logger.error(f"Send failed: {e}")
        await log_message(account_id, content, True)

    background_tasks.add_task(_send_generated)
    return {"success": True, "content": content, "queued": True}


@app.post("/telegram/join-group")
async def join_group(req: JoinGroupRequest):
    """Join a Telegram group via invite link."""
    if not TELETHON_AVAILABLE or not API_ID or not API_HASH:
        return {"success": False, "message": "Telethon not configured", "simulated": True}
    
    try:
        if db_pool:
            row = await db_pool.fetchrow(
                "SELECT phone_number, session_data FROM telegram_accounts WHERE id = $1",
                req.account_id
            )
            if row:
                client = await get_or_create_client(req.account_id, row["phone_number"], row["session_data"])
                await human_delay(2, 5)
                await client(req.invite_link)
                return {"success": True, "message": "Joined group successfully"}
    except Exception as e:
        logger.error(f"Join group failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
    return {"success": False, "message": "Account not found"}


@app.get("/telegram/accounts/{account_id}/health")
async def check_account_health(account_id: int):
    """Check the health/risk score of an account."""
    if not db_pool:
        return {"health_score": 100, "risk_factors": [], "recommendation": "nominal"}
    
    row = await db_pool.fetchrow(
        "SELECT health_score, status, messages_count FROM telegram_accounts WHERE id = $1",
        account_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Account not found")

    risk_factors = []
    score = row["health_score"]
    
    if score < 50:
        risk_factors.append("Low health score — consider cooling down")
    if row["status"] == "cooldown":
        risk_factors.append("Account in cooldown mode")
    if row["messages_count"] > 200:
        risk_factors.append("High message volume — reduce frequency")

    sec_logs = await db_pool.fetch(
        "SELECT event_type FROM security_logs WHERE account_id = $1 AND created_at > NOW() - INTERVAL '24 hours'",
        account_id
    )
    if sec_logs:
        risk_factors.append(f"{len(sec_logs)} security events in last 24h")

    recommendation = "nominal" if score > 80 else ("caution" if score > 50 else "pause_recommended")
    return {
        "health_score": score,
        "status": row["status"],
        "risk_factors": risk_factors,
        "recommendation": recommendation,
        "messages_count": row["messages_count"],
    }


@app.get("/telegram/anti-ban/status")
async def get_anti_ban_status():
    """Get global anti-ban system status."""
    if not db_pool:
        return {"status": "db_unavailable"}
    
    accounts = await db_pool.fetch("SELECT id, status, health_score, messages_count FROM telegram_accounts")
    security_events_24h = await db_pool.fetchval(
        "SELECT COUNT(*) FROM security_logs WHERE created_at > NOW() - INTERVAL '24 hours'"
    )
    floodwaits = await db_pool.fetchval(
        "SELECT COUNT(*) FROM security_logs WHERE event_type = 'floodwait' AND created_at > NOW() - INTERVAL '24 hours'"
    )
    
    at_risk = [a for a in accounts if a["health_score"] < 60]
    
    return {
        "total_accounts": len(accounts),
        "at_risk_accounts": len(at_risk),
        "security_events_24h": security_events_24h,
        "floodwaits_24h": floodwaits,
        "overall_health": "critical" if len(at_risk) > len(accounts) / 2 else ("warning" if at_risk else "healthy"),
        "recommendations": [
            "Reduce message frequency" if floodwaits > 2 else None,
            "Review at-risk accounts" if at_risk else None,
        ],
    }


@app.get("/telegram/bot-status")
async def get_bot_status():
    """Check command bot status."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    admin_id = os.getenv("ADMIN_TELEGRAM_ID")
    return {
        "bot_configured": bool(bot_token),
        "admin_id_set": bool(admin_id),
        "bot_running": _bot_task is not None and not _bot_task.done(),
        "commands_count": 30,
    }


@app.get("/monitoring/status")
async def get_monitoring_status():
    """Real-time engine status for the dashboard monitoring page."""
    from datetime import datetime
    engine_info = {"active_clients": 0, "accounts": [], "total_tasks": 0}
    report_data = {}
    try:
        from bot.autonomous import get_engine_status
        engine_info = get_engine_status()
    except Exception as e:
        logger.warning("get_engine_status: %s", e)
    if db_pool:
        try:
            from bot.reports import get_report_data
            report_data = await get_report_data(db_pool)
        except Exception as e:
            logger.warning("get_report_data: %s", e)
    return {
        "engine":       engine_info,
        "reports":      report_data,
        "bot_running":  _bot_task is not None and not _bot_task.done(),
        "db_connected": db_pool is not None,
        "timestamp":    datetime.utcnow().isoformat(),
    }


@app.get("/monitoring/communities")
async def get_communities_status():
    """List all groups and channels with their schedule configs."""
    if not db_pool:
        return {"groups": [], "channels": []}
    try:
        from bot.scheduler_config import get_schedule_config
        from bot.community_intel import load_profile

        groups = await db_pool.fetch(
            "SELECT id, telegram_id, title, username, members_count, is_monitored, is_auto_reply, account_id FROM telegram_groups ORDER BY title"
        )
        channels = await db_pool.fetch(
            "SELECT id, telegram_id, title, username, subscribers_count, is_auto_post, account_id FROM telegram_channels ORDER BY title"
        )

        groups_out = []
        for g in groups:
            cfg     = await get_schedule_config(db_pool, "group", g["telegram_id"])
            profile = await load_profile(db_pool, "group", g["telegram_id"])
            groups_out.append({
                "id":           g["id"],
                "telegram_id":  g["telegram_id"],
                "title":        g["title"],
                "username":     g["username"],
                "members":      g["members_count"],
                "is_monitored": g["is_monitored"],
                "is_auto_reply":g["is_auto_reply"],
                "account_id":   g["account_id"],
                "schedule":     cfg,
                "community_type": profile.community_type if profile else "community",
                "community_type_label": profile.community_type_label if profile else "Community",
                "tone":         profile.tone if profile else "casual",
                "language":     profile.language if profile else "fr",
                "mission":      profile.mission if profile else "",
                "engagement_score": profile.engagement_score if profile else 0,
                "total_posts":  profile.total_posts if profile else 0,
            })

        channels_out = []
        for c in channels:
            cfg     = await get_schedule_config(db_pool, "channel", c["telegram_id"])
            profile = await load_profile(db_pool, "channel", c["telegram_id"])
            channels_out.append({
                "id":           c["id"],
                "telegram_id":  c["telegram_id"],
                "title":        c["title"],
                "username":     c["username"],
                "subscribers":  c["subscribers_count"],
                "is_auto_post": c["is_auto_post"],
                "account_id":   c["account_id"],
                "schedule":     cfg,
                "community_type": profile.community_type if profile else "community",
                "community_type_label": profile.community_type_label if profile else "Community",
                "tone":         profile.tone if profile else "casual",
                "language":     profile.language if profile else "fr",
                "mission":      profile.mission if profile else "",
                "engagement_score": profile.engagement_score if profile else 0,
                "total_posts":  profile.total_posts if profile else 0,
            })

        return {"groups": groups_out, "channels": channels_out}
    except Exception as e:
        logger.error("get_communities_status: %s", e)
        return {"groups": [], "channels": [], "error": str(e)}


@app.post("/monitoring/reports/trigger")
async def trigger_report(request: Request):
    """Manually trigger a daily or weekly report and send to admin."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    report_type = body.get("type", "daily")

    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        return {"ok": False, "message": "Bot token non configuré"}
    if not db_pool:
        return {"ok": False, "message": "DB non connectée"}

    from telegram import Bot as TGBot
    from bot.reports import generate_daily_report, generate_weekly_report
    bot = TGBot(token=bot_token)
    try:
        if report_type == "weekly":
            await generate_weekly_report(db_pool, bot)
        else:
            await generate_daily_report(db_pool, bot)
        admin_id = os.getenv("ADMIN_TELEGRAM_ID", "")
        return {"ok": True, "message": f"Rapport {report_type} envoyé à l'admin ({admin_id[:4]}***)"}
    except Exception as e:
        logger.error("trigger_report: %s", e)
        return {"ok": False, "message": str(e)}


@app.get("/ab-tests/community")
async def get_community_ab_tests():
    """Return all A/B tests linked to a community (for dashboard)."""
    if not db_pool:
        return {"ok": False, "tests": [], "error": "DB not connected"}
    try:
        from bot.ab_content import get_all_community_tests
        tests = await get_all_community_tests(db_pool)
        return {"ok": True, "tests": tests}
    except Exception as e:
        logger.error("get_community_ab_tests: %s", e)
        return {"ok": False, "tests": [], "error": str(e)}


@app.post("/ab-tests/{test_id}/engage")
async def record_ab_engage(test_id: int, request: Request):
    """Record an engagement event (reply/reaction) for a specific variant."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    variant = body.get("variant", "a")
    kind    = body.get("kind", "reply")
    if variant not in ("a", "b"):
        return {"ok": False, "error": "variant must be 'a' or 'b'"}
    if not db_pool:
        return {"ok": False, "error": "DB not connected"}
    try:
        from bot.ab_content import record_ab_engagement
        await record_ab_engagement(db_pool, test_id, variant, kind=kind)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.put("/monitoring/communities/{chat_type}/{tg_id}/schedule")
async def update_community_schedule(chat_type: str, tg_id: str, config: dict):
    """Update the schedule config for a community."""
    if not db_pool:
        return {"ok": False, "error": "DB not connected"}
    if chat_type not in ("group", "channel"):
        return {"ok": False, "error": "Invalid chat_type"}
    try:
        from bot.scheduler_config import save_schedule_config
        await save_schedule_config(db_pool, chat_type, tg_id, config)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_SERVICE_PORT", "8090"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
