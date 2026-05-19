#!/bin/bash
set -e

echo "==> Nettoyage du cache npm..."
npm cache clean --force 2>/dev/null || true

echo "==> Création du .env backend si absent..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "    .env créé depuis .env.example — pense à remplir les vraies clés !"
else
  echo "    .env déjà présent, on ne le touche pas."
fi

echo "==> Installation des dépendances..."
npm install

echo "==> Génération du client Prisma..."
npm run prisma:generate

echo "==> Démarrage de Docker (base de données, Redis, mail)..."
npm run docker:up

echo "==> Attente que Postgres soit prêt..."
sleep 5

echo "==> Migrations Prisma..."
npm run prisma:migrate:dev -- --name init 2>/dev/null || npm run prisma:migrate:dev

echo ""
echo "✓ Setup terminé !"
echo ""
echo "Lance le projet avec :"
echo "  Terminal 1 : npm run dev:back"
echo "  Terminal 2 : npm run dev:front"
echo "  Terminal 3 : npm run debug:browser"
