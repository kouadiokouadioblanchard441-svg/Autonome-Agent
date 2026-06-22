"""
Autonomous Engine — each connected Telegram account acts independently:
  - Detects which groups/channels it joins
  - Registers them in the DB
  - Generates and posts AI content (text + images)
  - Auto-replies to messages when enabled
  - Runs scheduled auto-posts for channels
  - Searches and sends videos (if PEXELS_API_KEY set)
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
from typing import Any, Optional

logger = logging.getLogger(__name__)

API_ID   = os.getenv("TELEGRAM_API_ID")
API_HASH = os.getenv("TELEGRAM_API_HASH")

# Delay between joining and posting (seconds) — feels human
JOIN_POST_DELAY_MIN = 300   # 5 min
JOIN_POST_DELAY_MAX = 1800  # 30 min

# Interval between auto-posts in channels (seconds)
AUTOPOST_INTERVAL_MIN = 3600   # 1 h
AUTOPOST_INTERVAL_MAX = 14400  # 4 h


# ── State ─────────────────────────────────────────────────────────────────────

# account_id → Telethon client
_clients: dict[int, Any] = {}
# account_id → list of asyncio.Task
_tasks: dict[int, list[asyncio.Task]] = {}
# (account_id, chat_id) → last post time
_last_post: dict[tuple, float] = {}


# ── DB helpers ────────────────────────────────────────────────────────────────

async def _upsert_group(pool, account_id: int, tg_id: str, title: str,
                        username: Optional[str], members: Optional[int]):
    await pool.execute(
        """
        INSERT INTO telegram_groups (telegram_id, title, username, members_count,
                                     account_id, is_monitored)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (telegram_id) DO UPDATE
          SET title = EXCLUDED.title,
              username = EXCLUDED.username,
              members_count = EXCLUDED.members_count,
              account_id = EXCLUDED.account_id,
              is_monitored = true,
              updated_at = NOW()
        """,
        tg_id, title, username, members, account_id,
    )


async def _upsert_channel(pool, account_id: int, tg_id: str, title: str,
                          username: Optional[str], subs: Optional[int]):
    await pool.execute(
        """
        INSERT INTO telegram_channels (telegram_id, title, username,
                                       subscribers_count, account_id, is_auto_post)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (telegram_id) DO UPDATE
          SET title = EXCLUDED.title,
              username = EXCLUDED.username,
              subscribers_count = EXCLUDED.subscribers_count,
              account_id = EXCLUDED.account_id,
              is_auto_post = true,
              updated_at = NOW()
        """,
        tg_id, title, username, subs, account_id,
    )


async def _log_message(pool, account_id: int, content: str, is_ai: bool = True):
    try:
        await pool.execute(
            """INSERT INTO messages (account_id, content, direction, status, is_ai_generated)
               VALUES ($1, $2, 'outbound', 'sent', $3)""",
            account_id, content, is_ai,
        )
        await pool.execute(
            "UPDATE telegram_accounts SET messages_count = messages_count + 1, last_seen = NOW() WHERE id = $1",
            account_id,
        )
    except Exception as e:
        logger.warning("log_message failed: %s", e)


async def _log_ai(pool, account_id: int, action: str, prompt: str, response: str):
    try:
        await pool.execute(
            """INSERT INTO ai_logs (account_id, action, model, prompt, response, success)
               VALUES ($1, $2, 'gpt-4o-mini', $3, $4, true)""",
            account_id, action, prompt[:2000], response[:2000],
        )
    except Exception as e:
        logger.warning("log_ai failed: %s", e)


async def _get_personality(pool, account_id: int) -> dict:
    """Return the AI personality linked to this account (or default)."""
    try:
        row = await pool.fetchrow(
            """SELECT p.system_prompt, p.tone, p.name
               FROM ai_personalities p
               JOIN telegram_accounts a ON a.personality_id = p.id
               WHERE a.id = $1""",
            account_id,
        )
        if row:
            return {"system_prompt": row["system_prompt"] or "", "tone": row["tone"] or "casual", "name": row["name"]}
    except Exception:
        pass
    return {"system_prompt": "", "tone": "casual", "name": "Default"}


async def _get_chat_persona(pool, chat_type: str, tg_id: str,
                            title: str = "", about: str = "",
                            topic_info: dict | None = None) -> dict:
    """
    Load the per-chat persona from DB, or auto-detect and save one.
    Returns a persona dict with system_prompt, tone, language, etc.
    """
    from .personality import load_persona, detect_and_build_persona, save_persona
    persona = await load_persona(pool, chat_type, tg_id)
    if persona:
        return persona
    info = topic_info or {}
    persona = await detect_and_build_persona(
        title=title, about=about,
        detected_topic=info.get("topic", "community"),
        detected_tone=info.get("tone", "casual"),
        detected_language=info.get("language", "fr"),
        content_ideas=info.get("content_ideas", []),
    )
    await save_persona(pool, chat_type, tg_id, persona)
    return persona


async def _get_community_profile(client, pool, entity, chat_type: str, account_id: int):
    """
    Load or build a full CommunityProfile for this entity using community_intel.
    Falls back to legacy persona if community_intel fails.
    """
    try:
        from .community_intel import discover_community
        return await discover_community(client, entity, pool, chat_type, account_id)
    except Exception as e:
        logger.warning("community_intel failed, falling back to persona: %s", e)
        return None


# ── Core: detect chat and register ───────────────────────────────────────────

async def _detect_and_register(client, pool, entity, account_id: int) -> tuple[str, bool]:
    """
    Detect if entity is a group or channel, save to DB.
    Returns (chat_type, is_channel): chat_type ∈ {"group","channel","unknown"}
    """
    from telethon.tl.types import (
        Channel, Chat, ChatFull,
    )
    try:
        tg_id = str(entity.id)
        title  = getattr(entity, "title", None) or getattr(entity, "username", "Unknown")
        username = getattr(entity, "username", None)
        is_channel = getattr(entity, "broadcast", False)
        is_megagroup = getattr(entity, "megagroup", False)

        if is_channel and not is_megagroup:
            # Proper channel
            subs = getattr(entity, "participants_count", None)
            if pool:
                await _upsert_channel(pool, account_id, tg_id, title, username, subs)
            logger.info("[Account %d] Registered CHANNEL: %s (%s)", account_id, title, tg_id)
            return "channel", True
        else:
            # Group or supergroup
            members = getattr(entity, "participants_count", None)
            if pool:
                await _upsert_group(pool, account_id, tg_id, title, username, members)
            logger.info("[Account %d] Registered GROUP: %s (%s)", account_id, title, tg_id)
            return "group", False
    except Exception as e:
        logger.warning("detect_and_register failed: %s", e)
        return "unknown", False


# ── Core: post content ────────────────────────────────────────────────────────

async def _post_content(
    client,
    pool,
    account_id: int,
    entity,
    topic_info: dict,
    with_image: bool = True,
    with_video: bool = False,
    chat_type: str = "group",
    profile=None,  # CommunityProfile if already loaded
):
    """Generate and post text + optional image/video to a group or channel."""
    from .content_gen import (
        generate_text, generate_image, generate_image_prompt,
        search_pexels_video,
    )

    title  = getattr(entity, "title", "groupe")
    tg_id  = str(getattr(entity, "id", "0"))
    about  = getattr(entity, "about", "") or ""

    # Try to load community profile (new system)
    if profile is None:
        profile = await _get_community_profile(client, pool, entity, chat_type, account_id)

    if profile:
        topic = profile.community_type
        tone  = profile.tone
        lang  = profile.language
        ideas = profile.content_strategy
        idea  = random.choice(ideas) if ideas else ""
        system_prompt = (
            f"Tu es un assistant IA expert en {profile.community_type_label}. "
            f"Mission: {profile.mission} "
            f"Objectifs: {'; '.join(profile.objectives[:2])}. "
            f"Ton: {tone}. "
            + (f"Instructions admin: {profile.admin_instructions}" if profile.admin_instructions else "")
            + (f" Éviter: {', '.join(profile.forbidden_topics)}." if profile.forbidden_topics else "")
        )
    else:
        # Legacy fallback
        persona = await _get_chat_persona(
            pool, chat_type, tg_id, title=title, about=about, topic_info=topic_info
        )
        topic  = persona.get("topic", topic_info.get("topic", title))
        tone   = persona.get("tone", "casual")
        lang   = persona.get("language", "fr")
        ideas  = persona.get("content_ideas", topic_info.get("content_ideas", []))
        idea   = random.choice(ideas) if ideas else ""
        system_prompt = persona.get("system_prompt", "")

    # Enrich with real-time data (market prices, news headlines)
    try:
        from .realtime_intel import enrich_post_with_realtime
        rt_prefix = ""
        if profile and profile.community_type in ("crypto", "finance", "investment", "news"):
            from .realtime_intel import get_latest_news, format_news_bulletin
            news = await get_latest_news(profile.community_type, lang, max_items=2)
            if news:
                rt_prefix = format_news_bulletin(news, profile.community_type, lang) + "\n\n"
    except Exception:
        rt_prefix = ""

    # 1 — Generate text + trust/fact-check
    if not isinstance(idea, str):
        idea = str(idea)
    from .content_gen import generate_text_with_trust
    raw_text, trust = await generate_text_with_trust(
        topic=topic, tone=tone, language=lang,
        content_idea=idea,
        personality_prompt=system_prompt,
        append_badge=False,   # badge stored in DB but not appended by default
    )
    text = raw_text
    if rt_prefix:
        text = rt_prefix + text

    # Log trust score
    logger.info(
        "[Account %d] Trust check: %s | score=%d | type=%s",
        account_id, trust.label, trust.score, trust.content_type,
    )

    # Block or warn on very low-trust content (score < 20 = likely misleading)
    if trust.score < 20:
        logger.warning(
            "[Account %d] Content blocked — trust score too low (%d): %s",
            account_id, trust.score, text[:100],
        )
        return  # Don't post potentially misleading content

    if pool:
        await _log_ai(pool, account_id, "auto_post",
                      f"type={topic} idea={idea} trust={trust.score} label={trust.label}", text)

    # 2 — Simulate human typing delay
    typing_time = max(2.0, min(12.0, len(text) / 250 * 60))
    try:
        await client.action(entity, "typing").__aenter__()
        await asyncio.sleep(typing_time)
    except Exception:
        await asyncio.sleep(3)

    # 3 — Send image + text OR just text
    image_sent = False
    if with_image:
        img_prompt = await generate_image_prompt(topic, tone, text)
        img_bytes = await generate_image(img_prompt)
        if img_bytes:
            try:
                import io
                await client.send_file(entity, img_bytes, caption=text)
                image_sent = True
                logger.info("[Account %d] Posted image+text to %s", account_id, title)
            except Exception as e:
                logger.warning("send_file failed: %s — falling back to text only", e)

    if not image_sent:
        try:
            await client.send_message(entity, text)
            logger.info("[Account %d] Posted text to %s", account_id, title)
        except Exception as e:
            logger.error("send_message failed: %s", e)
            return

    if pool:
        await _log_message(pool, account_id, text, is_ai=True)
        # Update engagement score
        if profile:
            try:
                from .community_intel import update_engagement_score
                await update_engagement_score(pool, chat_type, tg_id)
            except Exception:
                pass

    # 4 — Optionally search and send a video (Pexels)
    if with_video:
        video_url = await search_pexels_video(topic)
        if video_url:
            try:
                await asyncio.sleep(random.uniform(10, 30))
                await client.send_file(entity, video_url,
                                        caption=f"📹 Vidéo sur: {topic}")
                logger.info("[Account %d] Sent video to %s", account_id, title)
            except Exception as e:
                logger.warning("Video send failed: %s", e)

    _last_post[(account_id, str(getattr(entity, "id", 0)))] = asyncio.get_event_loop().time()


# ── Event Handlers ────────────────────────────────────────────────────────────

def _make_join_handler(client, pool, account_id: int):
    """Telethon ChatAction handler — fires when the account joins a chat."""
    try:
        from telethon import events
    except ImportError:
        return None

    @client.on(events.ChatAction)
    async def on_chat_action(event):
        try:
            # Only care about this account joining
            if not (event.user_joined or event.user_added):
                return
            me = await client.get_me()
            if not me:
                return
            if event.user_id != me.id:
                return  # Someone else joined, not us

            entity = await event.get_chat()
            chat_type, is_channel = await _detect_and_register(client, pool, entity, account_id)

            if chat_type == "unknown":
                return

            title = getattr(entity, "title", "")

            # Wait human-like delay before first post
            delay = random.uniform(JOIN_POST_DELAY_MIN, JOIN_POST_DELAY_MAX)
            logger.info(
                "[Account %d] Joined %s '%s' — will post in %.0f seconds",
                account_id, chat_type, title, delay,
            )
            await asyncio.sleep(delay)

            # Full community discovery (replaces simple topic analysis)
            profile = await _get_community_profile(client, pool, entity, chat_type, account_id)

            # Post intro content (with image for channels, text only for groups)
            with_img = is_channel or random.random() < 0.4
            await _post_content(client, pool, account_id, entity, {},
                                 with_image=with_img, chat_type=chat_type,
                                 profile=profile)

        except Exception as e:
            logger.error("[Account %d] join handler error: %s", account_id, e)

    return on_chat_action


def _make_message_handler(client, pool, account_id: int):
    """Telethon NewMessage handler — humanoid auto-reply."""
    try:
        from telethon import events
    except ImportError:
        return None

    @client.on(events.NewMessage(incoming=True))
    async def on_new_message(event):
        try:
            me = await client.get_me()
            if not me:
                return

            msg_text = (event.raw_text or "").strip()
            if not msg_text:
                return

            # Determine if we should reply:
            # - Always reply in private chats
            # - In groups: only if mentioned OR auto_reply enabled
            is_private  = event.is_private
            is_mentioned = me.username and f"@{me.username}" in msg_text

            if not is_private and not is_mentioned:
                # Check if auto_reply is enabled for this group
                if pool:
                    tg_id = str(event.chat_id)
                    row = await pool.fetchrow(
                        "SELECT is_auto_reply FROM telegram_groups WHERE telegram_id = $1", tg_id
                    )
                    if not row or not row["is_auto_reply"]:
                        return
                else:
                    return

            # Anti-flood: don't reply twice within 45s in same chat
            chat_key = (account_id, str(event.chat_id))
            now_loop = asyncio.get_event_loop().time()
            if now_loop - _last_post.get(chat_key, 0) < 45:
                return
            _last_post[chat_key] = now_loop

            # Extract sender info for humanoid greeting
            sender     = await event.get_sender()
            user_id    = getattr(sender, "id", 0)
            first_name = getattr(sender, "first_name", "") or ""
            last_name  = getattr(sender, "last_name",  "") or ""
            username   = getattr(sender, "username",   "") or ""

            # Get or create user profile (for personalization & memory)
            from .human_ai import (
                generate_humanoid_response, human_typing_delay,
                get_or_create_user_profile,
            )
            await get_or_create_user_profile(pool, user_id, first_name, last_name, username)

            # Generate humanoid response
            import datetime as dt
            hour = dt.datetime.now().hour
            reply = await generate_humanoid_response(
                user_message=msg_text,
                user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                username=username,
                pool=pool,
                hour=hour,
            )

            # Simulate human typing delay
            typing_secs = human_typing_delay(reply)
            try:
                async with client.action(event.chat_id, "typing"):
                    await asyncio.sleep(typing_secs)
            except Exception:
                await asyncio.sleep(min(typing_secs, 4))

            # Send reply
            await event.reply(reply)

            if pool:
                await _log_message(pool, account_id, reply, is_ai=True)

            logger.info(
                "[Account %d] Humanoid reply to %s (%s): %.50s…",
                account_id, first_name or username, event.chat_id, reply
            )

        except Exception as e:
            logger.error("[Account %d] message handler error: %s", account_id, e)

    return on_new_message


# ── Post index tracker (per channel) ─────────────────────────────────────────
_post_index: dict[tuple, int] = {}


# ── Auto-post loop for channels ───────────────────────────────────────────────

async def _autopost_loop(client, pool, account_id: int, stop_event: asyncio.Event):
    """
    Periodically post content to all channels where is_auto_post=True.
    Interval and content rotation are read from per-channel schedule config.
    """
    while not stop_event.is_set():
        try:
            if pool:
                rows = await pool.fetch(
                    """SELECT telegram_id, title FROM telegram_channels
                       WHERE is_auto_post = true AND account_id = $1""",
                    account_id,
                )
                for row in rows:
                    tg_id = row["telegram_id"]
                    title = row["title"]
                    key   = (account_id, tg_id)
                    now   = asyncio.get_event_loop().time()

                    # Load configurable interval for this channel
                    from .scheduler_config import get_interval_seconds, get_content_type_for_post, get_schedule_config
                    cfg      = await get_schedule_config(pool, "channel", tg_id)
                    interval_secs = int(cfg.get("interval_seconds", AUTOPOST_INTERVAL_MIN))
                    enabled  = cfg.get("enabled", True)

                    if not enabled:
                        continue
                    if now - _last_post.get(key, 0) < interval_secs:
                        continue

                    try:
                        entity  = await client.get_entity(int(tg_id))
                        profile = await _get_community_profile(client, pool, entity, "channel", account_id)

                        # Determine content type from rotation
                        post_idx     = _post_index.get(key, 0)
                        content_type = await get_content_type_for_post(pool, "channel", tg_id, post_idx)
                        _post_index[key] = post_idx + 1

                        # Every 4th post can include video
                        with_video = (post_idx % 4 == 3) and cfg.get("post_with_video", False)

                        # Build topic_info with content type override
                        topic_info = {"forced_content_type": content_type}

                        await _post_content(
                            client, pool, account_id, entity, topic_info,
                            with_image=cfg.get("post_with_image", True),
                            with_video=with_video,
                            chat_type="channel",
                            profile=profile,
                        )
                        _last_post[key] = now
                        logger.info(
                            "[Account %d] Auto-posted '%s' to channel '%s'. Next in %.0f min",
                            account_id, content_type, title, interval_secs / 60,
                        )
                    except Exception as e:
                        logger.warning("[Account %d] autopost to %s failed: %s", account_id, tg_id, e)

        except Exception as e:
            logger.error("[Account %d] autopost_loop error: %s", account_id, e)

        # Check every 2 minutes
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=120)
        except asyncio.TimeoutError:
            pass


# ── Engine status (for monitoring endpoint) ───────────────────────────────────

def get_engine_status() -> dict:
    """Return real-time autonomous engine state for the monitoring dashboard."""
    import time
    now = time.time()
    accounts_info = []
    for acc_id, client in _clients.items():
        tasks     = _tasks.get(acc_id, [])
        channels  = [k[1] for k in _last_post if k[0] == acc_id]
        last_posts = {k[1]: _last_post[k] for k in _last_post if k[0] == acc_id}
        next_posts = {}
        for ch_id, last in last_posts.items():
            elapsed = now - last
            # Default 4h interval — real interval fetched live per call
            next_in = max(0, 14400 - elapsed)
            next_posts[ch_id] = int(next_in)
        accounts_info.append({
            "account_id": acc_id,
            "active":     True,
            "tasks":      len([t for t in tasks if not t.done()]),
            "channels_managed": len(channels),
            "last_post_times":  {k: int(v) for k, v in last_posts.items()},
            "next_post_in_sec": next_posts,
        })
    return {
        "active_clients":  len(_clients),
        "accounts":        accounts_info,
        "total_tasks":     sum(len(t) for t in _tasks.values()),
    }


# ── Public API ────────────────────────────────────────────────────────────────

async def start_account_engine(account_id: int, pool, stop_event: asyncio.Event):
    """
    Connect Telethon client for one account and start all autonomous behaviors.
    Called from main.py lifespan for each active account.
    """
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession

        if not API_ID or not API_HASH:
            logger.warning("TELEGRAM_API_ID/HASH not set — autonomous engine disabled")
            return

        if not pool:
            logger.warning("[Account %d] No DB pool — autonomous engine disabled", account_id)
            return

        # Load account from DB
        row = await pool.fetchrow(
            "SELECT phone_number, session_data, status FROM telegram_accounts WHERE id = $1",
            account_id,
        )
        if not row:
            logger.warning("[Account %d] Not found in DB", account_id)
            return
        if row["status"] in ("banned", "inactive"):
            logger.info("[Account %d] Skipping — status=%s", account_id, row["status"])
            return
        if not row["session_data"]:
            logger.info("[Account %d] No session — skipping autonomous engine", account_id)
            return

        session = StringSession(row["session_data"])
        client  = TelegramClient(session, int(API_ID), API_HASH)
        await client.connect()

        if not await client.is_user_authorized():
            logger.warning("[Account %d] Not authorized — skipping", account_id)
            await client.disconnect()
            return

        _clients[account_id] = client

        # Attach event handlers
        _make_join_handler(client, pool, account_id)
        _make_message_handler(client, pool, account_id)

        # Start auto-post background loop
        task = asyncio.create_task(
            _autopost_loop(client, pool, account_id, stop_event),
            name=f"autopost-{account_id}",
        )
        _tasks.setdefault(account_id, []).append(task)

        logger.info("✅ [Account %d] Autonomous engine started (%s)", account_id, row["phone_number"])

        # Scan existing groups/channels and register them
        await _scan_existing_chats(client, pool, account_id)

    except Exception as e:
        logger.error("[Account %d] start_account_engine failed: %s", account_id, e)


async def _scan_existing_chats(client, pool, account_id: int):
    """
    On startup, scan all dialogs this account is already in and register them.
    """
    try:
        from telethon.tl.types import Channel, Chat
        async for dialog in client.iter_dialogs():
            entity = dialog.entity
            if isinstance(entity, (Channel, Chat)):
                await _detect_and_register(client, pool, entity, account_id)
                await asyncio.sleep(0.1)  # gentle rate-limit
        logger.info("[Account %d] Scanned existing chats", account_id)
    except Exception as e:
        logger.warning("[Account %d] scan_existing_chats error: %s", account_id, e)


async def start_all_engines(pool, stop_event: asyncio.Event):
    """
    Load all active accounts from DB and start their autonomous engines.
    Called once at FastAPI startup.
    """
    if not pool:
        return
    try:
        rows = await pool.fetch(
            """SELECT id FROM telegram_accounts
               WHERE status NOT IN ('banned', 'inactive')
               AND session_data IS NOT NULL
               AND is_connected = true"""
        )
        logger.info("🤖 Starting autonomous engine for %d account(s)", len(rows))
        tasks = [
            start_account_engine(row["id"], pool, stop_event)
            for row in rows
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    except Exception as e:
        logger.error("start_all_engines failed: %s", e)


async def stop_all_engines():
    """Disconnect all Telethon clients gracefully."""
    for account_id, client in _clients.items():
        try:
            await client.disconnect()
            logger.info("[Account %d] Disconnected", account_id)
        except Exception:
            pass
    _clients.clear()
    for tasks in _tasks.values():
        for t in tasks:
            t.cancel()
    _tasks.clear()


async def trigger_post_now(account_id: int, chat_id: str, with_image: bool = True, with_video: bool = False):
    """
    Force an immediate AI post to a specific chat.
    Can be called from the Telegram bot command /post_now.
    """
    client = _clients.get(account_id)
    if not client:
        raise RuntimeError(f"Account {account_id} engine not running")

    from .utils import get_pool
    pool = await get_pool()
    entity = await client.get_entity(int(chat_id))
    is_channel = getattr(entity, "broadcast", False) and not getattr(entity, "megagroup", False)
    chat_type = "channel" if is_channel else "group"
    profile = await _get_community_profile(client, pool, entity, chat_type, account_id)
    await _post_content(client, pool, account_id, entity, {},
                        with_image=with_image, with_video=with_video,
                        chat_type=chat_type, profile=profile)
