# Contexte de chat — Hypertube (handoff session)

> Dump du contexte de la conversation pour pouvoir reprendre dans une nouvelle session.
> Date : 2026-06 (develop branch). Le plan détaillé vit dans
> `docs/torrent-engine-rework-plan.md` (source de vérité, ce fichier-ci est le résumé du chat).

---

## 1. Sujet des questions posées

L'échange a porté sur les **sources de torrents** et la **conformité au sujet 42 Hypertube**,
puis sur le **plan de rework du moteur BitTorrent** et le **coût de BEP9**. Conclusions ci-dessous.

---

## 2. Ce que le sujet exige (vérifié dans `en.subject.pdf`)

- **Chap. I (p.2)** : *"the research engine will query **at least two external sources** of your choice"*
  + *"the videos will be downloaded using the **BitTorrent protocol**"*.
- **III.2.1 Search (p.5)** : *"query **at least two external sources** (of your choice) that
  **exclusively provide video content**"*.
- **Ch. II (p.3)** : interdiction de **toute lib qui crée le stream vidéo depuis un torrent**
  (webtorrent, pulsar, peerflix cités). → `torrent-stream` tombe dedans = **risque éliminatoire**.
- **V.1 Eliminatory rules (p.9)** : aucune erreur/warning serveur ou client ; « anything not
  specifically authorized is forbidden » ; faille de sécu = 0.
- **III.3 Video Part (p.6)** : film entièrement téléchargé = **sauvé sur le serveur, pas de
  re-download** ; supprimé si non regardé pendant 1 mois ; sous-titres EN ; transcodage à la
  volée si pas lisible nativement (mkv minimum).

**Points clés tranchés :**
- « au moins deux » = minimum, pas exactement deux.
- Le sujet dit **« sources »**, pas « indexeurs ». Le mot indexeur n'apparaît pas.
- **TMDb ne compte PAS** comme une des 2 sources (c'est de la métadonnée, pas du contenu vidéo/torrent).
- magnet / DHT / BEP9 / `.torrent` ne sont **PAS** exigés — ce sont des moyens techniques.

---

## 3. Notions clarifiées

- **Indexeur** = catalogue de torrents qu'on interroge (titre, qualité, seeders, lien
  `.torrent`/magnet). Ex : YTS, 1337x, EZTV. Il ne stocke ni ne télécharge le film.
- **Jackett / Prowlarr** = **agrégateurs** (méta-indexeurs) : interrogent ~100 indexeurs et
  exposent une API uniforme (Torznab). Pas de catalogue propre.
- **YTS** = un **indexeur** (films only), interrogé en direct via son API
  (`yts.mx/api/v2/...`). Renvoie par torrent : `url` (vrai `.torrent`) **et** `hash`
  (`info_hash`). → source `.torrent` propre, **pas besoin de BEP9** de son côté.
- **apibay** = API JSON de The Pirate Bay (`apibay.org/q.php?q=...`), **aucun service à
  héberger**, renvoie l'`info_hash` (→ magnet only). Très fiable.

---

## 4. Décision sources (a évolué pendant le chat)

- **Avant** (ancienne mémoire) : YTS + **Jackett**.
- **Maintenant — recommandé** : **YTS** (`.torrent`) **+ apibay/TPB** (magnet/BEP9).
  Raison : apibay = zéro service à héberger → **plus robuste en soutenance** qu'un agrégateur
  à babysitter (indexeurs publics qui meurent/captcha le jour J). Coût = BEP9 (~150-200 lignes).
- **Plan B** : YTS + **Prowlarr** (PAS Jackett — Prowlarr mieux maintenu) réglé sur des
  indexeurs servant un `.torrent` → évite BEP9 mais service fragile à maintenir.
- **Décision actée** : **coder les DEUX chemins d'entrée** (`.torrent` + magnet/BEP9) pour
  rendre le choix de source différable (changer de source = config, pas modif moteur).

---

## 5. Coût de BEP9 (analysé sur le code réel)

- ⚠️ **Le moteur hand-rollé n'existe pas encore** : `torrent.service.ts` utilise TOUJOURS
  `torrent-stream` (lib bannie). Le rework Step 3 n'est **pas commencé**.
- Le gros du coût = **le moteur lui-même** (~80% : bencode, tracker HTTP+UDP, peer wire,
  piece picker, store+SHA1, streaming progressif). Obligatoire quoi qu'il arrive.
- **BEP9 = ~150-200 lignes** d'incrément SI la couche peer-wire existe déjà :
  - BEP10 extended handshake (~50-80 L) — bit `0x10` dans le handshake.
  - ut_metadata request/data + réassemblage + **vérif SHA1(info)==infoHash** (~80-120 L).
- **Éviter la DHT** : on source les peers via **trackers publics collés au magnet** (pas de
  Kademlia/BEP5, qui ferait +400-700 L). apibay donne l'info_hash → magnet + trackers publics
  → announce → peers → BEP9 → métadonnées → pipeline normal.
- Le moteur est **source-agnostique** : les 2 chemins convergent vers un type
  `TorrentMetadata` unique ; tout l'aval est identique. Le rework est donc **le même** quelles
  que soient les sources.

---

## 6. Plan de rework — milestones (détail complet dans `docs/torrent-engine-rework-plan.md`)

Surface à préserver (6 méthodes de `TorrentService` : `isActive`, `startDownload(source,id)`,
`getProgress`, `getFile`, `destroyEngine`, `onModuleDestroy`). `StreamingService` /
`StreamingController` ne changent quasi pas.

Structure cible : `src/streaming/torrent/` (bencode, metadata/{from-torrent-file,from-magnet},
tracker/{http,udp}, peer/{peer-connection,messages,extension}, piece/{piece-picker,piece-store},
torrent-download.ts). `torrent.service.ts` = façade `Map<id, TorrentDownload>` + logique Prisma
existante.

- **M1** — bencode + `from-torrent-file` → recalcul `info_hash` validé contre `.torrent` YTS.
  Gotcha : `info_hash` = SHA1 des **bytes exacts** du dict `info` (exposer le slice brut, pas ré-encoder).
- **M2** — tracker HTTP puis UDP → liste de peers. Prévoir re-announce périodique (`interval`).
- **M3** — peer wire : handshake (bit ext `0x10`) + bitfield. Bounds-check systématique sur tout
  Buffer venant d'un peer (sinon crash = violation V.1).
- **M4** — download piece 0 + vérif SHA1 + disque. Machine à états choke/unchoke + interested
  OBLIGATOIRE (interested → unchoke → request), sinon stall à 0 piece.
- **M5** — picker séquentiel + download complet + **service disque** (servir un film `ready`
  depuis `fs.createReadStream` sans relancer le swarm — corrige un bug de re-download existant).
  Layout multi-fichiers réel ; cleanup supprime le **dossier** du torrent.
- **M6** — streaming progressif : `createReadStream({start,end})` qui attend + priorise les pieces.
- **M7** — BEP9/magnet (`extension.ts` + `from-magnet.ts`), réutilise M3, pas de DHT. Réinjecte
  dans M5/M6 inchangés. ~150-200 L isolées.
- **M8** — bascule + **retrait de `torrent-stream`** + `@types/torrent-stream` (clôt aussi les
  5 vulns `ip` CVE-2024-29415) + adapter les `*.spec.ts`.

Chemin critique conforme atteint dès **M6**. M7 isolé. M8 = nettoyage.

---

## 7. Modifs hors moteur

- **Prisma** : ajouter `torrentFileUrl String?` au modèle `Torrent`. `startDownload` reçoit une
  `source` = `{ kind: "file", url }` (préférée) **ou** `{ kind: "magnet", uri }`.
- **`StreamingService`** : ~2 lignes (l.28 et l.61) — choisir la source (`.torrent` prioritaire,
  magnet en repli). Reste inchangé.
- **`interfaces/index.ts`** : garder `DownloadProgress`/`TorrentFile`, retirer les champs
  spécifiques torrent-stream (`swarm`, `select`/`deselect` → internes au picker).

---

## 8. État au moment de la fermeture du chat

- On était sur le point de **démarrer M1**. J'inspectais les conventions du projet :
  - **tsconfig** : CommonJS, target ES2024, `strict` true, decorators activés.
  - **Tests** : **Vitest**. `npm test` = `vitest run`. Specs unitaires = `src/**/*.spec.ts`
    (config `vitest.config.ts`, plugin swc, alias `@`→src, `@test`→test). E2E = `*.e2e-spec.ts`
    (`vitest.config.e2e.ts`, `fileParallelism:false`).
  - **HTTP externe** : `fetch` natif (built-in), pas d'axios.
  - Lecture du `YtsService` **rejetée par l'utilisateur** juste avant la fin (pour cause de
    fermeture du chat) — à relire au redémarrage : `find src -iname "*yts*"`.
- **Rien n'a été codé.** Aucun fichier moteur créé. `torrent-stream` toujours en place.

## 9. Prochaine action au redémarrage

Reprendre **M1** :
1. Relire le `YtsService` pour confirmer la forme de `url`/`hash` exposés.
2. Créer `src/streaming/torrent/bencode.ts` (décodeur avec slice brut du dict `info`) +
   `src/streaming/torrent/metadata/{torrent-metadata.ts, from-torrent-file.ts}`.
3. Test : parser un `.torrent` YTS réel, recalculer l'`info_hash`, vérifier == `hash` API.

---

## 10. Fichiers de référence

- `docs/torrent-engine-rework-plan.md` — plan complet (source de vérité).
- `en.subject.pdf` — le sujet (racine repo).
- Mémoire projet : `~/.claude/projects/-Users-jeremycointre-hypertube/memory/`
  (`MEMORY.md`, `torrent-engine-rework-plan.md`, `security-npm-audit-ip.md`).
- Code moteur actuel (à remplacer) : `backend/src/streaming/services/torrent.service.ts`.
- Consommateurs façade : `backend/src/streaming/streaming.service.ts` + `streaming.controller.ts`.
