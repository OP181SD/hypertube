# Chat 1 — Contexte & décisions (Hypertube)

> Handoff de session. À relire au démarrage d'une nouvelle conversation pour reprendre le fil.
> Dates couvertes : 2026-06-04 → 2026-06-25. Branche : `develop`.

---

## 1. Ce qui a été FAIT (modifs non commitées au moment de la sauvegarde)

### a) Mise à jour des paquets
- `npm update` sur tout le monorepo (patch/minor dans les ranges). Aucune version majeure n'était en attente.
- **`@types/pg`** dé-épinglé : override root `8.11.11` → **`8.20.0`** + backend devDep `^8.20.0`. Lockfile régénéré (l'override ne se réconciliait pas en place → `rm -rf node_modules package-lock.json && npm install`).
- Après clean install : **régénérer le client Prisma** (`npm run prisma:generate`) sinon le build backend casse (client généré dans node_modules effacé).
- Vérifs : build back 0 issue TSC, build front OK, **backend 313/313 tests**, lint back 0 erreur.
- Fichiers touchés : `package.json`, `backend/package.json`, `package-lock.json`.

### b) Correction des erreurs ESLint frontend (12 erreurs → 0)
Le lint frontend **échouait déjà avant** la mise à jour (dette préexistante, règles `eslint-plugin-react-hooks` v7 / React Compiler).

Corrections (toutes vérifiées : lint 0/0, **front 96/96 tests**, build OK) :
- **Code mort supprimé** : `rating` (MovieDetailPage), import `updateUser` (ProtectedRoute.test), re-export `I18N_TO_LANG` (AuthContext — personne ne l'importait de là).
- **`err: any` → `unknown`** dans MoviePresentationWrapper (+ message fixe pour éviter un warning `exhaustive-deps`).
- **Effets « derived state » → setState en render-phase** (pattern officiel React « You Might Not Need an Effect ») : `useProfileForm` (seed form depuis user — init `seededUser` à `null` sinon jamais seedé !), `useMovies` (reset pagination sur changement de filtre), `VideoPlayer` (reset status sur changement de torrentId), `Navbar` (ouverture modale depuis `?auth`), `VerifyEmailPage` (init paresseuse du status selon token).
- **`MoviesSection`** : écriture de ref déplacée render → `useEffect`.
- **`AuthContext.test`** : `let authRef` réassigné → objet conteneur `{ current }`.
- **3 `eslint-disable` ciblés et commentés** (refus de contorsionner du code légitime) : `setLoading(true)` avant fetch (useMovies), `restoreSession()` au montage (AuthContext), capture de hook en test (AuthContext.test `react-hooks/immutability`).
- **eslint.config.js** : ajout de `coverage` aux `globalIgnores`.

### c) Commits suggérés (PAS encore commités)
```
git add package.json backend/package.json package-lock.json
git commit -m "chore(deps): update outdated packages and unpin @types/pg to 8.20.0"

git add frontend/
git commit -m "refactor(frontend): fix eslint errors, drop derived-state effects"
```
Co-Author : `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 2. DÉCOUVERTE MAJEURE — `torrent-stream` viole le sujet

**Sujet (Ch. II, p.3, vérifié dans `en.subject.pdf`)** :
> « All frameworks, libraries, etc. are allowed, **except for those that are used to create a video stream from a torrent**. […] libraries such as **webtorrent, pulsar and peerflix are not permitted.** »

- `torrent-stream` = « Torrent streaming engine for Node.js », et **`peerflix` (banni) est bâti dessus** → il est en plein dans la catégorie interdite.
- Règles éliminatoires (p.9) : « Anything not specifically authorized is forbidden » → **risque de 0 à la défense**.
- **L'étape 3 (streaming) est donc NON CONFORME** et doit être réécrite : client BitTorrent **maison**.

### Lien avec la sécurité (vuln npm audit)
- Les **5 vulns high** de `npm audit` viennent toutes du paquet **`ip`** (CVE-2024-29415, SSRF), tiré uniquement par `torrent-stream` (`→ torrent-discovery → bittorrent-tracker → ip`, + `ip-set → ip`).
- **Aucune version patchée de `ip` n'existe** (advisory couvre ≤2.0.1, "Patched: None"). Override impossible.
- Tout l'écosystème BitTorrent JS le tire (même `webtorrent`, `bittorrent-tracker@11`). `npm audit fix --force` downgrade torrent-stream → pire.
- Exploitabilité réelle ici **faible** (`ip` classe les IP des peers, pas une garde SSRF sur input user).
- **Le seul vrai fix = supprimer torrent-stream** (ce qu'on doit faire pour le sujet de toute façon). Le client maison n'a pas besoin de `ip` → vulns disparaissent.

---

## 3. DISCUSSIONS / arbitrages tranchés

### ESLint vs Biome (vérifié via web, juin 2026)
- **Correction d'une info périmée** : Biome v2 « Biotype » (juin 2025) a **le lint type-aware sans tsc** + plugins (GritQL) + monorepo. v2.3 (jan 2026) = 491 règles.
- Reste à ESLint : ~15% de couverture type-aware en plus, règles React Compiler (les `set-state-in-effect` qui bloquaient), écosystème de plugins mature.
- **Prettier ne fait AUCUN travail de qualité** (cosmétique). Le formateur Biome est ~97% compatible.
- **« Sécurité » ≠ linter** : vraie sécu = SAST (Semgrep/CodeQL) + scan deps (Dependabot/Snyk) + scan secrets. Pas le choix ESLint/Biome.
- **Décision** : rester sur **ESLint type-aware** (qualité max pour projet noté). Biome = ~90% de la qualité, gagne sur vitesse/simplicité.

### Go (ou autre langage) pour le torrent ?
- **Non.** Le dur c'est le protocole BitTorrent (~1500 l, identique en tout langage). La lib Go mature `anacrolix/torrent` est **aussi bannie**.
- Coût caché énorme : 2e runtime, frontière inter-process qui casse le `createReadStream` progressif, Docker plus complexe, plus dur à démontrer.
- Node est adapté (I/O-bound ; SHA1 négligeable). **Rester en TypeScript, in-process.**
- **Ne pas réécrire les autres parties** (auth/movies/comments) — elles marchent et sont testées.

### Pourquoi torrent-stream partout sur GitHub ?
- « Répandu » ≠ « conforme ». La plupart ne sont pas des rendus 42 évalués, ou ont pris le raccourci non conforme (parfois passé avec correcteur indulgent). Le sujet est explicite ; miser sur l'indulgence = parier sa note entière.

---

## 4. PLAN MVP du client BitTorrent maison

**Principe directeur : garder l'API publique de `TorrentService` IDENTIQUE**, ne remplacer que les entrailles. → `StreamingService`, controller, transcoding, sous-titres, cleanup, frontend **ne bougent pas**.

### Contrat à préserver (`backend/src/streaming/services/torrent.service.ts`)
`startDownload(magnetUrl, torrentId)`, `isActive(id)`, `getProgress(id): DownloadProgress`, `getFile(id): TorrentFile | null` (avec `{name, path, length, createReadStream({start,end}), select(), deselect()}`), `destroyEngine(id)`, `onModuleDestroy()`.
Point névralgique : **`createReadStream({start,end})` doit marcher AVANT la fin du DL** (priorité aux pièces de la plage + émission au fur et à mesure de la vérif SHA1).

### Arborescence cible `backend/src/streaming/torrent/`
```
bencode.ts          ~140  décode + slice brut de `info` (→ SHA1 = info_hash)
metainfo.ts         ~130  .torrent → {infoHash, pieceLength, pieceHashes[], files[], totalLength, trackers[]}
udp-tracker.ts      ~180  connect+announce UDP (BEP 15), peers compacts
message.ts          ~200  codec wire (handshake, bitfield, have, request, piece, choke/unchoke, interested)
peer-connection.ts  ~300  socket TCP/peer, handshake, états, requêtes blocs 16 KiB, timeout
piece-manager.ts    ~220  picker séquentiel, assemblage blocs→pièce, vérif SHA1, bitfield
storage.ts          ~160  mapping offsets fichier sélectionné, write pièce, read plage
torrent-engine.ts   ~280  orchestration + progress + buffer "ready" + createReadStream
types.ts            ~90
```
`torrent.service.ts` réécrit en **manager fin** (~120 l). Total ~1500-1800 l prod + ~1200 l tests ; supprimé ~450 l.

### Décisions MVP figées
- Métadonnées via **`.torrent`** (info dict) → **pas de BEP 9**. ⚠️ voir note §6 (la direction a évolué vers « coder aussi le chemin magnet/BEP9 »).
- Peers via **UDP tracker** uniquement (interface abstraite → HTTP tracker ~80 l en drop-in si UDP bloqué).
- Picker **strictement séquentiel** (simple + idéal streaming).
- 1 seul fichier vidéo (le plus gros).
- « Ready » pour le player après un **buffer initial vérifié** (~3-5 Mo) — « enough data for seamless watching ».
- **Exclus** : DHT, rarest-first, endgame, multi-fichiers vidéo.

### Ordre de dev (M1→M8, chaque étape vérifiable)
1. bencode + metainfo → 🎯 info_hash recalculé == `hash` en DB
2. udp-tracker → 🎯 logguer N peers réels
3. handshake + bitfield + message codec → 🎯 lire la bitfield d'1 peer
4. request/receive 1 bloc→pièce + SHA1 → 🎯 1re pièce vérifiée
5. piece-manager séquentiel + storage → 🎯 petit fichier complet, hash OK, lisible VLC
6. torrent-engine + createReadStream + buffer ready → branchement TorrentService → 🎯 film qui stream pendant le DL
7. durcissement : pool ~20-40 peers, timeout/reconnexion, re-announce, **clamp index/offsets reçus** (peers non fiables = sécu)
8. suppression torrent-stream + `@types/torrent-stream`, suite verte, **0 erreur console**

### Checklist soutenance (éliminatoire)
DL background non-bloquant ✅ · stream pendant DL ✅ · mkv converti (transcoding existant) ✅ · sauvegarde + suppression à 1 mois (cleanup existant) ✅ · sous-titres ✅ · 0 erreur/warning console ✅ · sécu (clamp inputs peers, plafond mémoire blocs en vol, rejet messages surdimensionnés) ✅

### Risques
- **UDP bloqué sur réseau école** → tester sur réseau de défense **jour 1** ; HTTP tracker en drop-in.
- moov atom en fin de mp4 → géré par priorité sur plage demandée ; mkv passe par ffmpeg séquentiel.
- Peu de peers sur film obscur → démo avec films **populaires**.

---

## 5. PROVIDERS (partie en cours au moment de la sauvegarde)

### Architecture actuelle (movies module)
- `YtsService` : YTS (films, propre, `imdb_code`, `torrent.url` = lien `.torrent`). Source principale.
- `EztvService` : EZTV — **séries TV uniquement + HS chez l'utilisateur** → à remplacer.
- `MovieCacheService.cacheYtsMovies()` / `cacheEztvTorrents()` : upsert Movie + Torrent. `buildMagnetUrl()` construit le magnet depuis hash + `YTS_TRACKERS`.
- `MoviesService.search()` : `Promise.all([yts, eztv])` puis cache, puis query DB.
- Modèle Prisma `Torrent` : a `hash` (unique), `magnetUrl`, `filePath`, `downloadStatus`, `lastAccessedAt`. **PAS de `torrentFileUrl`** (à ajouter).
- Config : `YTS_BASE_URL`, `EZTV_BASE_URL` (Joi + `.env` + `.env.example`).

### Décision providers (⚠️ A ÉVOLUÉ — voir §6)
- **Pendant le chat** : acté **YTS direct + Jackett** (agrégateur Torznab ; query par `t=movie&imdbid=` = matching propre ; choisir indexeurs servant des `.torrent` → moteur MVP simple).
- Clarification importante : YTS = source de contenu ; Jackett/Prowlarr = **agrégateurs** (un seul, pas les deux). YTS reste en direct + 1 agrégateur.

### Plan d'implémentation providers (était sur le point de démarrer)
1. **Schema** : ajouter `torrentFileUrl String?` à `Torrent` + migration. Peupler pour YTS depuis `torrent.url`.
2. **Config** : ajouter `JACKETT_BASE_URL` + `JACKETT_API_KEY` (placeholder), retirer `EZTV_*`. Joi + `.env` + `.env.example`.
3. **Dép** : `fast-xml-parser` (Torznab = XML ; utilitaire, conforme).
4. **Interfaces** : types Jackett, retirer types EZTV.
5. **JackettService** (nouveau, remplace EztvService) : query Torznab, parse XML (title, enclosure `.torrent`, attrs `magneturl`/`infohash`/`seeders`/`peers`/`imdbid`, size).
6. **MovieCacheService** : `cacheJackettTorrents()` (mirror EZTV : upsert movie par imdbid, torrent source "JACKETT"), + peupler `torrentFileUrl` côté YTS. Retirer `cacheEztvTorrents`.
7. **movies.service.ts + module** : swap eztv → jackett.
8. **docker-compose.yml** : ajouter service `jackett` (image `linuxserver/jackett`).
9. **Tests** : spec JackettService (XML mocké), maj cache/service specs, retirer eztv spec.
10. Build + tests.

**Manuel côté user** : lancer Jackett, ajouter indexeurs + récupérer l'API key (UI Jackett). Code testable sans Jackett vivant (XML mocké).

**Le moteur torrent reste agnostique du provider** → on peut finaliser/changer le provider **après** sans toucher au moteur. Le seul couplage = le mapper qui extrait hash/magnet/.torrent par source.

---

## 6. ⚠️ ÉVOLUTION DE DIRECTION (mémoire mise à jour après le chat)

La mémoire projet (`MEMORY.md`) a été mise à jour avec une **direction révisée** — à prendre comme la plus récente :
- Préférence passée de **Jackett → YTS + apibay/TPB** (apibay = **zéro service à héberger** → plus robuste en soutenance ; coût = implémenter **BEP9** ~150-200 l).
- Plan B = YTS + **Prowlarr** (pas Jackett) sur indexeurs `.torrent`.
- **Décision actée** : coder **les DEUX chemins d'entrée** (`.torrent` ET magnet/BEP9) pour rendre le choix de source **différable**.
- Conséquence sur le plan MVP §4 : BEP9 n'est plus forcément exclu (selon source). Voir `docs/torrent-engine-rework-plan.md` + memory `torrent-engine-rework-plan.md` pour le plan M1→M8 détaillé.
- TMDb = **métadonnées seules**, ne compte PAS comme une des 2 sources.
- État réel : **moteur toujours en torrent-stream** (rework pas commencé).

---

## 7. Mémoire projet (fichiers persistants)
- `MEMORY.md` — index + overview + statut des étapes
- `security-npm-audit-ip.md` — détail vuln `ip`
- `torrent-engine-rework-plan.md` — plan M1→M8 (+ copie repo `docs/`)
- `anti-duplication-checklist.md`, `technical-notes.md`, `runtime-node-24.md`

## 8. Prochaines étapes (ordre proposé)
1. (optionnel) Commiter le travail deps + lint (cf. §1c).
2. **Finir les providers** (§5/§6) — décider d'abord source #2 : apibay/TPB (reco mémoire) vs Jackett/Prowlarr.
3. Stabiliser les **bugs streaming** (à lister) — trier « keep » (corriger) vs « replace » (le moteur les règle).
4. **Rework moteur torrent** maison (§4, M1→M8).

> NB : préférence utilisateur observée — décisif, veut comprendre les trade-offs en profondeur, tient à la conformité stricte du sujet et à la qualité/sécurité. Répondre en français.
