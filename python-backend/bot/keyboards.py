from __future__ import annotations
from telegram import InlineKeyboardButton, InlineKeyboardMarkup


def main_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("📊 Stats", callback_data="stats"),
            InlineKeyboardButton("👤 Comptes", callback_data="accounts"),
        ],
        [
            InlineKeyboardButton("📣 Campagnes", callback_data="campaigns"),
            InlineKeyboardButton("👥 Groupes", callback_data="groups"),
        ],
        [
            InlineKeyboardButton("🤖 IA", callback_data="ai_menu"),
            InlineKeyboardButton("🎯 Leads", callback_data="leads"),
        ],
        [
            InlineKeyboardButton("🛡 Sécurité", callback_data="security"),
            InlineKeyboardButton("⚙️ Système", callback_data="system"),
        ],
        [
            InlineKeyboardButton("📋 Messages récents", callback_data="messages"),
        ],
    ])


def accounts_kb(accounts: list) -> InlineKeyboardMarkup:
    buttons = []
    for acc in accounts[:10]:
        health = acc["health_score"]
        icon = "🟢" if health >= 80 else ("🟡" if health >= 50 else "🔴")
        label = f"{icon} {acc['phone_number']} ({health})"
        buttons.append([InlineKeyboardButton(label, callback_data=f"account_{acc['id']}")])
    buttons.append([InlineKeyboardButton("➕ Connecter un compte", callback_data="add_account")])
    buttons.append([InlineKeyboardButton("🏠 Menu", callback_data="main_menu")])
    return InlineKeyboardMarkup(buttons)


def account_detail_kb(account_id: int, is_connected: bool) -> InlineKeyboardMarkup:
    action_btn = (
        InlineKeyboardButton("🔴 Déconnecter", callback_data=f"disconnect_{account_id}")
        if is_connected
        else InlineKeyboardButton("🟢 Connecter", callback_data=f"connect_{account_id}")
    )
    return InlineKeyboardMarkup([
        [action_btn],
        [
            InlineKeyboardButton("📈 Santé", callback_data=f"health_{account_id}"),
            InlineKeyboardButton("🔥 Warmup", callback_data=f"warmup_{account_id}"),
        ],
        [InlineKeyboardButton("🔙 Comptes", callback_data="accounts")],
    ])


def campaigns_kb(campaigns: list) -> InlineKeyboardMarkup:
    buttons = []
    for c in campaigns[:8]:
        status = c["status"]
        icon = {"active": "▶️", "draft": "📝", "paused": "⏸", "completed": "✅"}.get(status, "❓")
        buttons.append([InlineKeyboardButton(f"{icon} {c['name']}", callback_data=f"campaign_{c['id']}")])
    buttons.append([InlineKeyboardButton("🏠 Menu", callback_data="main_menu")])
    return InlineKeyboardMarkup(buttons)


def campaign_detail_kb(campaign_id: int, status: str) -> InlineKeyboardMarkup:
    if status == "active":
        action = InlineKeyboardButton("⏹ Arrêter", callback_data=f"stop_campaign_{campaign_id}")
    else:
        action = InlineKeyboardButton("▶️ Démarrer", callback_data=f"start_campaign_{campaign_id}")
    return InlineKeyboardMarkup([
        [action],
        [InlineKeyboardButton("🔙 Campagnes", callback_data="campaigns")],
    ])


def security_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🚨 Événements", callback_data="sec_events"),
            InlineKeyboardButton("⛔ Sanctions", callback_data="sanctions"),
        ],
        [
            InlineKeyboardButton("🌊 FloodWaits", callback_data="floodwaits"),
            InlineKeyboardButton("⚠️ Escalations", callback_data="escalations"),
        ],
        [InlineKeyboardButton("🏠 Menu", callback_data="main_menu")],
    ])


def system_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🌐 Proxies", callback_data="proxies"),
            InlineKeyboardButton("🗓 Schedules", callback_data="schedules"),
        ],
        [
            InlineKeyboardButton("🔥 Tous les Warmups", callback_data="warmups"),
            InlineKeyboardButton("⚙️ Paramètres", callback_data="settings"),
        ],
        [InlineKeyboardButton("🏠 Menu", callback_data="main_menu")],
    ])


def ai_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("👥 Personnalités", callback_data="personalities"),
            InlineKeyboardButton("📝 Générer msg", callback_data="gen_prompt"),
        ],
        [
            InlineKeyboardButton("📋 Logs IA", callback_data="ai_logs"),
            InlineKeyboardButton("🧪 Tests A/B", callback_data="ab_tests"),
        ],
        [InlineKeyboardButton("🏠 Menu", callback_data="main_menu")],
    ])


def leads_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton("🧊 Cold", callback_data="leads_cold"),
            InlineKeyboardButton("🌤 Warm", callback_data="leads_warm"),
            InlineKeyboardButton("🔥 Hot", callback_data="leads_hot"),
        ],
        [
            InlineKeyboardButton("💰 Convertis", callback_data="leads_converted"),
            InlineKeyboardButton("📊 Pipeline", callback_data="leads_pipeline"),
        ],
        [InlineKeyboardButton("🏠 Menu", callback_data="main_menu")],
    ])


def back_to_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([[InlineKeyboardButton("🏠 Menu principal", callback_data="main_menu")]])
