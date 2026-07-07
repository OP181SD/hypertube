# État du projet

> Dernière vérification : juillet 2026, branche `develop`, commit HEAD `31d1d36`.

---

## Légende

| Symbole | Signification |
|---|---|
| ✅ | Fait et commité |
| 🟡 | Fait, tests verts, **non commité** |
| ❌ | Pas fait / bloquant |
| ⏸ | Volontairement reporté |

---

## 1. Déjà commité (base stable)

### Auth & utilisateurs ✅
- Register (email, username, prénom, nom, mot de passe hashé argon2)
- Login username/password, logout one-click
- OAuth **42** + Google, GitHub, Discord (≥ 2 stratégies exigées)
- Reset password par email, vérification email
- Profil modifiable, consultation profil autre user (email privé)
- i18n multi-langues, défaut anglais

### API REST OAuth2 ✅
- `POST /oauth/token` (password + refresh_token grants)
- `GET/PATCH /users`, `GET /movies`, `GET /movies/:id`
- `GET/POST/PATCH/DELETE /comments`, `POST /movies/:id/comments`
- Routes non documentées rejetées avec code HTTP approprié

### Library (films) ✅
- Recherche, thumbnails, pagination scroll infini, tri/filtres
- Watched / unwatched différenciés
- Placeholder « No image » sur les vignettes sans poster
- Source **YTS** pour les films (magnets construits depuis `hash`)

### Streaming (via `torrent-stream` — non conforme) ✅ fonctionnel / ❌ conforme
- Download background, stream progressif, transcodage mkv (ffmpeg)
- Sous-titres (OpenSubtitles), cleanup 30 jours sans visionnage
- ⚠️ Utilise `torrent-stream` → **interdit par le sujet** (voir [subject-compliance.md](./subject-compliance.md))

### Qualité code ✅
- Backend ~328 tests unitaires + 59 e2e, frontend 96 tests, lint 0
- Commits récents : deps update (`6aa58c5`), fix ESLint frontend (`f747d6d`)

---

## 2. Commité récemment (juillet 2026)

> Commits `eaa13e2` → `31d1d36` (5 commits, working tree propre).

### Schéma Prisma ✅

| Champ / modèle | Migration | Rôle |
|---|---|---|
| `Movie.mediaType` (`movie` \| `series`) | `20260625120000_add_media_type` | Séparer films et séries |
| `Torrent.episodeLabel` (`S01E01`…) | `20260625130000_add_episode_label` | Identifier les épisodes |
| `Movie.episodesFetched` (bool) | `20260625140000_add_episodes_fetched` | Éviter le re-fetch EZTV |

**Pas encore ajouté** (prévu pour le moteur torrent) : `Torrent.torrentFileUrl`.

### Backend — providers & séries ✅

| Fichier | Changement |
|---|---|
| `eztv.service.ts` | `getAllTorrentsByImdb()` — pagination 100/page, max 10 pages, stop à page courte |
| `tmdb.service.ts` | Catalogue séries : `getPopularSeries`, `searchSeries`, `getTvImdbId` |
| `movie-cache.service.ts` | `cacheSeries()` + `addSeriesEpisodes()` ; YTS force `mediaType: "movie"` |
| `movie-mapper.service.ts` | Parse `episodeLabel` → `season` / `episode` dans la réponse API |
| `movies.service.ts` | `search()` : `mediaType=series` → EZTV+TMDb ; `findById()` : deep-fetch lazy si `!episodesFetched` |
| `movie-query.service.ts` | Filtre DB par `mediaType` |
| `search-movies.dto.ts` | Paramètre `mediaType` |
| `interfaces/index.ts` | Types séries (`SeriesShow`, `EztvTorrent`, champs torrent enrichis) |
| `test/fixtures/movies.fixture.ts` | Fixtures séries |
| Specs | +tests deep-fetch, pagination EZTV, `addSeriesEpisodes`, search séries |

**Comportement deep-fetch** (au premier `GET /movies/:id` sur une série) :
1. Paginer EZTV par `imdb_id` (ex. GoT → 146 torrents en 2 pages)
2. Upsert tous les épisodes en DB via `addSeriesEpisodes`
3. Poser `episodesFetched = true` → ouvertures suivantes instantanées

**Limite connue** : EZTV ne couvre pas toujours toutes les saisons (ex. GoT : S1, S5–S8 seulement). Ce n’est pas un bug applicatif — lacune du catalogue source.

### Frontend ✅

| Fichier | Changement |
|---|---|
| `Dashboard.tsx` | Onglets Films (`mediaType=movie`) / Séries (`mediaType=series`) |
| `DashboardNavbar.tsx` / `MobileMenu.tsx` | Tab « series » |
| `MovieBrowser.tsx` | Prop `mediaType`, titre adapté |
| `useMovies.ts` | `mediaType` dans les params API ; fix race scroll-infini au changement d’onglet |
| `SeriesEpisodePicker.tsx` *(nouveau)* | Navigation saison → épisode → qualité (tri par seeds) |
| `MovieDetailPage.tsx` | `SeriesEpisodePicker` si torrents avec `season` ; sinon `QualitySelector` |
| `QualitySelector.tsx` | Ajustements mineurs |
| `VideoPlayer.tsx` | Ajustement mineur |
| `types/api.ts` | `mediaType`, `season`, `episode` sur les torrents |
| `types/ui/Tabs.ts` | Tab `series` |
| `locales/*.json` (×15) | Clé `series` |

### Config ✅
- `backend/.env.example` + `config.module.ts` : `EZTV_BASE_URL` confirmé (pas de Jackett/apibay)

---

## 3. Reste à faire

### Bloquant — mandatory sujet

| # | Tâche | Détail | Doc |
|---|---|---|---|
| 1 | **Moteur BitTorrent maison** | Remplacer `torrent-stream` par implémentation hand-roll M1→M8 | [torrent-engine.md](./torrent-engine.md) |
| 2 | **Servir depuis disque** | Si `downloadStatus=ready` + fichier présent → `fs.createReadStream`, sans relancer le swarm | ✅ fait (juillet 2026) |
| 3 | **`torrentFileUrl`** | Champ Prisma + peupler depuis `torrent.url` YTS ; `startDownload` choisit `.torrent` ou magnet | [torrent-engine.md § Modifs hors moteur](./torrent-engine.md#modifs-hors-moteur) |
| 4 | ~~**Committer** le travail séries/EZTV~~ | ✅ fait (`eaa13e2`→`31d1d36`) | — |

### Important — qualité / soutenance

| # | Tâche | Priorité |
|---|---|---|
| 5 | ~~Placeholder poster fiche détail~~ | ✅ `PosterImage` + `AvatarImage` partagés |
| 5b | Console 0 erreur | ✅ garde-fous code + [defense-checklist.md](./defense-checklist.md) à exécuter avant soutenance |
| 5c | Preuve API RESTful | ✅ [api-restful.md](./api-restful.md) |
| 6 | Grisage releases 0-seed | Basse (UX, pas mandatory) |
| 7 | Mettre à jour les specs streaming après M8 | Après moteur |

### Bonus — après mandatory parfait

| # | Tâche | Notes |
|---|---|---|
| 8 | **Prowlarr** 3ᵉ source | Combler les trous EZTV ; ne pas en dépendre pour la conformité |
| 9 | Résolutions multiples, MediaStream API, routes API extra | Idées sujet Ch. IV |

---

## 4. Ordre de travail recommandé

```
1. ~~Commit séries/EZTV + patch disque~~   ✅
2. M1  bencode + .torrent
3. M2  trackers HTTP + UDP
4. M3  peer wire + bitfield
5. M4  download pièce + SHA1
6. M5  picker + disque + branche « ready »
7. M6  createReadStream progressif  ← conformité streaming atteinte (chemin .torrent/YTS)
8. M7  BEP9 / magnet              ← nécessaire pour EZTV (magnets only)
9. M8  bascule + suppression torrent-stream
10. Polish (placeholder détail, grisage 0-seed)
11. Bonus Prowlarr
```

**~80 % de l’effort restant = M1→M6.** M7 (~150–200 lignes) débloque EZTV en lecture. M8 = nettoyage.

---

## 5. Ce qui n’est PAS un problème

- Séries TV : **bonus**, pas exigé par le sujet (il parle de « videos »)
- Trous de catalogue EZTV (saisons manquantes) : limite de la source, pas un bug
- TMDb utilisé pour métadonnées : conforme tant qu’il n’est pas compté comme source #1 ou #2
