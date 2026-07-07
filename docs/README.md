# Documentation Hypertube

> Dernière mise à jour : juillet 2026 · Branche `develop` · Sujet : [`en.subject.pdf`](../en.subject.pdf) v6.3

Ce dossier est la **source de vérité** du projet. En cas de contradiction avec d’anciens chats ou transcripts, **ces fichiers font foi**.

---

## Navigation

| Document | Contenu |
|---|---|
| [**status.md**](./status.md) | État du projet : fait, en cours (non commité), reste à faire |
| [**decisions.md**](./decisions.md) | Choix actés vs options gardées de côté |
| [**torrent-engine.md**](./torrent-engine.md) | Plan du moteur BitTorrent maison (M1→M8) — chantier bloquant |
| [**subject-compliance.md**](./subject-compliance.md) | Règles du sujet et points de vigilance éliminatoires |
| [**archive/**](./archive/) | Anciens handoffs et transcripts (référence historique uniquement) |

---

## Vue d’ensemble en 30 secondes

```
Hypertube — état juillet 2026
│
├── Mandatory UI / auth / API / library     ✅ ~90 % (commité)
├── Sources YTS + EZTV + séries TV          ✅ fait, NON COMMITÉ
├── Moteur BitTorrent maison (M1→M8)        ❌ 0 % — ÉLIMINATOIRE si non fait
├── Servir depuis disque (pas de re-DL)     ✅ fait (juillet 2026)
└── Bonus (Prowlarr, grisage 0-seed…)       ⏸ différé
```

**Prochaine priorité** : committer le travail séries/EZTV, puis attaquer **M1** du moteur torrent.

---

## Architecture des sources (décision actuelle)

| Rôle | Service | Contenu |
|---|---|---|
| Source #1 — films | **YTS** | API directe, `.torrent` + `info_hash` |
| Source #2 — séries | **EZTV** | API directe, magnets uniquement |
| Métadonnées | **TMDb** | Posters, casting, catalogue séries — *ne compte pas* comme source |
| Bonus (plus tard) | **Prowlarr** | Agrégateur Torznab — 3ᵉ source optionnelle |

Le moteur torrent sera **agnostique** de la source : les deux chemins d’entrée (`.torrent` et magnet/BEP9) seront codés pour pouvoir changer de provider sans retoucher le moteur.

---

## Commits suggérés (travail non commité)

Voir le détail dans [status.md § Travail non commité](./status.md#travail-non-commité).

```bash
# 1. Schéma + migrations
git add backend/prisma/schema.prisma backend/prisma/migrations/20260625120000_add_media_type/ \
        backend/prisma/migrations/20260625130000_add_episode_label/ \
        backend/prisma/migrations/20260625140000_add_episodes_fetched/

# 2. Backend (providers, séries, tests)
git add backend/

# 3. Frontend (onglet Séries, episode picker, locales)
git add frontend/
```

Message de commit suggéré :
```
feat(series): add YTS/EZTV split, TMDb series catalog and lazy EZTV deep-fetch
```
