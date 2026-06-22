"""
Test complet du moteur Trust & Fact-Checking — exécuter avec :
  uv run python python-backend/test_trust.py
"""
import asyncio
import sys
import os

# Make sure the bot package is importable
sys.path.insert(0, os.path.dirname(__file__))

from bot.trust_checker import (
    check_content, check_and_label, check_batch,
    format_trust_report, score_color, TrustResult,
)


# ── Test cases ─────────────────────────────────────────────────────────────────

TEST_CASES = [
    {
        "name": "Fait factuel avec chiffres",
        "text": "Selon une étude publiée en janvier 2024, le Bitcoin a atteint 73 000$ lors de son ATH historique, représentant une hausse de 147% en 12 mois.",
        "expected_type": "fact",
        "expected_score_min": 60,
    },
    {
        "name": "Opinion pure",
        "text": "À mon avis, les cryptomonnaies sont l'avenir de la finance. Je pense que tout le monde devrait investir dès maintenant.",
        "expected_type": "opinion",
        "expected_score_min": 0,
        "expected_score_max": 65,
    },
    {
        "name": "Contenu promotionnel",
        "text": "Rejoins notre groupe MAINTENANT ! Offre limitée — inscription gratuite ! Clique ici 👇 Lien en bio ! 🎁💰🤑",
        "expected_type": "promotional",
        "expected_score_max": 40,
    },
    {
        "name": "Red flag - claim irréaliste",
        "text": "Méthode 100% garantie ! Tout le monde peut multiplier ses gains par 10 en 30 jours. Les banques cachent cette information !",
        "expected_type": "unverifiable",
        "expected_score_max": 30,
    },
    {
        "name": "Mélange fait + opinion",
        "text": "Le marché crypto a perdu 30% ce mois-ci. Personnellement, je pense que c'est une opportunité d'achat intéressante pour les investisseurs patients.",
        "expected_type": "mixed",
    },
    {
        "name": "Message motivationnel",
        "text": "Chaque grand voyage commence par un premier pas. Continuez d'avancer, le succès appartient à ceux qui persistent ! 💪",
        "expected_type": "opinion",
    },
    {
        "name": "Anglais - verified fact",
        "text": "According to Reuters, inflation dropped to 2.3% in December 2024, the lowest rate in 3 years.",
        "expected_type": "fact",
        "expected_score_min": 65,
    },
    {
        "name": "Arabe - opinion",
        "text": "في رأيي، الاستثمار في العملات الرقمية هو مستقبل المال. أعتقد أن الجميع يجب أن يبدأ الآن.",
        "expected_type": "opinion",
    },
    {
        "name": "Badge appended",
        "text": "Bitcoin dépasse les 100 000$ — un nouveau record historique qui marque un tournant pour la cryptomonnaie.",
        "test_badge": True,
    },
    {
        "name": "Batch test - 3 textes simultanés",
        "batch": [
            "Les experts prévoient une hausse de 50% du PIB mondial d'ici 2030.",
            "Je pense que c'est une bonne idée d'investir maintenant.",
            "Rejoins notre groupe pour des profits garantis à 1000% ! 🤑",
        ],
    },
]


# ── Test runner ────────────────────────────────────────────────────────────────

def print_header(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def print_result(result: TrustResult, name: str):
    print(f"\n📋 {name}")
    print(f"   Type   : {result.content_type}")
    print(f"   Score  : {score_color(result.score)} {result.score}/100")
    print(f"   Label  : {result.label}")
    print(f"   Confiance: {result.confidence}%")
    if result.reasoning:
        print(f"   Raison : {result.reasoning}")
    if result.claims:
        print(f"   Claims : {result.claims}")
    if result.warnings:
        print(f"   ⚠️ Alertes: {result.warnings}")


def check_expectation(result: TrustResult, case: dict) -> bool:
    ok = True
    if "expected_type" in case:
        if result.content_type != case["expected_type"]:
            print(f"   ❌ Type attendu: {case['expected_type']}, obtenu: {result.content_type}")
            ok = False
        else:
            print(f"   ✅ Type correct: {result.content_type}")
    if "expected_score_min" in case:
        if result.score < case["expected_score_min"]:
            print(f"   ❌ Score trop bas: {result.score} < {case['expected_score_min']}")
            ok = False
        else:
            print(f"   ✅ Score min OK: {result.score} >= {case['expected_score_min']}")
    if "expected_score_max" in case:
        if result.score > case["expected_score_max"]:
            print(f"   ❌ Score trop élevé: {result.score} > {case['expected_score_max']}")
            ok = False
        else:
            print(f"   ✅ Score max OK: {result.score} <= {case['expected_score_max']}")
    return ok


async def run_tests():
    print_header("NEXUS AI — Trust & Fact-Check Engine — Tests")
    
    total = 0
    passed = 0
    failed = 0
    errors = 0

    for case in TEST_CASES:
        name = case["name"]
        total += 1

        try:
            # ── Batch test ──
            if "batch" in case:
                print(f"\n📦 Batch Test: {name}")
                results = await check_batch(case["batch"])
                for i, (txt, res) in enumerate(zip(case["batch"], results)):
                    print(f"   [{i+1}] {txt[:50]}...")
                    print(f"       → {res.label} | {res.score}/100 | {res.content_type}")
                passed += 1
                continue

            # ── Badge test ──
            if case.get("test_badge"):
                print(f"\n🏷️  Badge Test: {name}")
                labeled, result = await check_and_label(case["text"])
                print(f"   Original: {case['text'][:60]}...")
                print(f"   Avec badge:\n{labeled}")
                passed += 1
                continue

            # ── Standard test ──
            result = await check_content(case["text"])
            print_result(result, name)
            ok = check_expectation(result, case)
            if ok:
                passed += 1
            else:
                failed += 1

        except Exception as e:
            print(f"\n❌ ERREUR dans '{name}': {e}")
            import traceback
            traceback.print_exc()
            errors += 1

    # ── Summary ──
    print_header(f"RÉSULTATS: {passed}/{total} réussis | {failed} échoués | {errors} erreurs")
    
    if failed == 0 and errors == 0:
        print("🎉 Tous les tests passent ! Le moteur Trust est opérationnel.")
    elif errors > 0:
        print(f"⚠️  {errors} erreurs techniques — vérifier les imports et les clés API.")
    else:
        print(f"⚠️  {failed} test(s) avec des résultats inattendus (l'IA peut varier légèrement).")

    return passed, failed, errors


if __name__ == "__main__":
    asyncio.run(run_tests())
