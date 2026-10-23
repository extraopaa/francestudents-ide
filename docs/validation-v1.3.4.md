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

Le runner Mac Intel n’expose pas WebGL matériel. Son test EffectCraft utilise explicitement SwiftShader, uniquement via les arguments de lancement du test ; l’application distribuée n’active pas ce mode. Le runner ARM64 conserve son rendu par défaut.

## Limites

- macOS 13 minimum. La version Mac reste en bêta.
- Signature ad hoc, sans certificat Developer ID ni notarisation Apple : Gatekeeper peut encore refuser l’ouverture après téléchargement. Un contrôle de signature réussi ne signifie pas une autorisation Gatekeeper.
- Aucun essai sur un Mac M5 physique après téléchargement Safari.
- L’installation interactive par-dessus le profil personnel n’est pas automatisée ; la migration est testée sur des profils représentatifs isolés.
- Si le coffre système est indisponible, la connexion reste en mémoire et doit être renouvelée au prochain démarrage.
