# Handoff — Moteur BitTorrent maison

> **Pour l'agent qui reprend ce chantier.** Branche `develop`, HEAD `9181796` (juillet 2026).
> Tout le mandatory hors moteur est fait et commité. **Il ne reste que ce rework** (bloquant soutenance).

---

## Mission en une phrase

Remplacer `torrent-stream` par un client BitTorrent **hand-rollé** (M1→M8), en préservant la façade `TorrentService` consommée par `StreamingService`.

---

## Pourquoi c'est éliminatoire

- Sujet `en.subject.pdf` Ch. II : interdit toute lib qui **« create a video stream from a torrent »**
- `torrent-stream` est dans cette catégorie (comme webtorrent, peerflix)
- Règle V.1 : *« Anything not specifically authorized is forbidden »* → **0 possible**

---

## Ce qui est DÉJÀ fait (ne pas refaire)

| Zone | État |
|---|---|
| Auth, API OAuth2, users, comments | ✅ |
| Library films/séries (YTS + EZTV, deep-fetch) | ✅ |
| `ensurePlayback()` + serve depuis disque si `ready` | ✅ `torrent.service.ts` |
| Transcodage mkv, sous-titres, cleanup 30j | ✅ |
| Frontend player, séries, posters | ✅ |
| Docs projet | ✅ `docs/` |

**Push** : `develop` est à jour sur GitHub (9+ commits ahead of old `origin/develop` at handoff time).

---

## Ce qui reste (ton périmètre)

```
backend/src/streaming/
├── services/torrent.service.ts     ← réécrire en façade fine
└── torrent/                        ← À CRÉER (moteur hand-rollé)
    ├── bencode.ts
    ├── metadata/
    │   ├── torrent-metadata.ts
    │   ├── from-torrent-file.ts      # YTS
    │   └── from-magnet.ts            # EZTV — M7
    ├── tracker/ { http, udp }
    ├── peer/ { peer-connection, messages, extension }
    ├── piece/ { piece-picker, piece-store }
    └── torrent-download.ts
```

**À retirer en M8** : `torrent-stream`, `@types/torrent-stream` dans `backend/package.json`.

---

## Contrat public à préserver

Fichiers consommateurs (ne pas casser leur API) :
- `backend/src/streaming/streaming.service.ts`
- `backend/src/streaming/streaming.controller.ts`

| Méthode `TorrentService` | Rôle |
|---|---|
| `ensurePlayback(torrentId, magnetUrl)` | Déjà implémenté : disque si `ready`, sinon download — **garder** |
| `isActive(id)` | Download en cours ? |
| `getProgress(id)` | `{ status, progress, filePath, fileSize }` |
| `getFile(id)` | `TorrentFile` avec **`createReadStream({start,end})`** ← piège n°1 |
| `destroyEngine(id)` / `onModuleDestroy()` | Cleanup |

Types : `backend/src/streaming/interfaces/index.ts` — retirer champs spécifiques `torrent-stream` (`swarm`, `select`/`deselect`) en M8.

---

## Sources de contenu

| Source | Format | Chemin moteur |
|---|---|---|
| **YTS** (films) | API donne `torrent.url` (`.torrent`) + `hash` | M1→M6 |
| **EZTV** (séries) | magnet only | M7 (BEP9, pas de DHT) |

**Pas encore en DB** : `Torrent.torrentFileUrl` — à ajouter en **début de M1**, peupler depuis `torrent.url` dans `movie-cache.service.ts` (`cacheYtsMovies`). Aujourd'hui seul `magnetUrl` est stocké (construit depuis `hash`).

---

## Milestones (ordre strict)

| # | Livrable | Test de validation |
|---|---|---|
| **M1** | `torrentFileUrl` + bencode + `from-torrent-file` | `info_hash` recalculé == `hash` YTS |
| **M2** | Trackers HTTP + UDP | Announce → liste peers non vide |
| **M3** | Peer wire + bitfield (bit ext `0x10`) | Handshake + bitfield d'un peer |
| **M4** | 1 pièce + SHA1 + disque | choke/unchoke + interested **obligatoire** |
| **M5** | Picker séquentiel + download complet | Fichier lisible ; branche disque `ready` |
| **M6** | `createReadStream` progressif + seek | `<video>` stream pendant DL → **films YTS OK** |
| **M7** | BEP9 / magnet (~150–200 L) | EZTV streamable |
| **M8** | Bascule + suppression `torrent-stream` | Suite tests verte |

Détail complet : **[torrent-engine.md](./torrent-engine.md)**

---

## Décisions figées (ne pas re-discuter)

- **Pas de DHT** (BEP5) — peers via trackers publics
- **Built-ins Node** pour le protocole (`net`, `dgram`, `crypto`, `stream`, `fs`)
- **Bencode hand-rollé** recommandé (slice brut dict `info` pour `info_hash`)
- **Picker séquentiel** (streaming)
- Libs **interdites** : webtorrent, peerflix, bittorrent-tracker, bittorrent-dht, bittorrent-protocol, parse-torrent combo

Voir **[decisions.md](./decisions.md)**

---

## Tests & conventions

- **Vitest** : `npm test` dans `backend/`
- Specs unitaires : `src/**/*.spec.ts`
- E2E streaming : `src/streaming/*.e2e-spec.ts`
- **Unitaires déterministes** (fixtures binaires) pour bencode, messages wire, UDP — **pas de réseau en CI**
- **Intégration live** (peer réel, download bout-en-bout) : gated / manuel uniquement

Stack : TypeScript strict, NestJS, CommonJS, `fetch` natif (pas axios).

---

## Gotchas connus (lire avant de coder)

1. **`info_hash`** = SHA1 des **bytes exacts** du dict `info` — pas un ré-encodage bencode
2. **choke/unchoke + interested** avant toute requête de pièce (sinon stall à 0)
3. **`createReadStream`** doit prioriser les pièces de la plage demandée + backpressure
4. **Bounds-check** sur tout Buffer venant d'un peer (crash = violation V.1)
5. **Multi-fichiers** : écrire la vraie arborescence ; cleanup supprime le **dossier**
6. **`ensurePlayback` disque** existe déjà — le moteur maison doit s'y brancher, pas le supprimer

---

## Premier commit suggéré (M1a)

```
feat(db): add torrentFileUrl for YTS .torrent sources
feat(streaming): add bencode parser and YTS torrent metadata loader (M1)
```

Fichiers touchés attendus :
- `backend/prisma/schema.prisma` + migration
- `backend/src/movies/services/movie-cache.service.ts`
- `backend/src/streaming/torrent/bencode.ts`
- `backend/src/streaming/torrent/metadata/*`
- `backend/src/streaming/torrent/*.spec.ts`

---

## Prompt de démarrage (copier-coller)

```
Tu reprends Hypertube sur develop. Lis docs/handoff-torrent-engine.md puis
docs/torrent-engine.md. Le mandatory est fini sauf le moteur BitTorrent :
torrent-stream doit être remplacé par un hand-roll M1→M8. Commence par M1
(torrentFileUrl + bencode + from-torrent-file, test info_hash vs hash YTS).
Ne touche pas au frontend ni aux providers movies sauf torrentFileUrl au cache.
```

---

## Fichiers clés à ouvrir en premier

1. `docs/handoff-torrent-engine.md` (ce fichier)
2. `docs/torrent-engine.md`
3. `backend/src/streaming/services/torrent.service.ts` — surface actuelle
4. `backend/src/streaming/streaming.service.ts` — consommateur (`getVideoStream`, `ensurePlayback`)
5. `backend/src/movies/services/movie-cache.service.ts` — où ajouter `torrent.url`
6. `backend/src/movies/interfaces/index.ts` — type `YtsTorrent.url`
7. `en.subject.pdf` — règle interdiction si besoin de justifier en soutenance
