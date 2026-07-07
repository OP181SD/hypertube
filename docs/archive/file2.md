st-ce que le sujet oblige à ce que les films et séries aient 
  tous des covers ou pas forcement. C'est pour savoir si        
  j'affiche seulement les films pour lesquels TMDb offre une    
  cover ou même ceux pour lesquels il n'en donne pas            
  
⏺ Bonne question. Vérifions ce que dit réellement le sujet sur
  les thumbnails/covers.

  Listed 1 directory (ctrl+o to expand)

⏺ Lisons la section pertinente du sujet (la partie "Library /
  Search & Thumbnails").

  Read 1 file (ctrl+o to expand)

⏺ Réponse claire après lecture du sujet (section III.2.2 
  Thumbnails, p.5) :

  Ce que dit exactement le sujet

  ▎ « Each thumbnail must display the name of the video, its 
  ▎ production year (if available), its IMDb (OMDb or TMDb for 
  ▎ free API) rating (if available), and a cover image. »

  Le détail à noter : la formule « (if available) » est accolée
  à l'année et à la note IMDb — mais pas à a cover image.
  Grammaticalement, la cover est listée comme un élément requis
  du thumbnail, sans réserve d'optionalité.

  Ce que ça implique concrètement

  Le sujet n'impose pas que tu filtres les films sans cover. Il
  impose que chaque vignette affiche une cover image. La nuance
  est importante :

  - Tu n'es pas obligé d'exclure les films dont TMDb ne fournit
  pas de poster.
  - En revanche, si tu les affiches, ta vignette doit quand même
  comporter une image de couverture → il te faut un
  placeholder/fallback (image générique « no poster available
  »).

  Une vignette sans aucune image serait, elle, non conforme (et
  en plus moche en soutenance).

  Recommandation

  Affiche tout, avec un fallback plutôt que de filtrer :

  1. C'est la lecture la plus sûre du sujet (un thumbnail a
  toujours une image).
  2. Filtrer réduirait artificiellement ton catalogue alors que
  YTS/apibay peuvent avoir le torrent même si TMDb n'a pas de
  poster.
  3. C'est le comportement standard (Netflix, Plex… affichent un
  placeholder).
  4. En soutenance, un correcteur qui cherche un film précis et
  ne le voit pas parce qu'il a été silencieusement filtré, c'est
  pire qu'un placeholder.

  Petit piège lié à la règle éliminatoire V.1 (« no
  errors/warnings in the console ») : si tu pointes un <img src>
  vers une URL TMDb inexistante, tu génères une 404 dans la 
  console → gère le cas en amont (détecte poster_path === null
  et sers ton placeholder local, plutôt que de laisser le
  onError du <img> se déclencher).

  En résumé : non, le sujet n'oblige pas à n'afficher que les 
  films avec cover — mais oui, chaque vignette doit avoir une
  image, donc prévois un placeholder.

✻ Crunched for 30s

※ recap: You asked whether the subject requires all films to 
  have covers. Answer: no, it doesn't force filtering out 
  cover-less films, but each thumbnail must show an image, so 
  display everything with a placeholder fallback. No action 
  pending. (disable recaps in /config)