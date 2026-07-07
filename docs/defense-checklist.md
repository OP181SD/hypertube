# Checklist soutenance — console & navigateurs

> Règle éliminatoire V.1 : **aucune erreur, warning ou notice** côté serveur **ni** console client.
> À exécuter manuellement avant la défense.

---

## 1. Console navigateur (Chrome + Firefox)

### Procédure

1. Ouvrir DevTools → onglet **Console**
2. Cocher « Hide network » si disponible, mais surveiller aussi l'onglet **Network** (filtre rouge = 4xx/5xx)
3. Parcourir chaque écran ci-dessous
4. Vérifier : **0 error**, **0 warning** (idéalement 0 notice aussi)

### Parcours à tester

| Écran | Actions | Points de vigilance |
|---|---|---|
| **Landing / auth** | Login, register, OAuth | Pas d'erreur CORS, pas de 401 inutile loggé en rouge |
| **Dashboard films** | Scroll infini, filtres, recherche | Posters : pas de 404 répétés (composant `PosterImage`) |
| **Dashboard séries** | Changer d'onglet, scroll | Même chose |
| **Hero carousel** | Laisser tourner 2–3 slides | Images backdrop : fallback gris silencieux si manquantes |
| **Watchlist** | Ouvrir, retirer un film | Posters via `PosterImage` |
| **Fiche preview** | Film sans poster TMDb si possible | Header gris ou image ; pas d'erreur `url(undefined)` |
| **Lecture vidéo** | Lancer un film, seek, sous-titres | Erreurs stream = 202/503 attendus, pas de crash JS |
| **Profil** | Modifier infos, upload avatar | Avatar : fallback Dicebear si upload cassé |
| **Profil autre user** | `/users/:id` | URL avatar résolue via `resolveMediaUrl` |
| **Logout** | Depuis chaque section | Pas de state stale |

### Garde-fous implémentés dans le code

| Composant | Rôle |
|---|---|
| `PosterImage` | Pas de `<img>` si `src` null ; `onError` → placeholder local |
| `PosterImage placeholder="silent"` | Hero / backdrop : bloc gris sans requête supplémentaire |
| `AvatarImage` | `onError` → avatar Dicebear déterministe |
| `movie-mapper` | `normalizeUrl()` : chaînes vides → `null` |
| `movie-cache` (YTS) | `medium_cover_image` vide → `null` en DB |
| `movie-query` | Filtre `posterUrl` null/vide hors recherche ciblée |

### Si une 404 image apparaît encore

- C'est une URL **non vide en DB** mais **invalide chez TMDb** → une seule 404 puis fallback `onError`
- En soutenance : privilégier des films **populaires YTS/TMDb** avec posters connus
- Option : vider le cache DB des entrées avec URLs suspectes avant la démo

---

## 2. Console serveur

```bash
# Lancer le backend en foreground et surveiller les logs
npm run dev:back
```

| Attendu | Non attendu |
|---|---|
| Logs INFO/DEBUG métier | Stack traces non gérées |
| WARN métier explicites (API externe down) | Erreurs Prisma, uncaughtException |
| 4xx silencieux (filter ne log pas les erreurs client) | 500 sur parcours nominal |

Le `AllExceptionsFilter` ne log les erreurs que pour **status ≥ 500**.

---

## 3. Navigateurs (Ch. II sujet)

- [ ] **Chrome** (dernière version) : parcours complet OK
- [ ] **Firefox** (dernière version) : parcours complet OK
- [ ] **Mobile** (responsive) : dashboard + lecture vidéo utilisables

---

## 4. API RESTful

Voir **[api-restful.md](./api-restful.md)** pour la démonstration curl et les arguments face au correcteur.

---

## 5. Résumé avant de passer la porte

```
□ Console client : 0 error / 0 warning sur parcours complet
□ Console serveur : pas de 500 sur parcours nominal
□ Chrome + Firefox testés
□ curl OAuth2 + movies + comments préparés
□ Films de démo bien seedés (YTS populaires)
```
