# Décisions & options

> Historique des arbitrages. Les options **non choisies** sont conservées ici pour référence — ne pas les réintroduire sans discussion.

---

## Décisions actées ✅

### Sources de contenu vidéo

| Décision | Raison |
|---|---|
| **YTS** = source #1 (films) | API stable, `.torrent` + `info_hash`, matching propre par film |
| **EZTV** = source #2 (séries) | API directe, zéro service à héberger, magnets par épisode |
| **TMDb** = métadonnées uniquement | Posters, casting, catalogue séries — ne compte pas comme source sujet |
| **Prowlarr** en 3ᵉ source bonus, **après** le mandatory | Conformité ne repose jamais dessus ; comble les trous EZTV |

**Argument soutenance** : « Mes deux sources requises sont YTS et EZTV. Prowlarr est un plus. »

### Architecture providers

| Décision | Raison |
|---|---|
| Films → YTS, Séries → EZTV (routage par `mediaType`) | Chaque source couvre son domaine ; recherche conforme (2 sources vidéo) |
| Deep-fetch EZTV **lazy** (au clic sur une série) | Grille légère au seed ; coût pagination payé seulement pour la série regardée |
| `episodesFetched` flag en DB | Évite de re-interroger EZTV à chaque ouverture |
| Magnets construits pour YTS (`buildMagnetUrl`) en attendant le moteur | Fonctionne avec `torrent-stream` actuel ; `torrentFileUrl` viendra avec M1 |

### Moteur torrent

| Décision | Raison |
|---|---|
| **Hand-roll obligatoire** — supprimer `torrent-stream` | Interdit par le sujet (Ch. II) ; éliminatoire |
| Coder **les deux chemins** : `.torrent` (YTS) + magnet/BEP9 (EZTV) | Choix de source = config, pas refonte moteur |
| **Pas de DHT** (BEP5) | Trop coûteux (~400–700 L) ; peers via trackers publics |
| Préserver la façade `TorrentService` (6 méthodes) | `StreamingService` / controller / frontend inchangés |
| YTS `.torrent` **prioritaire**, magnet en repli | Meilleure robustesse peer-discovery en soutenance |
| Bencode hand-rollé (~100 L) plutôt que lib | Maîtriser le slice brut du dict `info` (gotcha `info_hash`) |
| Built-ins Node uniquement pour le protocole | `net`, `dgram`, `crypto`, `stream`, `fs` |

### Qualité & outillage

| Décision | Raison |
|---|---|
| Rester sur **ESLint** (pas Biome) | Meilleure couverture type-aware + règles React Compiler |
| Rester en **TypeScript** (pas Go pour le torrent) | Même effort protocole, frontière inter-process inutile |
| Tests unitaires déterministes + intégration live gated | Flakiness réseau incompatible avec règle V.1 (0 erreur console) |

### UI

| Décision | Raison |
|---|---|
| Afficher tous les films/séries, **placeholder** si pas de poster | Sujet exige une cover sur chaque vignette ; filtrer serait pire en soutenance |
| Séries = feature bonus (onglet dédié) | Améliore l’UX sans être mandatory |

---

## Options gardées de côté ⏸

### Sources alternatives (non retenues pour le mandatory)

| Option | Pour | Contre | Statut |
|---|---|---|---|
| **apibay / TPB** (JSON, magnet only) | Zéro infra, fiable, films + séries | Nécessite BEP9 pour streamer ; moins propre que YTS+.torrent pour les films | ⏸ Remplacé par EZTV pour les séries |
| **Jackett** (agrégateur Torznab) | Fédère ~100 indexeurs, `.torrent` possible | Service à babysitter (indexeurs morts, captchas) ; moins maintenu que Prowlarr | ⏸ Abandonné |
| **Prowlarr** (agrégateur Torznar) | Mieux maintenu que Jackett, couverture large | Self-hosted, fragile en soutenance si mal configuré | ⏸ **Bonus différé** — bon candidat 3ᵉ source |
| **Scraper sites streaming** (123movies, etc.) | Catalogue exhaustif | **Hors sujet** (HTTP hosters, pas BitTorrent) ; illégal à outiller | ❌ Rejeté |
| **EZTV seul pour tout** | Une seule API | Films peu couverts ; YTS est bien meilleur pour les films | ❌ Rejeté |

### Moteur torrent — périmètre réduit (MVP)

| Option | Statut | Notes |
|---|---|---|
| DHT (BEP5) | ❌ Exclu du MVP | +400–700 L ; trackers publics suffisent |
| HTTP tracker seulement (pas UDP) | ⏸ Drop-in possible | Prévoir interface abstraite ; UDP d’abord, HTTP en fallback si réseau école bloque UDP |
| Rarest-first / endgame | ❌ Exclu | Picker strictement séquentiel (idéal streaming) |
| Multi-fichiers vidéo dans un torrent | ❌ Exclu MVP | Sélectionner le plus gros fichier vidéo |
| Lib `bencode` npm | ⏸ Possible | Recommandé hand-roll pour le slice `info` ; lib OK si slice brut géré |
| Lib `magnet-uri` | ⏸ Possible | Parser magnet = manip de chaîne, probablement conforme |

### UX / polish

| Option | Statut | Notes |
|---|---|---|
| Grisage releases 0-seed | ⏸ En suspens | ~quelques lignes, pas mandatory |
| Recherche EZTV par titre pour combler trous | ❌ Rejeté | EZTV n’a pas de vraie recherche (filtre client-side sur uploads récents) |
| Filtrer les films sans poster TMDb | ❌ Rejeté | Réduit le catalogue ; placeholder préféré |

---

## Chronologie des pivots

```
2026-06-04  Découverte : torrent-stream interdit → plan moteur maison
2026-06       Discussion Jackett → YTS + agrégateur
2026-06       Pivot apibay/TPB (zéro infra) dans les chats
2026-06-25    Revert apibay → EZTV gardé ; pages Movies/Séries ; deep-fetch lazy
2026-06-25    Décision finale : YTS + EZTV (mandatory) ; Prowlarr (bonus plus tard)
```

Les fichiers dans [`archive/`](./archive/) reflètent les étapes intermédiaires — **ne pas suivre leurs recommandations de sources sans vérifier ce document**.
