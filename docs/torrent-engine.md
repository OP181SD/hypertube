# Moteur BitTorrent — plan de rework

> **Statut : pas commencé** (juillet 2026). `torrent-stream` toujours en place → **éliminatoire**.
>
> Contexte sources : [decisions.md](./decisions.md) · État global : [status.md](./status.md)

---

## Pourquoi ce rework est obligatoire

Le sujet (Ch. II) interdit toute lib qui **« create a video stream from a torrent »**.
`torrent-stream` en est une (et `peerflix`, cité comme interdit, est bâti dessus).

Règle V.1 : *« Anything not specifically authorized is forbidden »* → risque de **0**.

**Bonus** : supprimer `torrent-stream` élimine aussi les 5 vulns `ip` (CVE-2024-29415) — seule source dans le projet.

---

## Principe directeur : préserver la surface

`StreamingService` + `StreamingController` ne consomment que **6 points de contact** de `TorrentService`. On les fige comme contrat, on reconstruit tout derrière.

| Méthode | Attendu |
|---|---|
| `isActive(id): boolean` | Un download tourne-t-il ? |
| `startDownload(source, id): Promise<void>` | Démarre — **source = `.torrent` URL ou magnet** |
| `getProgress(id): DownloadProgress` | `{ status, progress, filePath, fileSize }` |
| `getFile(id): TorrentFile \| null` | `{ name, length, createReadStream({start,end}) }` |
| `destroyEngine(id)` / `onModuleDestroy()` | Nettoyage |

⚠️ **Piège n°1** : `file.createReadStream({start,end})` doit rendre un `Readable` qui **attend les pièces manquantes et les priorise** (streaming progressif + seek).

⚠️ **Conformité disque** : le sujet exige qu'un film entièrement téléchargé soit **servi depuis le disque sans re-télécharger**. Implémenté via `ensurePlayback()` + `diskFiles` dans `torrent.service.ts` (patch juillet 2026). Le moteur maison (M5) reprendra la même branche.

---

## Sources & chemins d'entrée

| Source | Format | Chemin moteur | Streamable après |
|---|---|---|---|
| **YTS** (films) | `.torrent` URL + `info_hash` | M1→M6 (`.torrent`) | **M6** |
| **EZTV** (séries) | magnet only (`info_hash`) | M7 (BEP9) après M3 | **M7** |

Les deux convergent vers un type unique `TorrentMetadata` — le moteur aval est identique.

**Exigence sujet « ≥2 sources »** : satisfaite au niveau **recherche** dès YTS+EZTV en place. La 2ᵉ source **lisible** (EZTV magnet) dépend de **M7**.

---

## Structure de fichiers cible

```
src/streaming/
├── services/
│   └── torrent.service.ts        ← REÉCRIT : façade fine (Map<id, TorrentDownload>)
└── torrent/                      ← NOUVEAU : moteur hand-rollé
    ├── bencode.ts
    ├── metadata/
    │   ├── torrent-metadata.ts
    │   ├── from-torrent-file.ts    ← YTS
    │   └── from-magnet.ts          ← EZTV (BEP9)
    ├── tracker/
    │   ├── http-tracker.ts
    │   └── udp-tracker.ts
    ├── peer/
    │   ├── peer-connection.ts
    │   ├── messages.ts
    │   └── extension.ts            ← BEP10 + ut_metadata (BEP9)
    ├── piece/
    │   ├── piece-picker.ts
    │   └── piece-store.ts
    └── torrent-download.ts
```

---

## Contrat interne `TorrentMetadata`

```ts
interface TorrentMetadata {
  infoHash: Buffer;          // 20 bytes (SHA1)
  name: string;
  pieceLength: number;
  pieces: Buffer[];          // hash SHA1 (20 bytes) par pièce
  files: { path: string; length: number; offset: number }[];
  totalLength: number;
  trackers: string[];
}
```

Une fois obtenu, **le moteur ne sait plus d'où ça vient**.

---

## Milestones M1→M8

### M1 — Bencode + métadonnées `.torrent`
- `bencode.ts` + `from-torrent-file.ts`
- Test : parser un `.torrent` YTS, recalculer `info_hash`, vérifier == `hash` API
- ⚠️ Gotcha : `info_hash` = SHA1 des **bytes exacts** du dict `info` → exposer le slice brut, pas ré-encoder

### M2 — Tracker client → liste de peers
- `http-tracker.ts` puis `udp-tracker.ts`
- Test : announce sur trackers publics → liste `{ip,port}` non vide
- ⚠️ Re-announce périodique (respecter `interval` du tracker)

### M3 — Peer wire : handshake + bitfield
- `peer-connection.ts` + `messages.ts`
- Handshake avec bit d'extension `0x10` activé (prérequis BEP9)
- ⚠️ Bounds-check systématique sur tout `Buffer` venant d'un peer (crash = violation V.1)

### M4 — Download d'une pièce + vérif SHA1 + disque
- `piece-store.ts` + boucle request/piece (blocs 16 KiB)
- ⚠️ Machine à états **choke/unchoke + interested** obligatoire : `interested` → `unchoke` → `request`

### M5 — Picker séquentiel + download complet + service disque
- `piece-picker.ts` + `torrent-download.ts`
- Layout multi-fichiers réel (`metadata.files[].path/offset`)
- À complétion → `ready` + branche « servir depuis disque » (`fs.createReadStream`)
- Cleanup supprime le **dossier** du torrent, pas un seul `filePath`

### M6 — Streaming progressif (contrat critique)
- `piece-store.createReadStream({start,end})` : priorise les pièces de la plage
- Test : `<video>` lit pendant le download (seek inclus)
- ⚠️ Backpressure (`highWaterMark`) — ne pas bufferiser tout le fichier
- → **Chemin critique conforme atteint** (films YTS via `.torrent`)

### M7 — Branchement BEP9 (magnet / EZTV)
- `extension.ts` (BEP10 + ut_metadata) + `from-magnet.ts`
- Réutilise M3, pas de DHT — peers via trackers publics du magnet
- ~150–200 lignes isolées, réinjecte dans M5/M6 inchangés
- → **EZTV streamable**

### M8 — Bascule + suppression `torrent-stream`
- `torrent.service.ts` câble la `Map` sur `torrent-download`
- Retirer `torrent-stream` + `@types/torrent-stream` du `package.json`
- Adapter les `*.spec.ts` du module streaming

---

## Stratégie de test

| Catégorie | Contenu | Où |
|---|---|---|
| **Unitaires déterministes** | bencode, messages wire, UDP announce, ut_metadata + SHA1 | CI, fixtures binaires, zéro réseau |
| **Intégration live** | M2 announce réel, M3 peer réel, M5/M6 download+stream | Manuel / flag env, **jamais** en CI par défaut |

---

## Dépendances

| | |
|---|---|
| **Autorisé** | `node:net`, `node:dgram`, `node:crypto`, `node:stream`, `node:fs` ; bencode hand-rollé recommandé |
| **À retirer (M8)** | `torrent-stream`, `@types/torrent-stream` |
| **Interdit** | webtorrent, peerflix, pulsar, bittorrent-tracker, bittorrent-dht, bittorrent-protocol, parse-torrent combo |

---

## Modifs hors moteur

| Modif | Détail |
|---|---|
| **Prisma** | Ajouter `torrentFileUrl String?` à `Torrent`. Peupler depuis `torrent.url` YTS au cache |
| **`startDownload`** | Reçoit `{ kind: "file", url }` (préféré) ou `{ kind: "magnet", uri }` |
| **`StreamingService`** | ~2 lignes : choisir la source ; branche disque si `ready` + fichier présent |
| **`interfaces/index.ts`** | Retirer champs torrent-stream (`swarm`, `select`/`deselect`, `remove`) |
| **Cleanup cron** | Supprimer le dossier torrent (multi-fichiers) |

---

## Risques (par ordre de douleur)

1. **`createReadStream` qui attend + priorise** (M6) — cœur du streaming
2. **Slice brut dict `info`** (M1) — mauvais ré-encodage = 0 peer
3. **Choke/unchoke + interested** (M4) — oubli classique = stall à 0 pièce
4. **UDP tracker BEP15** (M2) et **ut_metadata** (M7) — protocoles binaires
5. **Peers muets** — timeouts + pool parallèle dès M3
6. **Bounds-checks** sur Buffers non fiables — crash serveur = 0
7. **Magnet-only peu seedé** (EZTV) — 0 peer possible sans DHT ; mitigation : contenu populaire en démo

---

## Estimation

| Phase | Effort |
|---|---|
| M1→M6 (moteur conforme, chemin `.torrent`/YTS) | ~80 % |
| M7 (BEP9/magnet/EZTV) | ~150–200 L, isolé |
| M8 (bascule + cleanup + specs) | Faible |

**Prochaine action** : démarrer **M1** (bencode + parsing `.torrent` + recalcul `info_hash`).
