# API RESTful — guide de soutenance

> Document à utiliser pendant l'évaluation pour **démontrer** que l'API respecte les principes REST.
> Référence sujet : [`en.subject.pdf`](../en.subject.pdf) § III.4.

---

## 1. Principes REST appliqués

| Principe | Comment Hypertube le respecte |
|---|---|
| **Ressources identifiées par URI** | `/users`, `/movies`, `/comments`, `/watchlist`, `/stream/:torrentId` |
| **Verbes HTTP sémantiques** | `GET` lecture, `POST` création, `PATCH` mise à jour partielle, `DELETE` suppression |
| **Stateless** | Chaque requête porte l'auth (cookie JWT ou `Authorization` via OAuth2) ; pas de session serveur |
| **Représentations JSON** | Toutes les réponses API sont du JSON (sauf flux vidéo / VTT) |
| **Codes HTTP explicites** | 200, 201, 204, 400, 401, 403, 404, 206 (stream Range), 503 |
| **Pas d'action dans l'URL** | Les URLs nomment des **ressources**, pas des verbes (`/comments`, pas `/createComment`) |

**Exceptions assumées (hors CRUD pur, mais imposées ou pratiques) :**
- `POST /oauth/token` — endpoint OAuth2 **imposé par le sujet** (échange credentials → token)
- `POST /auth/login`, `POST /auth/register`… — auth web par cookies (SPA), distinct de l'API OAuth2 machine-to-machine
- `GET /stream/:torrentId` — ressource flux vidéo (binaire), pas JSON

---

## 2. Carte des ressources

### Utilisateurs — `/users`

| Méthode | Route | Auth | Description | Codes |
|---|---|---|---|---|
| `GET` | `/users` | JWT | Liste `{ id, username }` | 200, 401 |
| `GET` | `/users/me` | JWT | Profil courant (email inclus) | 200, 401 |
| `GET` | `/users/:id` | JWT | Profil public ; email si soi-même | 200, 401, 404 |
| `PATCH` | `/users/:id` | JWT | Mise à jour profil (soi uniquement) | 200, 400, 401, 403, 404 |
| `POST` | `/users/:id/avatar` | JWT | Upload avatar (multipart) | 200, 400, 401, 403 |

### Films — `/movies`

| Méthode | Route | Auth | Description | Codes |
|---|---|---|---|---|
| `GET` | `/movies` | Public* | Recherche / catalogue paginé | 200 |
| `GET` | `/movies/popular` | Public | Hero carousel (TMDb) | 200 |
| `GET` | `/movies/:id` | JWT | Détail complet + torrents + sous-titres | 200, 401, 404 |

\* Route publique : auth optionnelle (enrichit watched/watchlist si connecté).

### Commentaires — `/comments`

| Méthode | Route | Auth | Description | Codes |
|---|---|---|---|---|
| `GET` | `/comments?movieId=` | JWT | Liste (filtrable par film) | 200, 401 |
| `GET` | `/comments/:id` | JWT | Détail d'un commentaire | 200, 401, 404 |
| `POST` | `/comments` | JWT | Créer `{ movieId, content }` | 201, 400, 401 |
| `POST` | `/movies/:movie_id/comments` | JWT | Créer via ressource imbriquée (sujet) | 201, 400, 401, 404 |
| `PATCH` | `/comments/:id` | JWT | Modifier (auteur uniquement) | 200, 400, 401, 403, 404 |
| `DELETE` | `/comments/:id` | JWT | Supprimer (auteur uniquement) | 204, 401, 403, 404 |

### OAuth2 — imposé par le sujet

| Méthode | Route | Auth | Description | Codes |
|---|---|---|---|---|
| `POST` | `/oauth/token` | Client credentials | `grant_type=password` ou `refresh_token` → tokens | 200, 400, 401 |

### Extensions REST (hors doc minimale du sujet, mais cohérentes)

| Ressource | Routes | Verbes |
|---|---|---|
| **Watchlist** | `/watchlist`, `/watchlist/:movieId` | GET, POST, DELETE |
| **Streaming** | `/stream/:torrentId`, `/stream/:torrentId/status` | GET |
| **Sous-titres** | `/subtitles/:movieId`, `/subtitles/:movieId/:lang` | GET |

### Routes rejetées

Toute route non définie → **404 Not Found** (NestJS).
Route protégée sans token → **401 Unauthorized**.
Ressource interdite (profil autre user) → **403 Forbidden**.
Body invalide (class-validator) → **400 Bad Request**.

---

## 3. Démonstration live (curl)

> Remplacer `CLIENT_ID`, `CLIENT_SECRET`, `TOKEN`, `UUID` par des valeurs réelles.

### OAuth2 token (sujet)

```bash
curl -s -X POST http://localhost:3000/oauth/token \
  -H "Content-Type: application/json" \
  -d '{"grant_type":"password","client_id":"CLIENT_ID","client_secret":"CLIENT_SECRET","username":"demo","password":"***"}'
```

### Liste utilisateurs

```bash
curl -s http://localhost:3000/users \
  -H "Authorization: Bearer TOKEN"
```

### Détail film

```bash
curl -s http://localhost:3000/movies/UUID \
  -H "Authorization: Bearer TOKEN"
```

### Créer un commentaire (ressource imbriquée — sujet)

```bash
curl -s -X POST http://localhost:3000/movies/UUID/comments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Great movie!"}'
```

### Route inexistante → 404

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/not-a-route
# Attendu : 404
```

### Sans auth sur route protégée → 401

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/movies/UUID
# Attendu : 401
```

---

## 4. Arguments à tenir face au correcteur

1. **« Pourquoi POST pour créer un commentaire et pas PUT ? »**  
   → `POST` sur une collection (`/comments`) crée une nouvelle ressource avec ID généré par le serveur. `PUT` impliquerait une URI connue à l'avance.

2. **« PATCH vs PUT ? »**  
   → `PATCH` sur `/users/:id` : mise à jour **partielle** (seuls les champs envoyés changent). Conforme au sujet.

3. **« DELETE retourne quoi ? »**  
   → `204 No Content` sans body — standard REST pour suppression réussie.

4. **« Pourquoi des routes /auth/* en plus ? »**  
   → L'API OAuth2 du sujet sert les clients machine-to-machine. Le SPA utilise des cookies httpOnly pour l'UX (login web), ce qui est distinct et documenté.

5. **« C'est HATEOAS ? »**  
   → Non, pas de liens hypermédia dans les réponses. Le sujet ne l'exige pas ; l'API reste **RESTful** au sens architectural (ressources + verbes + stateless + codes HTTP).

6. **« Validation ? »**  
   → `ValidationPipe` global : `whitelist: true`, `forbidNonWhitelisted: true` → champs inconnus rejetés (400).

---

## 5. Fichiers source de référence

| Fichier | Rôle |
|---|---|
| `backend/src/users/users.controller.ts` | CRUD users |
| `backend/src/movies/movies.controller.ts` | Movies |
| `backend/src/comments/comments.controller.ts` | Comments |
| `backend/src/auth/auth.controller.ts` | OAuth2 + auth web |
| `backend/src/common/filters/http-exception.filter.ts` | Format erreurs JSON uniforme |
| `backend/src/common/guards/jwt-auth.guard.ts` | Auth globale + routes `@Public()` |
