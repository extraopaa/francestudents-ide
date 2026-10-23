# Validation de la version 1.3.4

Cette version met à jour Electron vers 45.0.0 et protège les identifiants avec le coffre du système. Elle conserve le nom interne du paquet, l’appId et les dossiers de profil existants.

## Contrôles locaux Windows

- Audit npm complet, dépendances de développement comprises : aucune vulnérabilité connue signalée au moment du contrôle.
- Tests unitaires : 689 tests, 686 réussis et 3 ignorés car réservés à Unix.
- Parcours Electron : 28 réussis, avec données de test isolées.
- Application Windows empaquetée : démarrage, terminal PTY, vrai moteur EffectCraft, rendu d’une image et commandes du studio vérifiés.
- Migration d’anciens cookies et jetons : secrets absents des fichiers en clair, connexions restaurées après redémarrage, historique et préférences conservés. Le mode temporaire est vérifié lorsque le coffre n’est pas disponible.
- Pont Electron : fenêtre principale acceptée, fenêtre étrangère utilisant le même preload refusée ; presse-papiers Unicode vérifié.

Les API distantes et mutations GitHub sont simulées dans les tests automatisés. Une absence de vulnérabilités signalées par npm n’est pas une garantie d’absence de faille.

## Validation native et publication

La validation multiplateforme est exécutée par le workflow [Security and upgrade validation](https://github.com/extraopaa/francestudents-ide/actions/workflows/security-validation.yml). Les rapports de signature et les captures sont joints à ses artefacts Mac. Consulter le résultat du workflow correspondant au commit de la release avant publication.

Sur Mac, les vérifications portent sur les architectures ARM64 et Intel, le terminal, le moteur EffectCraft empaqueté, les offres de mise à jour et la migration des connexions. La signature est contrôlée sur l’application construite et sur celle contenue dans le DMG.

Résultats des [validations natives](https://github.com/extraopaa/francestudents-ide/actions/runs/40036401333) : Windows et Mac ARM64 réussissent l’ensemble de leurs étapes, notamment EffectCraft empaqueté. Les tests unitaires, de migration et du pont IPC passent aussi sur Mac Intel. Le paquet Intel démarre et son terminal fonctionne, mais le test EffectCraft échoue sur la création du contexte WebGL.

Une [vérification séparée du même paquet Intel](https://github.com/extraopaa/francestudents-ide/actions/runs/40037461713) confirme la validité des signatures du bundle ZIP et de l’application dans le DMG. SwiftShader, OpenGL et Metal ne fournissent aucun contexte WebGL dans ce runner ; les trois tentatives de rendu échouent. Ces options sont limitées au test. Le rendu EffectCraft Intel reste à vérifier sur un Mac physique ; cette publication ne constitue pas une validation de cette fonction sur Intel.

## Limites

- macOS 13 minimum. La version Mac reste en bêta.
- Signature ad hoc, sans certificat Developer ID ni notarisation Apple : Gatekeeper peut encore refuser l’ouverture après téléchargement. Un contrôle de signature réussi ne signifie pas une autorisation Gatekeeper.
- Le contrôle Gatekeeper du runner ARM64 rejette effectivement le paquet non notarisé.
- Aucun essai sur un Mac M5 physique après téléchargement Safari.
- L’installation interactive par-dessus le profil personnel n’est pas automatisée ; la migration est testée sur des profils représentatifs isolés.
- Si le coffre système est indisponible, la connexion reste en mémoire et doit être renouvelée au prochain démarrage.
