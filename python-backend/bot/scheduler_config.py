"""
Per-community schedule configuration.
Stored in app_settings: key = community_schedule_{chat_type}_{tg_id}

Presets (seconds):
  30min=1800  1h=3600  4h=14400  8h=28800  daily=86400  weekly=604800
"""
from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)

SCHEDULE_PRESETS: dict[str, int] = {
    "30min":  1800,
    "1h":     3600,
    "2h":     7200,
    "4h":     14400,
    "8h":     28800,
    "daily":  86400,
    "weekly": 604800,
}

CONTENT_ROTATION = [
    "market_summary",
    "analysis",
    "educational",
    "motivation",
    "anecdote",
    "engagement_question",
    "news",
    "report",
]

DEFAULT_SCHEDULE = {
    "interval_preset":  "4h",
    "interval_seconds": 14400,
    "content_rotation": CONTENT_ROTATION,
    "post_with_image":  True,
    "post_with_video":  False,
    "enabled":          True,
    "language":         "fr",
    "forbidden_topics": [],
    "custom_instructions": "",
}


def _key(chat_type: str, tg_id: str) -> str:
    return f"community_schedule_{chat_type}_{tg_id}"


async def get_schedule_config(pool, chat_type: str, tg_id: str) -> dict:
    try:
        row = await pool.fetchrow(
            "SELECT value FROM app_settings WHERE key = $1",
            _key(chat_type, tg_id),
        )
        if row and row["value"]:
            return {**DEFAULT_SCHEDULE, **json.loads(row["value"])}
    except Exception as e:
        logger.warning("get_schedule_config: %s", e)
    return dict(DEFAULT_SCHEDULE)


async def save_schedule_config(pool, chat_type: str, tg_id: str, config: dict) -> None:
    try:
        preset = config.get("interval_preset", "4h")
        if preset in SCHEDULE_PRESETS:
            config["interval_seconds"] = SCHEDULE_PRESETS[preset]
        await pool.execute(
            """INSERT INTO app_settings (key, value, description)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()""",
            _key(chat_type, tg_id),
            json.dumps(config, ensure_ascii=False),
            f"Schedule config — {chat_type} {tg_id}",
        )
    except Exception as e:
        logger.warning("save_schedule_config: %s", e)


async def get_interval_seconds(pool, chat_type: str, tg_id: str) -> int:
    cfg = await get_schedule_config(pool, chat_type, tg_id)
    return int(cfg.get("interval_seconds", 14400))


async def get_content_type_for_post(pool, chat_type: str, tg_id: str, post_index: int) -> str:
    cfg = await get_schedule_config(pool, chat_type, tg_id)
    rotation = cfg.get("content_rotation") or CONTENT_ROTATION
    return rotation[post_index % len(rotation)]
