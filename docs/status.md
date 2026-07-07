# État du projet

> Dernière vérification : juillet 2026, branche `develop`.

---

## Légende

| Symbole | Signification |
|---|---|
| ✅ | Fait |
| 🟡 | Fait, non commité |
| ❌ | Pas fait / bloquant |
| ⏸ | Volontairement reporté |

---

## 1. Mandatory — fait

### Auth & utilisateurs ✅
- Register, login, logout one-click
- OAuth **42** + Google, GitHub, Discord
- Reset password, vérification email
- Profil modifiable, consultation profil autre user (email privé)
- i18n multi-langues, défaut anglais

### API REST OAuth2 ✅
- `POST /oauth/token`, routes users/movies/comments documentées
- Routes non documentées rejetées avec code HTTP approprié

### Library ✅
- Recherche, thumbnails, pagination scroll infini, tri/filtres
- Watched / unwatched différenciés
- Placeholder « No image » sur les vignettes sans poster
- Sources **YTS** (films) + **EZTV** (séries) + **TMDb** (métadonnées)
- Onglet Séries, `SeriesEpisodePicker`, deep-fetch EZTV lazy

### Streaming ✅
- Moteur BitTorrent **hand-rollé** (`backend/src/streaming/torrent/`)
- YTS via `.torrent` (`torrentFileUrl`), EZTV via magnet + BEP9
- Stream progressif + seek, transcodage mkv (ffmpeg)
- Sous-titres (OpenSubtitles), cleanup 30 jours sans visionnage
- Servir depuis disque si `downloadStatus=ready` (pas de re-swarm)
- `torrent-stream` **retiré**

### Qualité code ✅
- Backend ~333 tests unitaires + e2e, frontend ~96 tests, lint 0, build OK

---

## 2. Travail récent (moteur torrent) 🟡

> Non commité au moment de la rédaction.

| Zone | Détail |
|---|---|
| `backend/src/streaming/torrent/` | Moteur M1→M8 (bencode, trackers, peer wire, BEP9, picker, store) |
| `torrent.service.ts` | Façade fine sur `TorrentDownload` |
| `Torrent.torrentFileUrl` | Migration `20260707120000_add_torrent_file_url` |
| `movie-cache.service.ts` | Peuple `torrentFileUrl` depuis `torrent.url` YTS |
| `cleanup.service.ts` | Supprime le dossier `{storage}/{hash}/` |
| `package.json` | `torrent-stream` et `@types/torrent-stream` retirés |

---

## 3. Reste à faire

### Avant soutenance

| # | Tâche | Priorité |
|---|---|---|
| 1 | **Committer** le moteur torrent | Haute |
| 2 | `npm run prisma:migrate:dev` sur chaque env | Haute |
| 3 | Test manuel live (film YTS seedé, seek, relecture disque) | Haute |
| 4 | [defense-checklist.md](./defense-checklist.md) (console 0 erreur, Firefox + Chrome) | Haute |
| 5 | Re-cacher le catalogue YTS pour peupler `torrentFileUrl` sur les torrents existants | Moyenne |

### Polish optionnel

| # | Tâche | Priorité |
|---|---|---|
| 6 | Grisage releases 0-seed | Basse (UX) |
| 7 | Tests d'intégration live réseau (announce, download réel) | Basse (manuel) |

### Bonus — après mandatory parfait

| # | Tâche | Notes |
|---|---|---|
| 8 | **Prowlarr** 3ᵉ source | Combler les trous EZTV |
| 9 | Résolutions multiples, MediaStream API, routes API extra | Idées sujet Ch. IV |

---

## 4. Ce qui n'est PAS un problème

- Séries TV : **bonus**, pas exigé par le sujet
- Trous de catalogue EZTV (saisons manquantes) : limite de la source
- TMDb utilisé pour métadonnées : conforme tant qu'il n'est pas compté comme source #1 ou #2
- EZTV magnet sans DHT : dépend des trackers publics ; choisir du contenu populaire en démo
