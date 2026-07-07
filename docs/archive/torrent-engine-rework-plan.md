# Plan de rework du moteur BitTorrent

> Contexte : le code actuel (`backend/src/streaming/services/torrent.service.ts`) utilise
> encore `torrent-stream`, une lib **bannie** par le sujet (Ch. II p.3 : aucune lib
> « used to create a video stream from a torrent »). Risque éliminatoire → il faut
> hand-roller le client BitTorrent. Ce plan reconstruit le moteur en gardant la façade
> NestJS, et inclut **les deux chemins d'entrée** (`.torrent` + magnet/BEP9) pour pouvoir
> changer de source plus tard sans retoucher le moteur.

## Rappel décision sources

- Sujet : « BitTorrent protocol » + **au moins 2 sources externes** de contenu vidéo.
  Rien sur magnet/`.torrent`/DHT/BEP9 → ce sont des moyens, pas des exigences.
- Sources retenues : **YTS** (`.torrent` propre + `info_hash`, films) + **apibay/TPB**
  (JSON, `info_hash` only → magnet). TMDb = métadonnées, ne compte PAS comme source.
- Plan B sources : YTS + **Prowlarr** (pas Jackett — mieux maintenu) réglé sur des
  indexeurs servant un `.torrent` (évite BEP9, mais service à babysitter en soutenance).
- On code **les deux chemins** quoi qu'il arrive : le choix de source devient un détail
  de config, pas une modif moteur.

---

## 0. Principe directeur : préserver la surface

`StreamingService` + `StreamingController` ne consomment que **6 points de contact** de
`TorrentService`. On les fige comme contrat, on reconstruit tout derrière.

| Méthode | Attendu du consommateur |
|---|---|
| `isActive(id): boolean` | un download tourne-t-il |
| `startDownload(source, id): Promise<void>` | démarre — **source = .torrent URL *ou* magnet** |
| `getProgress(id): DownloadProgress` | `{ status, progress, filePath, fileSize }` |
| `getFile(id): TorrentFile \| null` | objet avec `name`, `length`, `createReadStream({start,end})` |
| `destroyEngine(id)` / `onModuleDestroy()` | nettoyage |

⚠️ Point critique : `file.createReadStream({start,end})` doit rendre un `Readable` qui
**attend les pieces manquantes et les priorise** (ce que torrent-stream faisait en
interne). C'est le piège n°1 du streaming progressif.

⚠️ Conformité disque : le sujet exige qu'un film **entièrement téléchargé soit servi
depuis le disque sans re-télécharger** (« *saved on the server to avoid re-downloading* »).
Aujourd'hui `torrent.service.ts` relance `startDownload` dès que `!isActive` → après un
restart, un film complet est **re-téléchargé** (bug existant). Le rework doit ajouter une
branche : si `Torrent.downloadStatus === "ready"` et `filePath` présent sur disque →
servir via `node:fs.createReadStream` **sans toucher au swarm**. Voir M5/§5.

---

## 1. Nouvelle structure de fichiers

```
src/streaming/
├── services/
│   └── torrent.service.ts        ← REÉCRIT : façade fine (Map<id, TorrentDownload>)
└── torrent/                      ← NOUVEAU : moteur hand-rollé, framework-agnostic
    ├── bencode.ts                 décode/encode + slice des bytes bruts du dict info
    ├── metadata/
    │   ├── torrent-metadata.ts    type unifié TorrentMetadata (sortie des 2 chemins)
    │   ├── from-torrent-file.ts    .torrent (YTS) → TorrentMetadata
    │   └── from-magnet.ts          magnet (apibay) → BEP10+BEP9 → TorrentMetadata
    ├── tracker/
    │   ├── http-tracker.ts        announce HTTP (BEP3)
    │   └── udp-tracker.ts         announce UDP (BEP15)
    ├── peer/
    │   ├── peer-connection.ts     socket TCP, handshake, framing des messages
    │   ├── messages.ts            encode/decode des messages du wire protocol
    │   └── extension.ts           BEP10 extended handshake + ut_metadata (BEP9)
    ├── piece/
    │   ├── piece-picker.ts        sélection séquentielle (streaming) + état in-flight
    │   └── piece-store.ts         écriture disque par offset, vérif SHA1, byte-range reader
    └── torrent-download.ts        orchestrateur d'UN download (= l'ex-"engine")
```

`torrent-download.ts` = équivalent d'un « engine » torrent-stream (pilote tracker →
peers → pieces → disque pour un torrent). `torrent.service.ts` devient une simple `Map`
de ces objets + la logique Prisma déjà écrite (conservée telle quelle).

---

## 2. Contrat interne unifié (pivot source-agnostique)

Tout converge vers **un seul type**, produit indifféremment par `.torrent` ou magnet :

```ts
interface TorrentMetadata {
  infoHash: Buffer;          // 20 bytes (SHA1)
  name: string;
  pieceLength: number;
  pieces: Buffer[];          // hash SHA1 (20 bytes) par piece
  files: { path: string; length: number; offset: number }[];
  totalLength: number;
  trackers: string[];        // .torrent: announce-list / magnet: tr= + trackers publics
}
```

Une fois `TorrentMetadata` obtenu, **le moteur ne sait plus d'où ça vient.**

---

## 3. Milestones — chacun testable seul

Ordre pensé pour un bout-en-bout au plus tôt (chemin `.torrent`/YTS d'abord), puis greffe
BEP9 sans rien casser.

- **M1 — Bencode + métadonnées `.torrent`**
  `bencode.ts` + `from-torrent-file.ts`. Test : parser un vrai `.torrent` YTS, recalculer
  l'`info_hash`, vérifier qu'il matche le `hash` de l'API.
  ⚠️ gotcha : `info_hash` = SHA1 des **bytes exacts** du dict `info` → le décodeur doit
  exposer l'offset/slice brut du sous-dict, pas ré-encoder.

- **M2 — Tracker client → liste de peers**
  `http-tracker.ts` puis `udp-tracker.ts`. Test : announce sur trackers publics avec un
  `info_hash` connu → liste `{ip,port}` non vide.
  ⚠️ prévoir le **re-announce périodique** (respecter l'`interval` renvoyé par le tracker) :
  sur un download long la liste de peers s'épuise sans ré-announce.

- **M3 — Peer wire : handshake + bitfield**
  `peer-connection.ts` + `messages.ts`. **Handshake avec bit d'extension `0x10` activé dès
  maintenant** (gratuit, prérequis BEP9). Test : se connecter à un peer réel, compléter le
  handshake, recevoir son bitfield.
  ⚠️ bounds-check **systématique** sur tout `Buffer` venant d'un peer (longueur de message,
  index/offset des messages) — données non fiables ; un parse hors-bornes = crash =
  violation éliminatoire V.1 (« aucune erreur côté serveur »).

- **M4 — Download d'une piece + vérif SHA1 + disque**
  `piece-store.ts` + boucle request/piece (blocs 16 KiB). Test : télécharger la piece 0,
  vérifier SHA1 == `metadata.pieces[0]`, écrite au bon offset.
  ⚠️ machine à états **choke/unchoke + interested** obligatoire : un peer n'envoie **rien**
  tant qu'on n'a pas émis `interested` ET reçu `unchoke`. Séquence : `interested` →
  attendre `unchoke` → `request`. C'est l'endroit où la plupart des clients hand-roll
  stallent à 0 piece avec des peers pourtant connectés.

- **M5 — Picker séquentiel + download complet + service disque**
  `piece-picker.ts` (séquentiel biaisé streaming) + `torrent-download.ts` orchestre.
  Test : télécharger un petit torrent en entier, fichier identique au référent.
  ⚠️ **layout multi-fichiers** : `piece-store` écrit dans la **vraie arborescence**
  (`metadata.files[].path/offset`), pas un blob plat → `DownloadProgress.filePath` pointe un
  fichier vidéo **jouable**. Le cron de cleanup doit alors supprimer le **dossier** du
  torrent (pas un seul `filePath`).
  ⚠️ à `idle`/complétion → marquer `ready` (déjà fait) **et** câbler la branche « servir
  depuis le disque » (`fs.createReadStream`, voir §0) pour les accès ultérieurs.

- **M6 — Streaming progressif (contrat critique)**
  `piece-store.createReadStream({start,end})` : traduit byte-range → range de pieces,
  **priorise ces pieces dans le picker**, émet les bytes au fur et à mesure.
  Test : `<video>` qui lit pendant le download (seek inclus).

- **M7 — Branchement BEP9 (magnet)** ← *l'incrément, ~150-200 lignes*
  `extension.ts` (BEP10 extended handshake + ut_metadata) + `from-magnet.ts`. Réutilise
  **entièrement** M3 (peers via trackers publics collés au magnet → **pas de DHT**).
  Test : partir d'un `info_hash` apibay, reconstruire `TorrentMetadata`, vérifier
  SHA1(info)==infoHash, puis **réinjecter dans M5/M6 inchangés**.

- **M8 — Bascule + suppression de `torrent-stream`**
  `torrent.service.ts` câble la `Map` sur `torrent-download`, retirer `torrent-stream` +
  `@types/torrent-stream` du `package.json` (→ clôt les 5 vulns `ip`). Adapter les
  `*.spec.ts` du module streaming.

→ **Chemin critique conforme atteint dès M6 (chemin `.torrent`/YTS).** Une 2ᵉ source
**magnet-only** (apibay) n'est *streamable* qu'après M7 — l'exigence « ≥2 sources » est
satisfaite au niveau **recherche** (déjà en place), mais la 2ᵉ source **lisible** dépend de
M7. M7 (BEP9) isolé, ne touche aucun code aval. M8 = nettoyage.

### Stratégie de test (importante)

Séparer strictement deux catégories, car les milestones réseau ne tournent **ni en CI ni en
soutenance offline** :

- **Unitaires déterministes** (le gros, tournent partout) : bencode (round-trip + slice brut
  `info`), encode/decode des messages wire, réponse UDP announce (BEP15), réassemblage
  ut_metadata + SHA1 — tous sur **vecteurs binaires enregistrés** (fixtures), zéro réseau.
- **Intégration live** (manuels / gated derrière un flag env) : M2 announce réel, M3 peer
  réel, M5/M6 download+stream bout-en-bout. Ne jamais les mettre dans la suite par défaut
  (flakiness + règle V.1 « aucune erreur »).

---

## 4. Dépendances

- **Autorisé** (utilitaires, pas du « stream-from-torrent ») : `node:net`, `node:dgram`,
  `node:crypto` (SHA1), `node:stream` (built-in). Bencode : recommandé de le hand-roller
  (~100 lignes) pour maîtriser le slice brut de l'`info` dict (gotcha M1).
- **À retirer (M8)** : `torrent-stream`, `@types/torrent-stream`.
- **Interdit, ne jamais réintroduire** : webtorrent, peerflix, pulsar, combo
  parse-torrent + download « clé en main ».

---

## 5. Modifs hors moteur (minimes)

- **Prisma** : ajouter `torrentFileUrl String?` au modèle `Torrent`. `startDownload` reçoit
  une `source` = `{ kind: "file", url }` (préférée si dispo) **ou** `{ kind: "magnet", uri }`.
- **`StreamingService`** : 2 lignes (l.28 et l.61) — remplacer
  `startDownload(torrent.magnetUrl, …)` par le choix de source (`.torrent` prioritaire,
  magnet en repli). Le reste inchangé.
- **`interfaces/index.ts`** : garder `DownloadProgress` / `TorrentFile`, retirer les champs
  spécifiques torrent-stream (`swarm`, `select`/`deselect` deviennent internes au picker,
  `remove(keepPieces)` typé mais jamais appelé → supprimé).
- **Service disque (conformité « pas de re-download »)** : dans `StreamingService` (ou la
  façade `torrent.service`), brancher avant tout `startDownload` : si `downloadStatus ===
  "ready"` + fichier présent → `node:fs.createReadStream(filePath, {start,end})`. Le contrat
  `getVideoStream` (Range/206) est identique, seule la **source** du `Readable` change
  (disque au lieu du picker). Aucune lib — built-in `node:fs`.
- **Cleanup cron** : supprimer le **dossier** du torrent (multi-fichiers), pas un seul
  `filePath`.

---

## 6. Risques & points durs (par ordre de douleur)

1. **`createReadStream` qui attend + priorise** (M6) — cœur du streaming. À designer avec
   le picker dès M5. Respecter le **backpressure** (highWaterMark) : ne jamais bufferiser
   tout le fichier, sinon OOM sur les gros films.
2. **Slice brut du dict `info`** (M1) — mauvais ré-encodage = `info_hash` faux = 0 peer.
   Tester en premier.
3. **Machine à états choke/unchoke + interested** (M4) — oubli classique = 0 piece malgré
   des peers connectés. À implémenter avant la boucle de request.
4. **UDP tracker (BEP15)** (M2) et **réassemblage ut_metadata + SHA1** (M7) — protocoles
   binaires, tester en isolation avec vecteurs réels.
5. **Peers muets / sans ut_metadata** — timeouts + plusieurs peers en parallèle dès M3.
6. **Bounds-checks sur Buffers non fiables** (peers + trackers) — un parse hors-bornes
   crashe le serveur = violation éliminatoire V.1. Valider longueur/index avant tout read.
7. **Peer-discovery sans DHT pour sources magnet-only** (apibay) — un contenu peu seedé peut
   donner **0 peer** (pas de fallback DHT, choix assumé). Mitigation : garder YTS `.torrent`
   en source **prioritaire**, magnet en repli ; sélectionner du contenu bien seedé.

---

## 7. Estimation

- M1→M6 (moteur conforme, chemin `.torrent`) : le gros, ~80% de l'effort.
- M7 (BEP9/magnet) : ~150-200 lignes, isolé.
- M8 (bascule + cleanup + specs) : faible.

---

## Suite

Démarrer par **M1** (bencode + parsing `.torrent` + recalcul `info_hash`) : socle isolé,
validable en une fois contre un `.torrent` YTS réel.
