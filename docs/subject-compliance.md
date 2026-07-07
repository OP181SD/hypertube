# Conformité au sujet

> Référence : [`en.subject.pdf`](../en.subject.pdf) v6.3 · Règles éliminatoires Ch. V.1

---

## Règles éliminatoires (V.1)

| Règle | Implication |
|---|---|
| Aucune erreur/warning/notice serveur **ni** console client | Tester en conditions réelles avant soutenance |
| *« Anything not specifically authorized is forbidden »* | `torrent-stream` = risque de 0 |
| Moindre faille de sécu = 0 | Mots de passe hashés, validation forms, pas d'injection SQL/XSS |
| Credentials dans `.env`, exclus de git | Vérifier `.gitignore` |

---

## Mandatory — checklist

### Ch. II — Instructions générales

| Exigence | État | Notes |
|---|---|---|
| Pas de lib « stream from torrent » | ❌ | `torrent-stream` encore utilisé → [torrent-engine.md](./torrent-engine.md) |
| Firefox + Chrome latest | ✅ | À re-vérifier avant soutenance |
| Layout header / main / footer | ✅ | |
| Mobile acceptable | ✅ | |
| Forms validées, site sécurisé | ✅ | argon2, helmet, class-validator, magic bytes avatar |
| `.env` hors git | ✅ | |

### III.1 — User Interface

| Exigence | État |
|---|---|
| Register (email, username, nom, prénom, password protégé) | ✅ |
| OAuth ≥2 stratégies dont **42** | ✅ (42 + Google/GitHub/Discord) |
| Login username/password | ✅ |
| Reset password par email | ✅ |
| Logout one-click | ✅ |
| Langue préférée, défaut anglais | ✅ |
| Modifier profil (email, avatar, infos) | ✅ |
| Voir profil autre user (email privé) | ✅ |

### III.2 — Library

| Exigence | État | Notes |
|---|---|---|
| ≥2 sources externes vidéo only | ✅ | YTS + EZTV ([decisions.md](./decisions.md)) |
| Search field + thumbnails | ✅ | |
| Résultats triés par nom si recherche | ✅ | |
| Popular si pas de recherche | ✅ | |
| Thumbnail : nom, année (si dispo), note (si dispo), **cover** | ✅ | `PosterImage` avec placeholder sur grille, fiche détail et preview |
| Watched / unwatched différenciés | ✅ | |
| Pagination scroll infini (pas de lien) | ✅ | |
| Tri / filtres (nom, genre, note, année…) | ✅ | |

### III.3 — Video Part

| Exigence | État | Notes |
|---|---|---|
| Détails vidéo (player, résumé, casting, année, durée, note, cover…) | ✅ | Cover via `PosterImage` sur fiche lecture |
| Commentaires | ✅ | |
| Lancer torrent si pas DL, stream dès assez de données, non-bloquant | ✅* | *via lib interdite |
| Film complet sauvé, **pas de re-download** | ✅ | `ensurePlayback` + branche disque dans `TorrentService` |
| Suppression si non regardé 1 mois | ✅ | `cleanup.service.ts` |
| Sous-titres EN + langue préférée si dispo | ✅ | OpenSubtitles |
| Transcodage mkv si pas lisible nativement | ✅ | ffmpeg |

### III.4 — API

| Exigence | État |
|---|---|
| REST + OAuth2 | ✅ |
| Routes documentées dans le sujet | ✅ |
| Autres routes rejetées | ✅ |
| Preuve API RESTful | ✅ | [api-restful.md](./api-restful.md) |

### Ch. IV — Bonus

Évalué **uniquement si le mandatory est parfait**. Idées : OAuth extra, résolutions, MediaStream, Prowlarr, routes API movies CRUD.

---

## Interprétations tranchées

### Covers / posters

> *« Each thumbnail must display […] a cover image. »*

- L'année et la note ont « (if available) » — **pas la cover**.
- **Ne pas filtrer** les contenus sans poster TMDb.
- **Afficher un placeholder** local si `poster_path === null` (éviter 404 console sur URL invalide).
- État actuel : grille, fiche détail et preview utilisent `PosterImage` (placeholder local + `onError`)

### Sources

- **TMDb ne compte pas** comme source (métadonnées, pas contenu torrent).
- **≥2 sources** = minimum, pas exactement 2 → Prowlarr en 3ᵉ est permis en bonus.
- magnet / DHT / BEP9 / `.torrent` ne sont **pas exigés** — moyens techniques.
- Séries TV : **bonus**, pas explicitement demandé.

### Libs autorisées pour le hand-roll

| ✅ OK | ❌ Interdit |
|---|---|
| `node:net`, `dgram`, `crypto`, `stream`, `fs` | torrent-stream, webtorrent, peerflix, pulsar |
| `fluent-ffmpeg` (transcodage, déjà utilisé) | bittorrent-tracker, bittorrent-dht, bittorrent-protocol |
| bencode / magnet-uri si pure manipulation de données | combo parse-torrent + download clé en main |

---

## Points de vigilance soutenance

1. **`torrent-stream`** — correcteur peut demander d'où vient le stream → expliquer le rework en cours ou démontrer le moteur maison
2. **Re-download** — démontrer qu'un film `ready` se lit après restart sans re-téléchargement
3. **Console navigateur** — 0 erreur (images 404, JS warnings)
4. **Réseau école** — tester UDP tracker jour 1 ; HTTP tracker en fallback si bloqué
5. **Contenu démo** — films/séries populaires et bien seedés (YTS prioritaire)
