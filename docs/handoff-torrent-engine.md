# Handoff — Moteur BitTorrent maison

> **Statut : TERMINÉ** (juillet 2026).
> Ce document est conservé comme archive du brief initial. Référence technique actuelle : [torrent-engine.md](./torrent-engine.md).

---

## Résultat

- `torrent-stream` retiré de `backend/package.json`
- Moteur hand-rollé dans `backend/src/streaming/torrent/` (M1→M8)
- `TorrentService` réécrit en façade fine
- `Torrent.torrentFileUrl` ajouté et peuplé depuis YTS
- ~333 tests unitaires backend verts, build OK

---

## Contrat public (`TorrentService`)

| Méthode | Rôle |
|---|---|
| `ensurePlayback(torrentId)` | Disque si `ready`, sinon download |
| `isActive(id)` | Download en cours ? |
| `getProgress(id)` | `{ status, progress, filePath, fileSize }` |
| `getFile(id)` | `TorrentFile` avec `createReadStream({start,end})` |
| `destroyEngine(id)` / `onModuleDestroy()` | Nettoyage |

---

## Fichiers clés

1. [torrent-engine.md](./torrent-engine.md) — architecture et conformité
2. `backend/src/streaming/services/torrent.service.ts` — façade
3. `backend/src/streaming/torrent/torrent-download.ts` — orchestrateur
4. [status.md](./status.md) — reste à faire avant soutenance
