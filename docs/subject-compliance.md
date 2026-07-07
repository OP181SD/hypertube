# Conformité au sujet

> Référence : [`en.subject.pdf`](../en.subject.pdf) v6.3 · Règles éliminatoires Ch. V.1

---

## Règles éliminatoires (V.1)

| Règle | Implication |
|---|---|
| Aucune erreur/warning/notice serveur **ni** console client | Tester en conditions réelles avant soutenance |
| *« Anything not specifically authorized is forbidden »* | Pas de lib torrent streaming tierce |
| Moindre faille de sécu = 0 | Mots de passe hashés, validation forms, pas d'injection SQL/XSS |
| Credentials dans `.env`, exclus de git | Vérifier `.gitignore` |

---

## Mandatory — checklist

### Ch. II — Instructions générales

| Exigence | État | Notes |
|---|---|---|
| Pas de lib « stream from torrent » | ✅ | Moteur hand-rollé — [torrent-engine.md](./torrent-engine.md) |
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
| Thumbnail : nom, année (si dispo), note (si dispo), **cover** | ✅ | `PosterImage` avec placeholder |
| Watched / unwatched différenciés | ✅ | |
| Pagination scroll infini (pas de lien) | ✅ | |
| Tri / filtres (nom, genre, note, année…) | ✅ | |

### III.3 — Video Part

| Exigence | État | Notes |
|---|---|---|
| Détails vidéo (player, résumé, casting, année, durée, note, cover…) | ✅ | |
| Commentaires | ✅ | |
| Lancer torrent si pas DL, stream dès assez de données, non-bloquant | ✅ | Moteur maison |
| Film complet sauvé, **pas de re-download** | ✅ | Branche disque dans `TorrentService` |
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

- **Ne pas filtrer** les contenus sans poster TMDb.
- **Afficher un placeholder** local si pas de poster.
- État actuel : `PosterImage` sur grille, fiche détail et preview.

### Sources

- **TMDb ne compte pas** comme source (métadonnées, pas contenu torrent).
- **≥2 sources** = minimum → Prowlarr en 3ᵉ est permis en bonus.
- Séries TV : **bonus**, pas explicitement demandé.

### Libs autorisées pour le hand-roll

| ✅ OK | ❌ Interdit |
|---|---|
| `node:net`, `dgram`, `crypto`, `stream`, `fs` | torrent-stream, webtorrent, peerflix, pulsar |
| `fluent-ffmpeg` (transcodage) | bittorrent-tracker, bittorrent-dht, bittorrent-protocol |

---

## Points de vigilance soutenance

1. **Moteur maison** — savoir expliquer bencode, trackers, peer wire, `createReadStream` progressif
2. **Re-download** — démontrer qu'un film `ready` se lit après restart sans re-téléchargement
3. **Console navigateur** — 0 erreur
4. **Réseau école** — tester UDP tracker ; contenu bien seedé
5. **Contenu démo** — films YTS populaires en priorité
