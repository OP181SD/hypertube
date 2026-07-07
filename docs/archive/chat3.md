# Chat 3 — Conformité `torrent-stream` & révision du plan de rework

> Contexte sauvegardé avant fermeture de session. Projet Hypertube v6.3 (BitTorrent
> streaming web app). Branche `develop`. Date : 2026-06.

---

## 1. Question initiale : `torrent-stream` est-il vraiment interdit ?

**Réponse : OUI, confirmé en lisant le sujet (`en.subject.pdf`).**

### Règle exacte (Chapitre II « General Instructions », p.3)
> « All frameworks, micro-frameworks, libraries, etc. are allowed, **except for those that
> are used to create a video stream from a torrent**. This restriction is to ensure that the
> educational purpose of the project is not compromised. For example, libraries such as
> **webtorrent**, **pulsar** and **peerflix** are not permitted. »

Points clés :
- Ce n'est **pas une liste noire fermée** — c'est une **catégorie fonctionnelle** (« such as »).
- Tout ce qui « create a video stream from a torrent » est banni.
- Règle V.1 (Eliminatory rules, p.9) : « **Anything not specifically authorized is
  forbidden** » + « aucune erreur/warning serveur ou client » + « moindre faille sécu = 0 ».

### Pourquoi `torrent-stream` tombe dedans
1. Sa description officielle = « Streaming torrent client for Node.js » → littéralement la
   phrase interdite.
2. `peerflix` (cité comme interdit) **n'est qu'un wrapper de `torrent-stream`** → bannir le
   wrapper mais autoriser le moteur serait absurde.
3. Vise le « educational purpose » : on doit implémenter le protocole BitTorrent soi-même.

**Bonus** : `torrent-stream` est la seule source des **5 vulns `ip` (CVE-2024-29415)**. Le
hand-roll règle conformité + sécu d'un coup.

---

## 2. Ce qu'on utilise réellement de la lib (surface d'API)

Seul fichier de prod concerné : `backend/src/streaming/services/torrent.service.ts`
(1 `import torrentStream from "torrent-stream"`, 1 cast `as unknown as TorrentEngine`).
Tout est déjà isolé derrière les interfaces `TorrentEngine` / `TorrentFile`
(`backend/src/streaming/interfaces/index.ts`). `streaming.service.ts` consomme via la façade.

Surface consommée :
- **Factory** : `torrentStream(magnetUrl, { path, trackers })` — entrée **magnet uniquement**
  aujourd'hui.
- **Events** : `torrent`, `ready`, `download(pieceIndex)`, `idle`, `error`.
- **Props engine** : `engine.files`, `engine.swarm.{connections,wired}` (log peers),
  `engine.torrent.pieces.length` (dénominateur %).
- **Méthodes engine** : `engine.destroy()` ; `remove()` typé mais **jamais appelé**.
- **Sur `TorrentFile`** : `name`, `path`, `length`, `select()`, `deselect()`,
  `createReadStream({start,end})` ← **cœur du streaming**, appelé dans
  `streaming.service.ts:getVideoStream` (gestion Range/206).

---

## 3. L'USAGE qu'on fait est-il interdit (vs la lib elle-même) ?

**OUI — c'est précisément l'usage interdit, indépendamment du débat sur la lib.**

Flux délégué :
```
magnetUrl
  → torrentStream(...)        [tracker/DHT, swarm, peer wire, download pièces, storage]
  → file.createReadStream()   [Readable séquentiel, pièces priorisées pour la lecture]
  → réponse HTTP 206 Range    → <video> du navigateur
```

On prend les **deux maillons exacts** que le sujet veut faire coder :
1. **Le moteur BitTorrent** (factory + events) = tout le protocole.
2. **`createReadStream`** = le **bridge torrent→stream** lui-même = mot pour mot « create a
   video stream from a torrent ».

Aucun sous-ensemble « innocent » : on ne s'en sert pas comme simple parser. Distinction :
- ✅ Autorisé : parser bencode / décoder un magnet (pure manipulation de données).
- ❌ Interdit : `createReadStream` + engine de DL P2P → flux vers le player.

---

## 4. Libs autorisées pour le hand-roll

**Principe de tri (à défendre en soutenance)** : une lib est OK si elle **ne touche ni au
protocole BitTorrent ni au bridge de streaming** — pur traitement de données générique.

### ✅ Autorisé
**Built-ins Node (l'essentiel de l'aide) :**
- `net` → sockets TCP vers peers (peer wire)
- `dgram` → UDP tracker announce + DHT
- `http`/`https` → HTTP tracker announce
- `crypto` → SHA-1 (`info_hash`, vérif pièces)
- `stream` (`Readable`) → construire `createReadStream` (le bridge)
- `fs` → storage des pièces

**Libs utilitaires :**
- `bencode` — encode/decode (pur parsing). *Recommandé de le hand-roller (~100 lignes) pour
  maîtriser le slice brut du dict `info`.*
- `magnet-uri` — parser magnet → `{infoHash, trackers}` (pure manip de chaîne)
- `fluent-ffmpeg` / ffmpeg — transcodage mkv→mp4 (rien à voir avec torrent, déjà utilisé)

### ❌ Interdit (composants du protocole = à coder soi-même)
`torrent-stream`, `webtorrent`, `peerflix`, `pulsar`, `bittorrent-tracker` (+ ramène vuln
`ip`), `bittorrent-dht`, `bittorrent-protocol`, `ut_metadata`, `torrent-discovery`.

### ⚠️ Zone grise à éviter
`parse-torrent` : tire `bittorrent-protocol` & co en transitif → préférer `bencode` +
`magnet-uri`.

---

## 5. Revue du plan existant `docs/torrent-engine-rework-plan.md`

**Verdict : très bon plan, au-dessus de la moyenne.** Structure/abstraction/ordre des
milestones solides. Avait 6 trous réels (maintenant comblés, voir §6).

### Ce qui était déjà excellent
- §0 préservation de la surface (6 points de contact) — matche le code.
- §2 pivot `TorrentMetadata` source-agnostique.
- Ordre milestones (.torrent d'abord, BEP9 greffé en M7).
- Gotcha slice brut du dict `info` (M1) bien identifié et placé en premier.
- Bit d'extension `0x10` activé dès M3.
- Décision « pas de DHT, trackers publics collés au magnet ».

---

## 6. Révisions APPLIQUÉES au plan (cette session)

Tous les ajouts utilisent **uniquement des built-ins Node** + protocole hand-roll →
**conformes au sujet**, vérifié.

| Ajout | Où | Conformité |
|-------|-----|-----------|
| Branche **« servir depuis le disque »** (pas de re-download) | §0, M5, §5 | `node:fs` — **exigé** par le sujet |
| Machine à états **choke/unchoke + interested** | M4, §6.3 | protocole hand-roll (exigé) |
| **Layout multi-fichiers** + cleanup du dossier | M5, §5 | logique maison |
| **Stratégie de test** (unitaires déterministes vs live gated) | §3 | sert règle V.1 |
| **Bounds-checks** Buffers non fiables + **backpressure** | M3, §6.1, §6.6 | défensif, built-ins |
| **Re-announce** tracker périodique | M2 | protocole maison |
| Risque **peer-discovery sans DHT** (magnet-only) | §6.7 | choix assumé documenté |
| Nuance **M6 = chemin `.torrent`** ; 2ᵉ source magnet dépend de M7 | §3 | clarification |
| `remove(keepPieces)` typé mais inutilisé → supprimé | §5 | nettoyage |

### Détails des trous comblés
1. **Choke/unchoke + interested (M4)** : un peer n'envoie RIEN tant qu'on n'a pas émis
   `interested` ET reçu `unchoke`. Séquence : `interested` → attendre `unchoke` → `request`.
   Endroit classique où les clients hand-roll stallent à 0 piece.
2. **Servir depuis le disque** : sujet exige film complet servi sans re-download. Bug
   existant : `torrent.service.ts` relance `startDownload` dès `!isActive` → re-DL après
   restart. Fix : si `downloadStatus === "ready"` + filePath présent → `fs.createReadStream`
   sans toucher au swarm.
3. **Tests** : M2/M3/M5/M6 réseau ne tournent ni en CI ni en soutenance offline. Séparer
   unitaires déterministes (vecteurs binaires/fixtures) vs intégration live (gated/manuels).
4. **Multi-fichiers** : `piece-store` écrit dans la vraie arborescence
   (`metadata.files[].path/offset`), pas un blob plat. Cleanup supprime le dossier.
5. **Peer-discovery sans DHT** : contenu peu seedé → 0 peer possible. Mitigation : YTS
   `.torrent` source prioritaire, magnet en repli.
6. **Bounds-checks / backpressure** : parse hors-bornes = crash = violation V.1 ; ne pas
   bufferiser tout le fichier (highWaterMark).

---

## 7. État du rework & prochaines étapes

- **Rework PAS commencé** : moteur toujours en `torrent-stream` à ce jour.
- Plan détaillé : `docs/torrent-engine-rework-plan.md` (milestones M1→M8).
- **Point de départ = M1** : bencode + parsing `.torrent` + recalcul `info_hash` validé
  contre un `.torrent` YTS réel. Socle isolé, validable en une fois.
- Sources retenues : **YTS** (`.torrent` propre + `info_hash`) + **apibay/TPB** (JSON,
  `info_hash` → magnet/BEP9). TMDb = métadonnées seules (ne compte PAS comme source).
- Coder **les deux chemins d'entrée** (.torrent + magnet/BEP9) → choix de source = détail de
  config, pas modif moteur.

### Modifs hors moteur prévues (§5 du plan)
- Prisma : ajouter `torrentFileUrl String?` au modèle `Torrent`.
- `StreamingService` : ~2 lignes (l.28, l.61) — choix de source (.torrent prioritaire,
  magnet repli) + branche disque.
- `interfaces/index.ts` : retirer champs spécifiques torrent-stream (`swarm`,
  `select`/`deselect`, `remove`).

### TODO mémoire (en suspens)
- Mettre à jour la mémoire projet pour refléter la révision du plan (6 points ajoutés) —
  pas encore fait, à décider au début de M1.

---

## Fichiers clés référencés
- `en.subject.pdf` — le sujet (racine du repo)
- `docs/torrent-engine-rework-plan.md` — plan de rework (révisé cette session)
- `backend/src/streaming/services/torrent.service.ts` — SEUL fichier prod utilisant torrent-stream
- `backend/src/streaming/streaming.service.ts` — façade consommatrice (getVideoStream/Range)
- `backend/src/streaming/interfaces/index.ts` — interfaces TorrentEngine/TorrentFile
- `backend/package.json` — deps (`torrent-stream` ^1.2.1 + `@types/torrent-stream` à retirer en M8)
