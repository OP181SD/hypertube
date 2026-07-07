# Moteur BitTorrent — référence technique

> **Statut : implémenté** (juillet 2026). `torrent-stream` retiré.
>
> Contexte sources : [decisions.md](./decisions.md) · État global : [status.md](./status.md)

---

## Conformité sujet

Le sujet (Ch. II) interdit toute lib qui **« create a video stream from a torrent »**.
Le moteur est hand-rollé dans `backend/src/streaming/torrent/` avec les built-ins Node uniquement (`net`, `dgram`, `crypto`, `stream`, `fs`).

---

## Façade publique (`TorrentService`)

`StreamingService` + `StreamingController` consomment uniquement :

| Méthode | Rôle |
|---|---|
| `ensurePlayback(torrentId)` | Disque si `ready`, sinon démarre le download |
| `isActive(id)` | Download en cours ? |
| `getProgress(id)` | `{ status, progress, filePath, fileSize }` |
| `getFile(id)` | `TorrentFile` avec `createReadStream({start,end})` |
| `destroyEngine(id)` / `onModuleDestroy()` | Nettoyage |

`createReadStream` attend les pièces manquantes et priorise la plage demandée (streaming progressif + seek).

---

## Sources & chemins d'entrée

| Source | Format | Chemin |
|---|---|---|
| **YTS** (films) | `.torrent` URL (`torrentFileUrl`) + magnet en repli | `from-torrent-file.ts` |
| **EZTV** (séries) | magnet only | `from-magnet.ts` + BEP9 `ut_metadata` |

Les deux convergent vers `TorrentMetadata` — le moteur aval est identique.

---

## Structure des fichiers

```
backend/src/streaming/
├── services/
│   └── torrent.service.ts        ← façade (Map<id, TorrentDownload>)
└── torrent/
    ├── bencode.ts
    ├── torrent-download.ts
    ├── metadata/
    │   ├── torrent-metadata.ts
    │   ├── from-torrent-file.ts
    │   └── from-magnet.ts
    ├── tracker/
    │   └── tracker-client.ts     ← HTTP + UDP (BEP15)
    ├── peer/
    │   ├── peer-connection.ts
    │   ├── messages.ts
    │   └── extension.ts          ← BEP10 + ut_metadata (BEP9)
    └── piece/
        ├── piece-picker.ts
        └── piece-store.ts
```

---

## Contrat interne `TorrentMetadata`

```ts
interface TorrentMetadata {
  infoHash: Buffer;
  infoHashHex: string;
  name: string;
  pieceLength: number;
  pieces: Buffer[];
  files: { path: string; length: number; offset: number }[];
  totalLength: number;
  trackers: string[];
}
```

`info_hash` = SHA1 des **bytes exacts** du dict `info` (slice brut via `extractInfoDictRaw`, pas de ré-encodage).

---

## Milestones M1→M8 (tous livrés)

| # | Livrable | Fichiers |
|---|---|---|
| M1 | Bencode + `.torrent` | `bencode.ts`, `from-torrent-file.ts` |
| M2 | Trackers HTTP + UDP | `tracker/tracker-client.ts` |
| M3 | Peer wire + bitfield | `peer/messages.ts`, `peer-connection.ts` |
| M4 | Download pièce + SHA1 | `piece/piece-store.ts` |
| M5 | Picker séquentiel + disque | `piece/piece-picker.ts`, `torrent-download.ts` |
| M6 | `createReadStream` progressif | `piece-store.ts` |
| M7 | BEP9 / magnet | `peer/extension.ts`, `from-magnet.ts` |
| M8 | Bascule + retrait `torrent-stream` | `torrent.service.ts`, specs |

---

## Modifs hors moteur

| Modif | Détail |
|---|---|
| **Prisma** | `Torrent.torrentFileUrl` — peuplé depuis `torrent.url` YTS au cache |
| **`ensurePlayback`** | Lit `torrentFileUrl` en DB, préfère `.torrent` à magnet |
| **`interfaces/index.ts`** | `TorrentFile` sans champs `torrent-stream` |
| **Cleanup cron** | Supprime `{STORAGE_PATH}/{hash}/` |

---

## Tests

| Catégorie | Contenu | Où |
|---|---|---|
| Unitaires déterministes | bencode, messages wire, magnet parse, SHA1 | `src/streaming/torrent/**/*.spec.ts` |
| Intégration live | announce réel, download+stream | Manuel uniquement |

---

## Dépendances

| ✅ Utilisé | ❌ Interdit |
|---|---|
| `node:net`, `dgram`, `crypto`, `stream`, `fs` | webtorrent, peerflix, pulsar, torrent-stream |
| `fluent-ffmpeg` (transcodage) | bittorrent-tracker, bittorrent-dht, bittorrent-protocol |

---

## Risques résiduels (soutenance)

1. **Réseau école** — UDP tracker peut être bloqué ; HTTP tracker en fallback partiel
2. **Peers muets** — contenu peu seedé = stall ; privilégier films YTS populaires
3. **EZTV magnet** — pas de DHT ; dépend des trackers du magnet
4. **Torrents DB sans `torrentFileUrl`** — re-cacher YTS ou fallback magnet
