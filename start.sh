#!/bin/bash
# Script de démarrage production — Plesk
# Lance le backend Python en arrière-plan + le serveur API Node.js au premier plan

set -e

# Démarrer le backend Python (Telethon engine) en arrière-plan
echo "[start.sh] Démarrage du moteur Python (port 9000)..."
uv run python python-backend/main.py &
PYTHON_PID=$!

# Attendre que le Python soit prêt
sleep 3

# Démarrer le serveur API Node.js (au premier plan — Plesk le surveille)
echo "[start.sh] Démarrage de l'API Node.js (port 8080)..."
PORT=8080 node --enable-source-maps artifacts/api-server/dist/index.mjs

# Si Node s'arrête, on arrête aussi Python
kill $PYTHON_PID 2>/dev/null
