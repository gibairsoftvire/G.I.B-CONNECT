# G.I.B. CONNECT — V0.9, étape de connexion réelle

Cette livraison conserve l’interface et les fonctions locales du ZIP V0.9 original. Elle ajoute Firebase Authentication (e-mail/mot de passe, Google, réinitialisation) et la consultation des droits Firestore access/{uid}. Aucun Analytics, Storage ou service facturable n’est utilisé par ce code.

IMPORTANT : ce n’est pas encore une version multi-utilisateur complète. Membres, événements, terrains, cotisations, conversations, sondages et notifications restent LOCAUX à l’appareil et au compte connecté. Invitations et billets restent des simulations. Aucun bot Discord ou paiement réel n’est raccordé. Une connexion réelle ne synchronise pas les données. Les données locales ne constituent pas un stockage confidentiel face aux autres utilisateurs de cet appareil.

## Mise en ligne
1. Décompresser le ZIP.
2. Dans GitHub G.I.B-CONNECT, Add file → Upload files.
3. Envoyer tous les fichiers et le dossier icons à la racine. index.html ne doit pas se trouver dans un sous-dossier.
4. Commit changes. Attendre la publication GitHub Pages, puis Ctrl+F5.
5. Ouvrir https://gibairsoftvire.github.io/G.I.B-CONNECT/ et se connecter avec le compte créé dans Firebase. Aucun mot de passe n’est inclus dans les fichiers.

Firebase doit disposer de la base Firestore (default), des règles du fichier firestore.rules déjà publiées, et du domaine autorisé gibairsoftvire.github.io. Les paramètres Web ont été transcrits de la capture fournie. En cas d’erreur de clé, copier la configuration en texte depuis Firebase et remplacer firebase-config.js. Ne jamais ajouter de clé de compte de service.

## Droits
Dans Firestore access/{UID}, role = owner, admin ou member (type string), enabled = true (type boolean). Le compte doit déjà exister dans Authentication et son UID doit correspondre exactement au nom du document. Seule la console Firebase peut modifier ces droits avec les règles fournies. Aucun UID administrateur n’est codé en dur dans l’application. Une connexion Google avec un autre UID ne bénéficie pas automatiquement des droits du compte e-mail.

Les comptes owner et admin peuvent choisir Membre ou Administrateur dans Profil. Un compte member reste en vue Membre. Les droits doivent être confirmés en ligne ; un document absent, désactivé, inconnu ou issu uniquement du cache ne déverrouille pas l’application. Les futures opérations partagées devront être contrôlées par des règles serveur spécifiques ; les outils actuellement locaux ne constituent pas une autorisation serveur pour d’autres données.

## Données existantes et retour arrière
Les anciennes données de démo ne sont ni effacées ni importées automatiquement dans un compte réel. Chaque compte utilise une nouvelle clé de stockage local séparée. Le ZIP V0.9 original reste inchangé. Pour revenir à celui-ci, republier son contenu.

## Tests
Syntaxe JavaScript vérifiée. Tests DOM automatisés avec Firebase simulé : accès par défaut refusé, refus du cache hors ligne, owner/admin/membre, bascule de vue, accès désactivé et révocation. Aucun test de connexion réel ni contrôle visuel sur navigateur réel n’a été effectué dans cet environnement. À vérifier après publication : connexion avec le compte principal, vue Administrateur, retour Membre, déconnexion et refus d’un compte non autorisé.
