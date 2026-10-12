# nutrifive-prix

Relevé automatique des **prix de détail en supermarché** publiés par le
[RNM de FranceAgriMer](https://rnm.franceagrimer.fr) (service public), deux fois par semaine.

- `rnm.mjs` lit les 5 pages « DETAIL GMS » (légumes, fruits, viande, poisson, lait et œufs) et écrit `rnm.json`.
- Le site RNM n'autorise pas la lecture depuis un navigateur ; ce fichier statique permet à l'app
  NutriFive (Android et site web iPhone) d'afficher un **budget estimé** de la liste de courses.
- Si une page change de forme et ne donne plus aucun prix, le script échoue au lieu de publier un fichier vide.

Source des données : RNM — FranceAgriMer. Ce sont des prix moyens nationaux, pas ceux d'un magasin.
