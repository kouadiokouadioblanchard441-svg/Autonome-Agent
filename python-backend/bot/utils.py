from __future__ import annotations
import os
import asyncpg

DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL") or os.getenv("DATABASE_URL", "")
_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5, ssl="require", statement_cache_size=0)
    return _pool


async def db_fetch(query: str, *args):
    pool = await get_pool()
    return await pool.fetch(query, *args)


async def db_fetchrow(query: str, *args):
    pool = await get_pool()
    return await pool.fetchrow(query, *args)


async def db_fetchval(query: str, *args):
    pool = await get_pool()
    return await pool.fetchval(query, *args)


async def db_execute(query: str, *args):
    pool = await get_pool()
    return await pool.execute(query, *args)


def fmt_status(status) -> str:
    if status is None:
        return "❓ N/A"
    icons = {
        "active": "🟢", "inactive": "🔴", "cooldown": "🟡", "banned": "⛔",
        "draft": "📝", "paused": "⏸", "completed": "✅", "running": "▶️",
        "cold": "🧊", "warm": "🌤", "hot": "🔥", "contacted": "📨",
        "interested": "👀", "negotiating": "🤝", "converted": "💰", "lost": "❌",
        "pending": "⏳", "reviewed": "👁", "resolved": "✅", "ignored": "🚫",
    }
    return f"{icons.get(status, '❓')} {status}"


def fmt_health(score: int) -> str:
    if score >= 80:
        return f"🟢 {score}/100"
    elif score >= 50:
        return f"🟡 {score}/100"
    else:
        return f"🔴 {score}/100"


def chunk_text(text: str, size: int = 4000) -> list[str]:
    return [text[i:i+size] for i in range(0, len(text), size)]


ADMIN_ID = int(os.getenv("ADMIN_TELEGRAM_ID", "0"))


def is_admin(user_id: int) -> bool:
    return ADMIN_ID == 0 or user_id == ADMIN_ID
