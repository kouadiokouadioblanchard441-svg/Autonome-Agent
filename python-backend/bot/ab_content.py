"""
A/B Content Testing — per-community AI prompt variant testing.

Two prompt variants (A and B) are injected alternately into the autopost loop
for a specific channel or group. Engagement (reactions) is tracked automatically
after each post to determine which prompt generates more community activity.
"""
from __future__ import annotations
import asyncio
import json
import logging
import time

logger = logging.getLogger(__name__)

# In-memory store: (chat_type, tg_id) → {test_id, variant, message_id, sent_at}
_last_sent: dict[tuple, dict] = {}


# ── DB helpers ─────────────────────────────────────────────────────────────────

async def get_active_community_test(pool, chat_type: str, tg_id: str) -> dict | None:
    """Return the active A/B test linked to this community, or None."""
    if not pool:
        return None
    try:
        row = await pool.fetchrow(
            """SELECT id, name, variant_a, variant_b, sent_a, sent_b,
                      replies_a, replies_b, reactions_a, reactions_b,
                      reply_rate_a, reply_rate_b, target_count,
                      winner_variant, status, prompt_mode,
                      last_variant_sent, auto_select_winner,
                      confidence_threshold
               FROM ab_tests
               WHERE community_type = $1
                 AND community_id   = $2
                 AND status         = 'active'
               ORDER BY started_at DESC
               LIMIT 1""",
            chat_type, str(tg_id),
        )
        if row:
            return dict(row)
    except Exception as e:
        logger.warning("[AB] get_active_community_test error: %s", e)
    return None


async def get_next_variant(pool, test_id: int) -> str:
    """Return 'a' or 'b' — alternates to keep sent counts balanced."""
    if not pool:
        return "a"
    try:
        row = await pool.fetchrow(
            "SELECT sent_a, sent_b FROM ab_tests WHERE id = $1", test_id
        )
        if row:
            return "a" if row["sent_a"] <= row["sent_b"] else "b"
    except Exception as e:
        logger.warning("[AB] get_next_variant error: %s", e)
    return "a"


async def record_ab_sent(pool, test_id: int, variant: str, message_id: int | None = None,
                          chat_type: str = "", tg_id: str = "") -> None:
    """Increment sentA or sentB and store the last variant sent."""
    if not pool:
        return
    try:
        col = "sent_a" if variant == "a" else "sent_b"
        await pool.execute(
            f"""UPDATE ab_tests
                SET {col} = {col} + 1,
                    last_variant_sent = $1
                WHERE id = $2""",
            variant, test_id,
        )
        # Store in memory for reaction tracking
        if chat_type and tg_id:
            _last_sent[(chat_type, tg_id)] = {
                "test_id": test_id,
                "variant": variant,
                "message_id": message_id,
                "sent_at": time.time(),
            }
        logger.debug("[AB] Test %d — sent variant %s (msg_id=%s)", test_id, variant, message_id)
    except Exception as e:
        logger.warning("[AB] record_ab_sent error: %s", e)


async def record_ab_engagement(pool, test_id: int, variant: str,
                                kind: str = "reply") -> None:
    """
    Record an engagement event (reply or reaction) for a variant.
    Recalculates reply rates and auto-selects winner if threshold is met.
    """
    if not pool:
        return
    try:
        col_eng = f"replies_{variant}" if kind == "reply" else f"reactions_{variant}"
        await pool.execute(
            f"UPDATE ab_tests SET {col_eng} = {col_eng} + 1 WHERE id = $1",
            test_id,
        )
        # Recalculate rates and check for winner
        row = await pool.fetchrow(
            """SELECT sent_a, sent_b, replies_a, replies_b,
                      reactions_a, reactions_b,
                      target_count, auto_select_winner, confidence_threshold
               FROM ab_tests WHERE id = $1""",
            test_id,
        )
        if not row:
            return

        eng_a = row["replies_a"] + row["reactions_a"]
        eng_b = row["replies_b"] + row["reactions_b"]
        rate_a = eng_a / row["sent_a"] if row["sent_a"] > 0 else 0.0
        rate_b = eng_b / row["sent_b"] if row["sent_b"] > 0 else 0.0

        await pool.execute(
            "UPDATE ab_tests SET reply_rate_a = $1, reply_rate_b = $2 WHERE id = $3",
            round(rate_a, 4), round(rate_b, 4), test_id,
        )

        # Auto-select winner when both have min 10 sends and difference > threshold
        min_sent = min(row["sent_a"], row["sent_b"])
        if row["auto_select_winner"] and min_sent >= 10:
            diff = abs(rate_a - rate_b)
            threshold = float(row["confidence_threshold"]) if row["confidence_threshold"] else 0.05
            if diff >= threshold:
                winner = "a" if rate_a >= rate_b else "b"
                await pool.execute(
                    """UPDATE ab_tests
                       SET winner_variant = $1,
                           status = 'completed',
                           completed_at = NOW()
                       WHERE id = $2""",
                    winner, test_id,
                )
                logger.info(
                    "[AB] Test %d — auto-winner: %s (rate_a=%.3f rate_b=%.3f diff=%.3f)",
                    test_id, winner.upper(), rate_a, rate_b, diff,
                )
    except Exception as e:
        logger.warning("[AB] record_ab_engagement error: %s", e)


# ── Reaction polling ───────────────────────────────────────────────────────────

async def poll_reactions_for_test(client, pool, test_id: int,
                                   channel_id: str, message_id: int,
                                   variant: str) -> int:
    """
    Poll Telegram for total reactions on a specific message.
    Returns the number of new reactions recorded.
    """
    if not client or not message_id:
        return 0
    try:
        from telethon.tl.functions.messages import GetMessagesReactionsRequest
        result = await client(GetMessagesReactionsRequest(
            peer=int(channel_id),
            id=[message_id],
        ))
        total = sum(r.count for r in getattr(result, "reactions", {}).get("results", []))
        if total > 0:
            await record_ab_engagement(pool, test_id, variant, kind="reaction")
        return total
    except Exception as e:
        logger.debug("[AB] poll_reactions error: %s", e)
        return 0


async def ab_reaction_poller(clients: dict, pool, stop_event: asyncio.Event) -> None:
    """
    Background task: every 30 minutes, poll reactions for all active A/B test posts
    that were sent in the last 24 hours.
    """
    while not stop_event.is_set():
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=1800)  # 30 min
        except asyncio.TimeoutError:
            pass
        if stop_event.is_set():
            break

        try:
            cutoff = time.time() - 86400  # 24h
            for (chat_type, tg_id), info in list(_last_sent.items()):
                if info["sent_at"] < cutoff:
                    continue
                if not info.get("message_id"):
                    continue
                # Pick any available client
                client = next(iter(clients.values()), None) if clients else None
                if client:
                    await poll_reactions_for_test(
                        client, pool,
                        info["test_id"], tg_id, info["message_id"], info["variant"],
                    )
        except Exception as e:
            logger.warning("[AB] Reaction poller error: %s", e)


# ── Status for monitoring/dashboard ───────────────────────────────────────────

async def get_all_community_tests(pool) -> list[dict]:
    """Return all A/B tests that are linked to a community (active or completed)."""
    if not pool:
        return []
    try:
        rows = await pool.fetch(
            """SELECT id, name, community_type, community_id, prompt_mode,
                      variant_a, variant_b, status, winner_variant,
                      sent_a, sent_b, replies_a, replies_b,
                      reactions_a, reactions_b,
                      reply_rate_a, reply_rate_b,
                      target_count, started_at, completed_at, created_at
               FROM ab_tests
               WHERE community_type IS NOT NULL
               ORDER BY created_at DESC"""
        )
        result = []
        for row in rows:
            d = dict(row)
            # Compute total engagement per variant
            d["engagement_a"] = d["replies_a"] + d["reactions_a"]
            d["engagement_b"] = d["replies_b"] + d["reactions_b"]
            # Determine leading variant
            d["leading"] = (
                "a" if d["reply_rate_a"] > d["reply_rate_b"]
                else "b" if d["reply_rate_b"] > d["reply_rate_a"]
                else None
            )
            # Stringify datetimes
            for f in ("started_at", "completed_at", "created_at"):
                if d.get(f):
                    d[f] = d[f].isoformat()
            result.append(d)
        return result
    except Exception as e:
        logger.warning("[AB] get_all_community_tests error: %s", e)
        return []
