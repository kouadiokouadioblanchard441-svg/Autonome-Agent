"""
Real-Time Intelligence — fetches live data for content generation.
- Crypto prices (CoinGecko, free, no key)
- News headlines (RSS from AFP, BBC, Al Jazeera, Le Monde, Reuters)
- Market data (stocks via Yahoo Finance RSS)
All requests are cached 10-30 min to avoid hammering APIs.
"""
from __future__ import annotations

import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from typing import Optional

logger = logging.getLogger(__name__)

# Simple in-memory cache: key → (timestamp, data)
_cache: dict[str, tuple[float, any]] = {}
CRYPTO_TTL   = 300    # 5 min
NEWS_TTL     = 1800   # 30 min
MARKET_TTL   = 600    # 10 min


def _cached(key: str, ttl: int):
    entry = _cache.get(key)
    if entry and time.time() - entry[0] < ttl:
        return entry[1]
    return None


def _store(key: str, data):
    _cache[key] = (time.time(), data)
    return data


# ── Crypto Prices (CoinGecko free) ────────────────────────────────────────────

COIN_IDS = {
    "BTC": "bitcoin", "ETH": "ethereum", "BNB": "binancecoin",
    "SOL": "solana",  "ADA": "cardano",  "XRP": "ripple",
    "MATIC": "matic-network", "DOT": "polkadot", "AVAX": "avalanche-2",
    "DOGE": "dogecoin", "TON": "the-open-network", "LINK": "chainlink",
}

async def get_crypto_prices(
    symbols: list[str] = ["BTC", "ETH", "BNB", "SOL"],
    vs_currency: str = "usd",
) -> dict[str, dict]:
    """
    Fetch live crypto prices from CoinGecko.
    Returns dict: {symbol: {price, change_24h, market_cap}}
    """
    key = f"crypto_{','.join(symbols)}_{vs_currency}"
    cached = _cached(key, CRYPTO_TTL)
    if cached:
        return cached

    ids = [COIN_IDS.get(s.upper(), s.lower()) for s in symbols]
    url = (
        f"https://api.coingecko.com/api/v3/simple/price"
        f"?ids={','.join(ids)}&vs_currencies={vs_currency}"
        f"&include_24hr_change=true&include_market_cap=true"
    )
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            data = resp.json()

        result = {}
        for sym, coin_id in zip(symbols, ids):
            coin_data = data.get(coin_id, {})
            if coin_data:
                result[sym.upper()] = {
                    "price":     coin_data.get(vs_currency, 0),
                    "change_24h": coin_data.get(f"{vs_currency}_24h_change", 0),
                    "market_cap": coin_data.get(f"{vs_currency}_market_cap", 0),
                }
        return _store(key, result)
    except Exception as e:
        logger.warning("CoinGecko fetch failed: %s", e)
        return {}


def format_crypto_update(prices: dict[str, dict], language: str = "fr") -> str:
    """Format crypto prices into a readable Telegram message."""
    if not prices:
        return ""
    lines = ["📊 *Mise à jour du marché crypto*\n" if language == "fr" else "📊 *Crypto Market Update*\n"]
    for sym, data in prices.items():
        price    = data.get("price", 0)
        change   = data.get("change_24h", 0)
        arrow    = "🟢 +" if change >= 0 else "🔴 "
        price_fmt = f"${price:,.2f}" if price < 10000 else f"${price:,.0f}"
        lines.append(f"• **{sym}**: {price_fmt} {arrow}{change:.2f}%")
    return "\n".join(lines)


# ── News (RSS feeds) ──────────────────────────────────────────────────────────

RSS_FEEDS: dict[str, dict[str, str]] = {
    "fr": {
        "rfi":     "https://www.rfi.fr/fr/rss",
        "lemonde": "https://www.lemonde.fr/rss/une.xml",
        "france24":"https://www.france24.com/fr/rss",
    },
    "en": {
        "bbc":     "http://feeds.bbci.co.uk/news/rss.xml",
        "reuters": "https://feeds.reuters.com/reuters/topNews",
    },
    "ar": {
        "aljazeera": "https://www.aljazeera.net/xml/rss/all.xml",
        "bbc_ar":    "http://feeds.bbci.co.uk/arabic/rss.xml",
    },
    "es": {
        "elpais": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada",
    },
    "pt": {
        "globo": "https://g1.globo.com/rss/g1/",
    },
}

# Topic-specific RSS feeds
TOPIC_FEEDS: dict[str, list[str]] = {
    "crypto":     ["https://coinjournal.net/feed/", "https://cryptonews.com/rss/"],
    "technology": ["https://feeds.feedburner.com/TechCrunch", "https://www.theverge.com/rss/index.xml"],
    "ai":         ["https://openai.com/blog/rss.xml"],
    "sports":     ["http://feeds.bbci.co.uk/sport/rss.xml", "https://www.espn.com/espn/rss/news"],
    "science":    ["https://www.sciencedaily.com/rss/all.xml"],
    "health":     ["https://www.who.int/rss-feeds/news-english.xml"],
    "finance":    ["https://feeds.reuters.com/reuters/businessNews"],
    "politics":   ["https://feeds.reuters.com/Reuters/PoliticsNews"],
}


async def _fetch_rss(url: str, max_items: int = 5) -> list[dict]:
    """Fetch and parse an RSS feed. Returns list of {title, link, summary}."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as http:
            resp = await http.get(url, headers={"User-Agent": "Mozilla/5.0"})
            resp.raise_for_status()
            root = ET.fromstring(resp.text)
    except Exception as e:
        logger.warning("RSS fetch failed for %s: %s", url, e)
        return []

    items = []
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    for item in (root.findall(".//item") or root.findall(".//atom:entry", ns))[:max_items]:
        title_el   = item.find("title")
        link_el    = item.find("link")
        desc_el    = item.find("description") or item.find("summary")
        title   = (title_el.text or "").strip() if title_el is not None else ""
        link    = (link_el.text or (link_el.get("href", "") if link_el is not None else "")).strip()
        summary = (desc_el.text or "").strip()[:200] if desc_el is not None else ""
        # Strip HTML tags
        summary = ET.fromstring(f"<r>{summary}</r>").itertext().__next__() if summary else ""
        if title:
            items.append({"title": title, "link": link, "summary": summary})
    return items


async def get_latest_news(
    community_type: str = "news",
    language: str = "fr",
    max_items: int = 5,
) -> list[dict]:
    """Fetch latest news for a given community type and language."""
    key = f"news_{community_type}_{language}"
    cached = _cached(key, NEWS_TTL)
    if cached:
        return cached

    # Try topic-specific feed first
    topic_urls = TOPIC_FEEDS.get(community_type, [])
    lang_feeds = RSS_FEEDS.get(language, RSS_FEEDS["fr"])
    lang_urls  = list(lang_feeds.values())[:2]

    all_items: list[dict] = []
    tasks = [_fetch_rss(url, max_items) for url in (topic_urls[:1] + lang_urls[:1])]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, list):
            all_items.extend(r)

    items = all_items[:max_items]
    return _store(key, items)


def format_news_bulletin(
    items: list[dict],
    community_type: str = "news",
    language: str = "fr",
) -> str:
    """Format news items into a Telegram-ready bulletin."""
    if not items:
        return ""
    headers = {
        "fr": "📰 *Actualités du jour*",
        "en": "📰 *Today's Headlines*",
        "ar": "📰 *أخبار اليوم*",
        "es": "📰 *Noticias del día*",
        "pt": "📰 *Notícias do dia*",
    }
    header = headers.get(language, headers["fr"])
    lines = [header, ""]
    for i, item in enumerate(items[:5], 1):
        title = item.get("title", "")
        lines.append(f"{i}. {title}")
    return "\n".join(lines)


# ── Contextual Content Builder ────────────────────────────────────────────────

async def build_realtime_context(
    community_type: str,
    language: str,
    keywords: list[str] = [],
) -> str:
    """
    Build a real-time context string to inject into content generation.
    Combines live data (crypto prices, news) relevant to the community.
    """
    parts = []

    if community_type in ("crypto", "investment", "finance"):
        prices = await get_crypto_prices(["BTC", "ETH", "BNB", "SOL"])
        if prices:
            update = format_crypto_update(prices, language)
            parts.append(update)

    news = await get_latest_news(community_type, language, max_items=3)
    if news:
        bulletin = format_news_bulletin(news, community_type, language)
        parts.append(bulletin)

    return "\n\n".join(parts)


async def enrich_post_with_realtime(
    base_text: str,
    community_type: str,
    language: str,
) -> str:
    """
    If we have real-time data, incorporate one fact/headline into the post.
    Returns the (possibly) enriched text.
    """
    if community_type in ("crypto", "investment", "finance"):
        prices = await get_crypto_prices(["BTC", "ETH"])
        if prices and "BTC" in prices:
            btc = prices["BTC"]
            change = btc.get("change_24h", 0)
            direction = "🟢 en hausse" if change >= 0 else "🔴 en baisse"
            fact = f"\n\n💡 BTC est {direction} de {abs(change):.1f}% sur 24h."
            if language == "en":
                direction_en = "🟢 up" if change >= 0 else "🔴 down"
                fact = f"\n\n💡 BTC is {direction_en} {abs(change):.1f}% in 24h."
            base_text += fact

    return base_text
