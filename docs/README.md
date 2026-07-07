# Documentation Hypertube

> Dernière mise à jour : juillet 2026 · Branche `develop` · Sujet : [`en.subject.pdf`](../en.subject.pdf) v6.3

Ce dossier est la **source de vérité** du projet. En cas de contradiction avec d'anciens chats ou transcripts, **ces fichiers font foi**.

---

## Navigation

| Document | Contenu |
|---|---|
| [**status.md**](./status.md) | État du projet : fait, en cours, reste à faire |
| [**decisions.md**](./decisions.md) | Choix actés vs options gardées de côté |
| [**torrent-engine.md**](./torrent-engine.md) | Référence technique du moteur BitTorrent hand-rollé |
| [**subject-compliance.md**](./subject-compliance.md) | Règles du sujet et points de vigilance éliminatoires |
| [**api-restful.md**](./api-restful.md) | Guide REST pour la soutenance (curl + arguments) |
| [**defense-checklist.md**](./defense-checklist.md) | Checklist console 0 erreur + navigateurs |
| [**handoff-torrent-engine.md**](./handoff-torrent-engine.md) | Archive — brief initial du chantier moteur (terminé) |
| [**archive/**](./archive/) | Anciens handoffs et transcripts (référence historique) |

---

## Vue d'ensemble en 30 secondes

```
Hypertube — état juillet 2026
│
├── Mandatory UI / auth / API / library     ✅
├── Sources YTS + EZTV + séries TV          ✅
├── Moteur BitTorrent maison (M1→M8)      ✅ (non commité)
├── Servir depuis disque (pas de re-DL)     ✅
└── Bonus (Prowlarr, grisage 0-seed…)      ⏸ différé
```

**Prochaine priorité** : committer le moteur torrent, migration Prisma, test live soutenance.

---

## Architecture des sources

| Rôle | Service | Contenu |
|---|---|---|
| Source #1 — films | **YTS** | API directe, `.torrent` + `info_hash` |
| Source #2 — séries | **EZTV** | API directe, magnets uniquement |
| Métadonnées | **TMDb** | Posters, casting, catalogue séries — *ne compte pas* comme source |
| Bonus (plus tard) | **Prowlarr** | Agrégateur Torznab — 3ᵉ source optionnelle |

Le moteur torrent est **agnostique** de la source : `.torrent` (YTS) et magnet/BEP9 (EZTV) convergent vers `TorrentMetadata`.
