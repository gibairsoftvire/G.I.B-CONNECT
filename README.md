# G.I.B. CONNECT — V0.9 synchronisée, édition militaire

Esthétique adaptée à la maquette fournie : camouflage discret, titres dorés, panneaux à angles coupés, bulles de conversation et navigation basse à cinq rubriques. Le menu en haut à gauche donne accès à Membres, Cotisations, Discord et HelloAsso. Logo et icônes de l’application identiques aux fichiers V0.9 originaux.

Les dates, noms, grades et compteurs viennent de Firebase. Aucun événement ni message des captures de test n’est inclus dans la livraison. Pas d’accusés de lecture fictifs.

Validation de cette édition : test de synchronisation de deux clients avec règles actives ; rendu et parcours dans Chromium aux largeurs 320, 390, 768 et 1440 ; menu, profil, vue administrateur et envoi de message ; pas de débordement horizontal. Les règles Firebase sont identiques à celles de la V0.9 synchronisée.

Les polices sont fournies localement dans assets avec leurs licences OFL, sans chargement auprès d’un service de polices tiers. Le motif de camouflage est un SVG local.


Lire INSTALLATION.txt. Les règles Firestore doivent être publiées AVANT les fichiers Web.

L’interface V0.9 est conservée, avec le logo et les icônes d’origine. Firebase gère la connexion, les droits et les données partagées. Les opérations sensibles sont protégées côté serveur ; masquer un formulaire ne constitue pas le contrôle d’accès.

## Validation réalisée
- Vérification de syntaxe app.js, auth.js et sw.js.
- Tests avec le véritable émulateur Firestore et les règles de cette livraison : refus anonyme/non autorisé, impossibilité de s’attribuer des droits, confidentialité des conversations privées y compris face à un administrateur non participant, identité des auteurs, profil/grade, invitation avec e-mail vérifié, cotisation, votes, révocation, concurrence pour la dernière place, libération de place, date limite.
- Deux clients indépendants et interface DOM : synchronisation des profils/grades, terrains initiaux, événement et présence, salon/message, cotisation, annonce et vote.
- Amorçage de connexion et activation des invitations testés avec SDK simulé.
- Empreintes SHA-256 des trois icônes identiques aux originaux V0.9.

La connexion réelle à ton projet a été validée dans la livraison précédente. Cette nouvelle synchronisation doit encore être vérifiée après publication sur ton site. Aucun accès à tes mots de passe, aucune modification distante de ton projet ou de ton dépôt n’a été effectué.
Le rendu a été vérifié dans Chromium aux dimensions mobile/tablette/ordinateur. Un essai sur un vrai téléphone reste à effectuer après publication.

## Sources techniques
https://firebase.google.com/docs/firestore/security/rules-conditions
https://firebase.google.com/docs/firestore/manage-data/transactions
https://firebase.google.com/docs/firestore/security/test-rules-emulator

## Fichiers
index.html, style.css, theme.css, appearance.js, app.js, auth.js, firebase-config.js, manifest.webmanifest, sw.js, icons et assets constituent le site statique sans compilation.
firestore.rules et REGLES_FIREBASE.txt contiennent les mêmes règles.
firebase.json sert uniquement aux outils de développement ; sa présence sur GitHub ne configure pas Firebase.
