# Hypertube

Plateforme de recherche et de **streaming vidéo** via torrent, développée à l'**École 42**.
L'utilisateur cherche un film, le serveur télécharge le torrent en tâche de fond et diffuse la vidéo dès qu'assez de données sont bufferisées — sans jamais bloquer l'interface.

---

## Fonctionnalités clés

- **Authentification complète** — inscription, login classique, réinitialisation de mot de passe par email, et **OAuth** (42, Google, GitHub, Discord).
- **Bibliothèque** — recherche multi-sources, tri et filtres (nom, genre, note, année), pagination asynchrone en *infinite scroll*, films vus/non-vus.
- **Streaming serveur** — téléchargement torrent côté back, lecture progressive au buffer, **conversion à la volée** (ffmpeg) des formats non supportés par le navigateur.
- **Sous-titres** — multi-langues avec sélecteur.
- **Commentaires** sécurisés (anti-XSS) sous chaque film.
- **Profils utilisateurs** — édition, photo, langue préférée ; email jamais exposé publiquement.
- **API REST** documentée et versionnée.
- **i18n** — interface multilingue.

---

## Stack technique

| | |
|---|---|
| **Frontend** | React 19 · Vite · TailwindCSS · React Router · i18next · Plyr / hls.js |
| **Backend** | NestJS · Fastify · Prisma ORM · Passport (JWT + OAuth) · argon2 |
| **Base de données** | PostgreSQL · Redis |
| **Média** | ffmpeg / fluent-ffmpeg (transcodage & streaming) · nodemailer |
| **Infra** | Docker Compose · monorepo npm workspaces |

---

## Sécurité

Mots de passe hachés (argon2), protection XSS, validation stricte des entrées (class-validator / Joi), uploads contrôlés, requêtes paramétrées (Prisma) contre l'injection SQL, rate-limiting.

---

## Contributeurs

Projet réalisé à l'École 42 par :

- **Jérémy Cointre** — [`jecointr`](https://github.com/jecointr)
- **Yassine Saidi** — [`OP181SD`](https://github.com/OP181SD)
- **Nessrine Maalem** — [`nessrinemaalem`](https://github.com/nessrinemaalem)
- **El Farouk Lehmime** — [`elehmime`](https://github.com/elehmime)
