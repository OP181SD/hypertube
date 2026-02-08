#  Hypertube — Cahier des charges

---

## I. Règles Générales

- [ ] Langage libre
- [ ] Frameworks autorisés  
  - [ ]  Aucune lib de streaming torrent (webtorrent, peerflix, pulsar)
- [ ] Serveur web libre (Apache / Nginx / autre)
- [ ] Compatible **Firefox** (latest)
- [ ] Compatible **Chrome** (latest)
- [ ] Layout présent :
  - [ ] Header
  - [ ] Main
  - [ ] Footer
- [ ] Site **responsive (mobile)**
- [ ] Tous les formulaires ont des validations
- [ ] Sécurité globale :
  - [ ] Mots de passe jamais en clair
  - [ ] Aucune injection HTML / JS (XSS)
  - [ ] Uploads contrôlés
  - [ ] Aucune altération SQL possible

---

## II. Authentification & Utilisateurs (III.1)

### Inscription
- [ ] Email
- [ ] Username
- [ ] First name
- [ ] Last name
- [ ] Password protégé (`input type="password"`)
- [ ] Validations front visibles

### Login classique
- [ ] Username + password
- [ ] Messages d’erreur gérés

### OAuth (Omniauth)
- [ ] Login avec **42**
- [ ] Login avec **un autre provider**
- [ ] Boutons visibles
- [ ] Redirection fonctionnelle

### Reset password
- [ ] Page “forgot password”
- [ ] Envoi email
- [ ] Page reset avec token
- [ ] Nouveau mot de passe + confirmation

### Logout
- [ ] Accessible depuis **toutes les pages**
- [ ] En un clic

### Langue utilisateur
- [ ] Langue préférée sélectionnable
- [ ] Par défaut = English

### Profil utilisateur
- [ ] Modifier :
  - [ ] Email
  - [ ] Photo de profil
  - [ ] Informations personnelles
- [ ] Voir le profil d’un autre utilisateur
- [ ] Email **jamais visible** sur les profils publics

---

## III. Library Part (III.2)

### Accès
- [ ] Accessible uniquement aux utilisateurs authentifiés

### Structure minimale
- [ ] Champ de recherche
- [ ] Liste de thumbnails

### Recherche (III.2.1)
- [ ] Recherche via **au moins 2 sources externes**
- [ ] Sources = contenu vidéo exclusivement
- [ ] Résultats affichés en thumbnails

### Thumbnails (III.2.2)

#### Affichage
- [ ] Résultats triés par **nom**
- [ ] Sans recherche :
  - [ ] Films populaires affichés
  - [ ] Tri par critère libre (seeders, downloads, etc.)

#### Chaque thumbnail affiche :
- [ ] Nom du film
- [ ] Année de production (si dispo)
- [ ] Note IMDb / TMDb / OMDb (si dispo)
- [ ] Image de couverture

#### UX
- [ ] Différenciation films vus / non vus
- [ ] Pagination asynchrone
- [ ] Infinite scroll
- [ ] Aucun bouton “load next page”

#### Tri & filtres
- [ ] Tri par :
  - [ ] Nom
  - [ ] Genre
  - [ ] Note IMDb
  - [ ] Année
- [ ] Filtres fonctionnels

---

## IV. Video Part (III.3)

### Accès
- [ ] Accès authentifié uniquement

### Informations vidéo
- [ ] Lecteur vidéo
- [ ] Résumé
- [ ] Casting (producteur, réalisateur, acteurs principaux)
- [ ] Année de production
- [ ] Durée
- [ ] Note IMDb / TMDb / OMDb
- [ ] Image de couverture

### Streaming
- [ ] Torrent lancé côté serveur (pas front)
- [ ] Lecture dès buffer suffisant
- [ ] Traitements non bloquants
- [ ] Loader / feedback utilisateur

### Stockage serveur
- [ ] Film sauvegardé après téléchargement complet
- [ ] Film supprimé après 1 mois sans visionnage

### Sous-titres
- [ ] Sous-titres anglais si disponibles
- [ ] Sous-titres langue utilisateur si différente et dispo
- [ ] Sélecteur de sous-titres fonctionnel

### Formats vidéo
- [ ] Conversion à la volée si format non supporté
- [ ] Support minimum **MKV**
- [ ] Lecture OK sur Firefox + Chrome

### Commentaires
- [ ] Liste des commentaires affichée
- [ ] Poster un commentaire
- [ ] Sécurisé (pas de HTML / JS injecté)

---

## V. API (III.4)

### Règle globale
- [ ] **Aucun endpoint autre que ceux documentés**
- [ ] Autres routes → codes HTTP appropriés

### Auth
- [ ] `POST /oauth/token` (retourne un token)

### Users
- [ ] `GET /users` → id + username
- [ ] `GET /users/:id` → username, email, photo
- [ ] `PATCH /users/:id` → username, email, password, photo

### Movies
- [ ] `GET /movies` → id, name
- [ ] `GET /movies/:id` →
  - [ ] id
  - [ ] name
  - [ ] IMDb mark
  - [ ] production year
  - [ ] length
  - [ ] subtitles
  - [ ] number of comments

### Comments
- [ ] `GET /comments`
- [ ] `GET /comments/:id`
- [ ] `PATCH /comments/:id`
- [ ] `DELETE /comments/:id`
- [ ] `POST /comments`
- [ ] `POST /movies/:movie_id/comments`

### Codes HTTP (front)
- [ ] 200 / 201 → succès
- [ ] 400 → validation
- [ ] 401 → non authentifié
- [ ] 403 → interdit
- [ ] 404 → introuvable
- [ ] 500 → erreur serveur

---

## Check final

- [ ] Aucun appel API non documenté
- [ ] Aucun écran blanc
- [ ] UX fluide
- [ ] Sécurité respectée
- [ ] Fonctionne Firefox / Chrome
- [ ] Fonctionne mobile
