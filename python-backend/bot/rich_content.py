"""
Rich Content Engine — Nexus AI
================================
Génère des contenus riches, détaillés et engageants par thématique.
Chaque post contient : analyse + conseil expert + anecdote/fait + données réelles.

Topics supportés avec contenu premium :
  crypto / finance / business / marketing / education / health / sports /
  politics / technology / ai / religion / lifestyle / motivational / news / community
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


# ── Anecdotes & facts par topic ───────────────────────────────────────────────

ANECDOTES: dict[str, list[str]] = {
    "crypto": [
        "💡 *Saviez-vous ?* Le créateur de Bitcoin, Satoshi Nakamoto, n'a jamais dépensé ses ~1 million de BTC estimés. Sa fortune vaut aujourd'hui des milliards, mais reste intouchée.",
        "💡 *Fait historique :* En 2010, Laszlo Hanyecz a payé 10 000 BTC pour deux pizzas — soit plus de 600 millions $ aujourd'hui. C'est le premier achat réel en Bitcoin.",
        "💡 *Le saviez-vous ?* Il n'existera jamais plus de 21 millions de BTC. Environ 3-4 millions sont déjà perdus à jamais (wallets oubliés, disques durs perdus...).",
        "💡 *Anecdote :* Ethereum a été rejeté par toutes les grandes sociétés de capital-risque en 2014. Vitalik Buterin avait 19 ans quand il a conçu ce protocole qui vaut aujourd'hui des centaines de milliards.",
        "💡 *Fait :* Le premier exchange Bitcoin, Mt.Gox, gérait 70% des transactions mondiales avant de s'effondrer en 2014. Une leçon sur l'importance de la garde de ses clés privées.",
        "💡 *Philosophie crypto :* 'Not your keys, not your coins.' Si vous ne contrôlez pas vos clés privées, vous ne contrôlez pas vraiment vos crypto-actifs.",
        "💡 *Record :* La plus haute valorisation de Bitcoin a été atteinte en mars 2024 à ~73 000$. Chaque bear market a été suivi d'un nouveau sommet historique.",
        "💡 *Technologie :* Un seul bloc Bitcoin ne peut contenir qu'environ 2 000 transactions. Ethereum traite actuellement ~15 transactions par seconde. C'est pourquoi les Layer 2 sont essentiels.",
    ],
    "finance": [
        "💡 *Règle des 72 :* Divisez 72 par votre taux d'intérêt annuel pour savoir en combien d'années votre capital double. À 8% → 9 ans. À 12% → 6 ans.",
        "💡 *Warren Buffett dit :* 'La règle n°1 : ne jamais perdre d'argent. La règle n°2 : ne jamais oublier la règle n°1.' La préservation du capital prime sur tout.",
        "💡 *Fait surprenant :* 90% des traders perdent de l'argent à long terme. Les 10% restants appliquent une discipline de fer sur la gestion du risque.",
        "💡 *Peter Lynch :* 'Investissez dans ce que vous comprenez.' Les meilleurs investissements viennent souvent d'observer votre quotidien — les produits que vous utilisez chaque jour.",
        "💡 *L'effet des frais :* Des frais de gestion de 2% vs 0,1% semblent insignifiants, mais sur 30 ans, ils peuvent vous coûter 40% de votre capital final. Chaque point de base compte.",
        "💡 *Fait :* Le marché boursier américain a produit un rendement moyen de 10% par an sur 100 ans, dividendes inclus. Le temps est votre meilleur allié.",
        "💡 *Psychologie des marchés :* En 2008, quand tout le monde vendait dans la panique, ceux qui achetaient des actions de qualité ont multiplié leur capital par 3-5x dans les années suivantes.",
        "💡 *L'inflation :* 1 000€ en 2000 ne valent que ~600€ en pouvoir d'achat aujourd'hui. Ne pas investir, c'est garantir de s'appauvrir lentement.",
    ],
    "business": [
        "💡 *Jeff Bezos :* 'Votre marge est mon opportunité.' Cherchez toujours où les marges sont élevées dans une industrie — c'est là que la disruption arrive.",
        "💡 *Fait :* 90% des startups échouent. Mais 80% des entrepreneurs ayant connu un échec réussissent à leur deuxième tentative. L'échec est une formation.",
        "💡 *Pareto :* 80% de vos revenus proviennent de 20% de vos clients. Identifiez et chouchoutez ces 20% — le reste suivra.",
        "💡 *Elon Musk :* 'Si vous avez besoin d'encouragement pour faire quelque chose, ne le faites pas. Les meilleures entreprises sont fondées par des gens qui ne peuvent pas s'en empêcher.'",
        "💡 *Apple en 1997 :* Quand Steve Jobs est revenu, Apple avait 90 jours de trésorerie. En réduisant sa gamme de 350 produits à 10, il a sauvé et transformé l'entreprise.",
        "💡 *Loi de Moore :* Les capacités technologiques doublent tous les 18-24 mois. Les entreprises qui intègrent cette courbe surpassent systématiquement celles qui l'ignorent.",
    ],
    "technology": [
        "💡 *Saviez-vous ?* La première version d'Android était initialement conçue pour les appareils photo, pas pour les téléphones. Google l'a pivotée après avoir vu l'iPhone.",
        "💡 *Fait :* Un simple smartphone aujourd'hui a plus de puissance de calcul que toute la NASA en 1969 lors de la mission Apollo 11.",
        "💡 *Moore's Law :* Gordon Moore a prédit en 1965 que le nombre de transistors doublerait tous les 2 ans. Cette loi tient toujours, 60 ans plus tard.",
        "💡 *Internet :* En 1993, il y avait 130 sites web dans le monde. En 2024, plus de 1,8 milliard de sites. La croissance exponentielle est la règle, pas l'exception.",
    ],
    "ai": [
        "💡 *GPT-4 :* Le modèle a été entraîné sur environ 1 trillion de tokens — soit l'équivalent de plusieurs millions de livres. Pourtant, il 'hallucine' encore régulièrement.",
        "💡 *AlphaGo :* En 2016, DeepMind's AlphaGo a battu le champion mondial de Go. Le Go a 10^170 positions possibles — plus que d'atomes dans l'univers observable.",
        "💡 *Fait :* L'IA consomme énormément d'énergie. Entraîner GPT-3 a émis environ 300 tonnes de CO2 — l'équivalent de 125 vols Paris-New York.",
        "💡 *Turing Test :* Alan Turing a proposé ce test en 1950. En 2024, plusieurs modèles IA le passent régulièrement — mais le vrai test de l'intelligence reste largement débattu.",
    ],
    "health": [
        "💡 *Sommeil :* Dormir moins de 6h par nuit pendant 2 semaines altère vos capacités cognitives autant que rester éveillé 24h d'affilée. La dette de sommeil est réelle.",
        "💡 *Exercice :* 30 minutes de marche rapide par jour réduisent de 35% le risque de maladies cardiovasculaires. C'est l'investissement santé le plus rentable qui existe.",
        "💡 *Eau :* Une déshydratation de seulement 2% réduit vos performances cognitives de 20%. Boire suffisamment d'eau améliore concentration et humeur.",
        "💡 *Jeûne intermittent :* Des études montrent que manger dans une fenêtre de 8 heures (ex : 12h-20h) améliore la sensibilité à l'insuline et favorise la régénération cellulaire.",
    ],
    "sports": [
        "💡 *Michael Jordan :* A été coupé de son équipe de lycée à 15 ans. Il est devenu le joueur le plus titré de l'histoire NBA. Le refus est parfois le meilleur carburant.",
        "💡 *Règle des 10 000 heures :* Selon Malcolm Gladwell, maîtriser n'importe quelle compétence requiert environ 10 000 heures de pratique délibérée.",
        "💡 *Récupération :* Les muscles ne poussent pas pendant l'entraînement, mais pendant la récupération. Dormir 8h + protéines suffisantes = 40% de gains supplémentaires.",
        "💡 *Mentalité :* Les athlètes olympiques visualisent leur performance avant de la réaliser. La préparation mentale représente 50% de la performance sportive.",
    ],
    "motivational": [
        "💡 *Einstein :* 'L'imagination est plus importante que le savoir. Le savoir est limité, l'imagination encercle le monde.'",
        "💡 *La loi des 1% :* S'améliorer de 1% par jour pendant 1 an = 37x meilleur. Se dégrader de 1% par jour pendant 1 an = presque zéro. L'accumulation est tout.",
        "💡 *Churchill :* 'Le succès, c'est aller d'échec en échec sans perdre son enthousiasme.' La résilience prime sur le talent.",
        "💡 *Stoïcisme :* Marc Aurèle, l'un des empereurs romains les plus puissants, écrivait chaque matin : 'Que puis-je faire aujourd'hui pour mériter ma place ?' La gratitude et l'action.",
        "💡 *Jeff Bezos :* 'Je veux être dans la position où je peux regretter mes tentatives, pas mes inactions.' Les regrets d'action s'estompent, les regrets d'inaction restent.",
    ],
    "education": [
        "💡 *Courbe de l'oubli :* Sans révision, on oublie 70% de ce qu'on a appris en 24h. La répétition espacée multiplie par 5 la rétention à long terme.",
        "💡 *Technique Feynman :* Expliquer un concept comme à un enfant de 10 ans est le meilleur test de compréhension. Si vous ne pouvez pas simplifier, vous ne comprenez pas vraiment.",
        "💡 *La méthode Pomodoro :* 25 minutes de concentration intense + 5 minutes de pause = 4x plus productif qu'une session continue de 2 heures.",
        "💡 *Socrate :* 'Je sais que je ne sais rien.' Les experts sont humbles sur les limites de leur savoir. Les débutants se croient souvent omniscients.',",
    ],
    "news": [
        "💡 *Biais médiatique :* Les cerveaux humains retiennent 6x mieux les mauvaises nouvelles que les bonnes. Les médias amplifient le négatif non par malice, mais parce que ça fonctionne.",
        "💡 *Vérification :* Avant de partager une information, posez-vous : Qui ? Quand ? Source primaire ? Des outils comme Snopes ou AFP Factuel permettent de vérifier rapidement.",
        "💡 *Chambre d'écho :* Les algorithmes des réseaux sociaux vous montrent ce que vous aimez déjà. Suivre des sources opposées à vos opinions est le meilleur vaccin contre la désinformation.",
    ],
    "community": [
        "💡 *Dunbar's Number :* Les humains peuvent maintenir des relations authentiques avec environ 150 personnes max. Les communautés les plus solides gardent une taille humaine.",
        "💡 *Effet réseau :* La valeur d'un réseau croît exponentiellement avec le nombre de membres. Chaque nouveau membre bénéficie à tous les autres.",
        "💡 *Robert Cialdini :* La preuve sociale est l'un des 6 principes d'influence les plus puissants. Ce que font les autres dans votre communauté influence vos décisions.",
    ],
}

# Fallback
for _k in list(ANECDOTES.keys()):
    ANECDOTES.setdefault("investment", ANECDOTES["finance"])
    ANECDOTES.setdefault("realestate", ANECDOTES["business"])
    ANECDOTES.setdefault("marketing", ANECDOTES["business"])
    ANECDOTES.setdefault("gaming", ANECDOTES["technology"])
    ANECDOTES.setdefault("science", ANECDOTES["technology"])
    ANECDOTES.setdefault("religion", ANECDOTES["community"])
    ANECDOTES.setdefault("lifestyle", ANECDOTES["health"])
    ANECDOTES.setdefault("startups", ANECDOTES["business"])
    ANECDOTES.setdefault("ecommerce", ANECDOTES["business"])
    ANECDOTES.setdefault("politics", ANECDOTES["news"])
    break

# ── Expert tips par topic ────────────────────────────────────────────────────

EXPERT_TIPS: dict[str, list[str]] = {
    "crypto": [
        "📌 *Conseil d'expert :* Ne mettez jamais plus de 5% de votre patrimoine dans une seule crypto. La diversification entre BTC, ETH et quelques altcoins solides est la base.",
        "📌 *DCA Strategy :* Investir un montant fixe chaque semaine ou mois (Dollar Cost Averaging) surperforme dans 80% des cas le timing de marché. La discipline bat l'intelligence.",
        "📌 *Sécurité :* Utilisez un hardware wallet (Ledger, Trezor) pour tout montant supérieur à 1 000€. Les exchanges peuvent être hackés — vos clés privées doivent être hors-ligne.",
        "📌 *Analyse on-chain :* Avant d'investir, vérifiez les métriques on-chain : wallets actifs, flux d'échange, positions des baleines. Des outils comme Glassnode ou CryptoQuant sont vos alliés.",
        "📌 *FOMO management :* Si vous entendez parler d'une crypto dans la presse grand public, c'est souvent trop tard. Les meilleures entrées se font dans l'indifférence, pas dans l'euphorie.",
        "📌 *Take profit :* Définissez vos objectifs de sortie AVANT d'entrer en position. Décidez à l'avance : à +50%, je vends 25%. À +100%, je sécurise ma mise initiale.",
    ],
    "finance": [
        "📌 *Règle d'or :* Payez-vous en premier — épargnez 10-20% de chaque revenu avant toute dépense. Automatisez ce virement le jour du salaire.",
        "📌 *Fonds d'urgence :* Avoir 3-6 mois de dépenses en liquidités avant tout investissement. Cette réserve vous protège des ventes forcées dans les marchés baissiers.",
        "📌 *L'inflation :* En France, l'inflation moyenne est de 2-3%/an. Laisser son argent en compte courant, c'est perdre du pouvoir d'achat chaque année. Investissez.",
        "📌 *ETF vs actions :* Pour 80% des investisseurs, un ETF monde (MSCI World) surperforme à long terme un portefeuille d'actions choisies. La simplicité est sous-estimée.",
        "📌 *Fiscalité :* En France, le PEA permet d'investir en bourse avec une fiscalité réduite à 17,2% après 5 ans (vs 30% flat tax). Un compte à ouvrir immédiatement.",
        "📌 *Dette :* Rembourser une dette à 15% de taux = un 'investissement' garanti à 15%. Priorité absolue aux dettes à taux élevé avant tout placement.",
    ],
    "business": [
        "📌 *Cashflow :* Une entreprise profitable peut faire faillite si elle manque de liquidités. Monitorez votre BFR (Besoin en Fonds de Roulement) chaque semaine.",
        "📌 *Acquisition clients :* Le coût d'acquisition d'un nouveau client est 5-7x plus élevé que de fidéliser un client existant. Investissez dans la rétention.",
        "📌 *Métriques clés :* Connaître vos trois KPIs vitaux : Marge brute, Churn rate, LTV/CAC ratio. Si vous ne les mesurez pas, vous naviguez à l'aveugle.",
        "📌 *Pricing :* La plupart des entrepreneurs sous-évaluent leurs services. Une augmentation de prix de 10% sur un produit vendu avec 50% de marge augmente votre profit de 20%.",
    ],
    "health": [
        "📌 *Protéines :* Consommez 1,6-2,2g de protéines par kg de poids corporel pour maximiser la synthèse musculaire. Sources optimales : œufs, poisson, légumineuses.",
        "📌 *Cardio HIIT :* 20 minutes de HIIT (High Intensity Interval Training) brûlent plus de calories sur 24h que 1h de cardio continu. Efficacité maximale pour un temps minimal.",
        "📌 *Stress :* La méditation de pleine conscience pratiquée 10 min/jour réduit le cortisol de 23% en 8 semaines. Votre cerveau se remodèle physiquement.",
        "📌 *Alimentation :* La règle des 80/20 : si 80% de votre alimentation est naturelle et peu transformée, les 20% restants n'ont pas d'impact négatif significatif.",
    ],
    "motivational": [
        "📌 *Action quotidienne :* Identifiez UNE chose que vous pouvez faire aujourd'hui qui vous rapproche de votre objectif. Une seule. Faites-la avant tout le reste.",
        "📌 *Environnement :* Vous devenez la moyenne des 5 personnes que vous fréquentez le plus. Évaluez votre cercle — il définit votre plafond de verre.",
        "📌 *Vision long terme :* Écrivez votre objectif idéal dans 10 ans, puis décomposez-le en étapes de 5 ans, 1 an, 90 jours, cette semaine. La clarté crée l'action.",
        "📌 *Identité :* Ne dites pas 'Je veux perdre du poids', dites 'Je suis quelqu'un qui prend soin de sa santé'. L'identité précède le comportement.",
    ],
}

# Fallback tips
for _k in ["investment","marketing","technology","ai","education","sports","news","community","religion","lifestyle","gaming","science","politics","realestate","startups","ecommerce"]:
    EXPERT_TIPS.setdefault(_k, EXPERT_TIPS.get("finance", []) + EXPERT_TIPS.get("motivational", []))


# ── Market snapshot templates ────────────────────────────────────────────────

async def _get_market_snapshot(topic: str, language: str = "fr") -> str:
    """
    Fetch real-time market data and format a snapshot.
    Returns empty string if unavailable.
    """
    try:
        from .realtime_intel import get_crypto_prices, get_latest_news, format_crypto_bulletin
        if topic in ("crypto", "finance", "investment"):
            prices = await asyncio.wait_for(get_crypto_prices(), timeout=8)
            if prices:
                return format_crypto_bulletin(prices, language)
        return ""
    except Exception as e:
        logger.debug("market_snapshot failed: %s", e)
        return ""


# ── Main generator ────────────────────────────────────────────────────────────

POST_TEMPLATES_FR: dict[str, list[str]] = {
    "crypto": [
        """📊 *Analyse Marché Crypto*

{market_data}

🔍 *Analyse du moment :*
Le marché continue sa phase de {market_phase}. Les indicateurs techniques montrent une {signal} sur les timeframes supérieures. Le volume est {volume_desc}, ce qui {volume_interp}.

💡 *Point de vigilance :*
Dans ce type de configuration, la patience est votre meilleure stratégie. Les mouvements impulsifs coûtent cher — attendez la confirmation avant d'agir.

{anecdote}

{tip}

⚠️ *Rappel :* Ce contenu est informatif, jamais un conseil financier personnalisé. Faites vos propres recherches (DYOR).""",

        """🔥 *Nexus Intel — Update Marché*

{market_data}

📈 *Ce qu'il faut surveiller :*
Les flux institutionnels vers les ETFs Bitcoin spot restent {flow_desc}. Le sentiment Fear & Greed Index oscille autour de {sentiment_num}/100 — territoire de {sentiment_zone}.

{anecdote}

{tip}

💬 *Discussion :* Quelle est votre stratégie dans cette phase de marché ? Partagez votre analyse ci-dessous 👇""",

        """⚡ *Flash Marché — {time_fr}*

{market_data}

🧠 *L'analyse de Nexus :*
Les marchés crypto sont intrinsèquement volatils. Chaque correction brutale a historiquement précédé un nouveau cycle haussier. La clé : rester rationnel quand les émotions dominent le marché.

{anecdote}

📌 *Stratégie du moment :*
En phase de {market_phase}, les stratégies qui ont le mieux résisté historiquement sont : le DCA régulier, les stop-loss définis à l'avance, et une allocation maximale prédéfinie.

✅ Likez si vous trouvez cette analyse utile !""",
    ],
    "finance": [
        """💰 *Bulletin Financier — {date_fr}*

📊 *Marchés en bref :*
{market_data}

💡 *Analyse du jour :*
Dans un environnement de taux {rate_env}, les stratégies patrimoniales évoluent. Les actifs qui historiquement surperforment dans cette configuration incluent : les actions de valeur (value), l'immobilier coté (REIT), et l'or comme couverture.

{anecdote}

{tip}

🎯 *Action concrète pour cette semaine :*
Révisez l'allocation de votre portefeuille. Assurez-vous que votre exposition aux actifs risqués correspond à votre horizon temporel et tolérance au risque.

❓ *Question :* Quel est votre ratio épargne/investissement mensuel ? Partagez en commentaire !""",

        """📈 *Éducation Financière du Jour*

{anecdote}

🔑 *Concept à maîtriser : L'intérêt composé*
C'est l'une des forces les plus puissantes de l'univers selon Einstein. 10 000€ à 8%/an → 21 589€ après 10 ans → 46 610€ après 20 ans → 100 627€ après 30 ans.

La variable la plus importante n'est pas le rendement, c'est *le temps*.

{tip}

💼 *Mindset de l'investisseur prospère :*
"Le marché transfère la richesse des impatients vers les patients." — Warren Buffett

➡️ Partagez ce post pour éduquer votre entourage sur les bases financières !""",
    ],
    "motivational": [
        """🌟 *Message du Jour*

{anecdote}

🎯 *Réflexion :*
Chaque jour est une opportunité de faire mieux qu'hier. Pas besoin d'un grand saut — juste un petit pas dans la bonne direction, de manière consistante.

{tip}

💬 *Question pour vous :* Quelle est la UNE chose que vous allez faire aujourd'hui pour progresser ? Écrivez-la en commentaire — l'engagement public multiplie par 3 les chances de réalisation.

🔥 Partagez ce message à quelqu'un qui en a besoin.""",
    ],
    "community": [
        """👥 *Message de la Communauté*

Bonjour à tous ! 🌟

{anecdote}

💬 *On discute :*
Qu'est-ce qui vous a le plus surpris, appris ou inspiré cette semaine ? Partagez dans les commentaires — chaque expérience enrichit la communauté entière.

{tip}

📢 *Rappel :* Invitez vos amis qui pourraient bénéficier de ce contenu. Ensemble, on grandit plus vite !

👍 Réagissez si vous lisez jusqu'ici !""",
    ],
}

# Copier pour les autres topics en FR
for _t in ["business","technology","ai","health","sports","education","news","investment","marketing","realestate","startups","ecommerce","gaming","science","politics","religion","lifestyle"]:
    if _t not in POST_TEMPLATES_FR:
        POST_TEMPLATES_FR[_t] = POST_TEMPLATES_FR.get("finance" if _t in ("investment","marketing","realestate","startups","ecommerce") else "motivational", [])


POST_TEMPLATES_EN: dict[str, list[str]] = {
    "crypto": [
        """📊 *Crypto Market Update*

{market_data}

🔍 *Analysis :*
The market is currently in a {market_phase} phase. Volume is {volume_desc}, suggesting {volume_interp}. Key levels to watch across major pairs.

{anecdote}

{tip}

⚠️ *Reminder :* This is educational content, not financial advice. Always do your own research (DYOR).""",
    ],
    "finance": [
        """💰 *Daily Finance Brief — {date_fr}*

{market_data}

{anecdote}

{tip}

💬 *What's your current investment strategy? Share below!*""",
    ],
    "motivational": [
        """🌟 *Daily Motivation*

{anecdote}

{tip}

🔥 Share this with someone who needs it today!""",
    ],
}
for _t in ["business","technology","ai","health","sports","education","news","community","investment","marketing","gaming","science","politics","religion","lifestyle","realestate","startups","ecommerce"]:
    if _t not in POST_TEMPLATES_EN:
        POST_TEMPLATES_EN[_t] = POST_TEMPLATES_EN.get("finance", POST_TEMPLATES_EN["motivational"])

POST_TEMPLATES_AR: dict[str, list[str]] = {
    "crypto": [
        """📊 *تحديث سوق العملات الرقمية*

{market_data}

🔍 *التحليل:*
السوق في مرحلة {market_phase} حاليًا. من المهم متابعة المستويات الرئيسية وإدارة المخاطر بحكمة.

{anecdote}

{tip}

⚠️ *تذكير:* هذا محتوى تعليمي وليس نصيحة مالية شخصية.""",
    ],
    "finance": [
        """💰 *نشرة مالية يومية*

{market_data}

{anecdote}

{tip}

💬 *شاركنا استراتيجيتك في التعليقات!*""",
    ],
    "motivational": [
        """🌟 *كلمة اليوم*

{anecdote}

{tip}

🔥 شارك هذا مع شخص يحتاجه اليوم!""",
    ],
}
for _t in ["business","technology","ai","health","sports","education","news","community","investment"]:
    if _t not in POST_TEMPLATES_AR:
        POST_TEMPLATES_AR[_t] = POST_TEMPLATES_AR.get("finance", POST_TEMPLATES_AR["motivational"])


TEMPLATES_BY_LANG = {"fr": POST_TEMPLATES_FR, "en": POST_TEMPLATES_EN, "ar": POST_TEMPLATES_AR}


def _market_variables() -> dict[str, str]:
    """Generate plausible market context variables for template filling."""
    phases = ["consolidation", "accumulation", "distribution", "reprise", "correction"]
    signals = ["signal haussier", "signal baissier", "indécision", "forte pression acheteuse", "forte pression vendeuse"]
    volume_descs = ["élevé", "faible", "en hausse", "en baisse", "neutre"]
    volume_interps = [
        "confirme la tendance en cours",
        "suggère une indécision du marché",
        "indique un intérêt institutionnel croissant",
        "peut signaler un retournement imminent",
        "reste dans les normes historiques",
    ]
    flow_descs = ["positifs", "négatifs", "neutres", "significatifs", "en ralentissement"]
    sentiment_nums = [random.randint(20, 80)]
    sentiment_num = sentiment_nums[0]
    sentiment_zones = {
        range(0, 25): "peur extrême 😨",
        range(25, 45): "peur 😟",
        range(45, 55): "neutralité 😐",
        range(55, 75): "cupidité 🤑",
        range(75, 101): "cupidité extrême 🚀",
    }
    sentiment_zone = next((v for k, v in sentiment_zones.items() if sentiment_num in k), "neutralité")

    now = datetime.now(timezone.utc)
    months_fr = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"]
    days_fr = ["lundi","mardi","mercredi","jeudi","vendredi","samedi","dimanche"]

    return {
        "market_phase":    random.choice(phases),
        "signal":          random.choice(signals),
        "volume_desc":     random.choice(volume_descs),
        "volume_interp":   random.choice(volume_interps),
        "flow_desc":       random.choice(flow_descs),
        "sentiment_num":   str(sentiment_num),
        "sentiment_zone":  sentiment_zone,
        "rate_env":        random.choice(["élevé", "en baisse", "stable"]),
        "time_fr":         now.strftime("%H:%M UTC"),
        "date_fr":         f"{days_fr[now.weekday()]} {now.day} {months_fr[now.month-1]} {now.year}",
    }


async def generate_rich_post(
    topic: str,
    language: str = "fr",
    with_market_data: bool = True,
) -> tuple[str, str]:
    """
    Generate a rich, detailed post for the given topic.

    Returns:
        (post_text, content_type) where content_type ∈ {anecdote, tip, analysis, market}
    """
    lang = language if language in ("fr", "en", "ar") else "fr"
    topic_key = topic if topic in ANECDOTES else "community"

    anecdotes_list = ANECDOTES.get(topic_key, ANECDOTES["community"])
    tips_list = EXPERT_TIPS.get(topic_key, EXPERT_TIPS.get("finance", []))
    templates = TEMPLATES_BY_LANG.get(lang, POST_TEMPLATES_FR)
    topic_templates = templates.get(topic_key, templates.get("community", []))

    anecdote = random.choice(anecdotes_list) if anecdotes_list else ""
    tip = random.choice(tips_list) if tips_list else ""

    # Get market data if relevant
    market_data = ""
    if with_market_data and topic in ("crypto", "finance", "investment", "news"):
        market_data = await _get_market_snapshot(topic, lang)
    if not market_data:
        market_data = _fallback_market_text(topic, lang)

    vars_dict = _market_variables()
    vars_dict.update({
        "anecdote":    anecdote,
        "tip":         tip,
        "market_data": market_data,
    })

    if topic_templates:
        template = random.choice(topic_templates)
        try:
            text = template.format(**vars_dict)
        except KeyError:
            text = template
    else:
        text = f"{anecdote}\n\n{tip}"

    # Determine what type of content we produced
    if market_data and topic in ("crypto", "finance"):
        content_type = "market_analysis"
    elif anecdote and tip:
        content_type = "educational"
    else:
        content_type = "motivational"

    return text.strip(), content_type


def _fallback_market_text(topic: str, language: str) -> str:
    """Fallback market context when real API is unavailable."""
    fallbacks = {
        ("crypto", "fr"): "📊 *Marchés :* BTC ↗ ETH stable | Altcoins en consolidation | Volume modéré",
        ("crypto", "en"): "📊 *Markets:* BTC ↗ ETH stable | Altcoins consolidating | Moderate volume",
        ("crypto", "ar"): "📊 *الأسواق:* البيتكوين ↗ إيثريوم مستقر | العملات البديلة في مرحلة تعزز",
        ("finance", "fr"): "📊 *Marchés :* CAC 40 — EuroStoxx 600 — S&P 500 | Taux directeurs en focus",
        ("finance", "en"): "📊 *Markets:* S&P 500 | Nasdaq | Key rates in focus",
        ("finance", "ar"): "📊 *الأسواق:* مؤشرات أوروبا وأمريكا | محور على أسعار الفائدة",
    }
    return fallbacks.get((topic, language), "")
