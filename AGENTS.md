# FranceStudent IDE — point d’entrée pour les assistants IA

Ce fichier s’adresse à toute personne ou tout assistant qui reprend le dépôt, quel que soit son modèle. Il décrit le projet ; il ne contient pas de secret ni d’historique privé. Les demandes explicites du contributeur restent prioritaires.

## Pour reprendre

1. Lire [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md) et [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md).
2. Vérifier le dossier courant, `git status --short`, les remotes et la version de `package.json`. Ne pas supposer que l’arbre est propre ou que la version locale est publiée.
3. Lire le code et les tests de la zone concernée avant de modifier. Préserver les changements déjà présents ; ne pas inclure des captures ou fichiers personnels dans un commit.
4. Réaliser la demande, vérifier le résultat et indiquer précisément les tests exécutés et les limites restantes.

## Repères essentiels

- **Produit** : FranceStudent IDE, application Electron en français ; CLI et TUI partagent son cœur Node.js.
- **Origine** : projet de EsteG7 ; ce dépôt est le fork d’amélioration de extraopaa. Conserver les crédits et licences des composants tiers.
- **Dépôt de ce fork** : `extraopaa/francestudents-ide`. Vérifier les remotes avant toute opération distante. Ne pas pousser dans l’amont par inadvertance.
- **Interface** : modifier `desktop/renderer/src/*.js`, puis exécuter `npm run build:renderer`. `desktop/renderer/app.js` est généré **et versionné** ; ne pas l’éditer directement. Les modules sont concaténés par numéro et partagent une portée globale.
- **Style** : réutiliser les tokens et composants existants, en particulier `desktop/renderer/surfaces.css` et `desktop/renderer/src/46-shared-surfaces.js`. Conserver les identifiants des contrôles et l’accessibilité clavier ; vérifier aussi les petites fenêtres.
- **Code et motion sont indépendants** : aucune lecture du dossier code, de ses instructions, hooks ou MCP depuis l’agent EffectCraft, même en Full accès. Respecter `src/tools/motion-scope.js` et `src/motion-workspace.js`.
- **EffectCraft** : utiliser le vrai moteur embarqué et son pont de commandes. Ne pas recréer un éditeur HTML/canvas parallèle. Le correctif Rust/WASM reproductible est dans `patches/effectcraft-francestudent.patch`.
- **Historique** : le journal visible est distinct du contexte envoyé au modèle. Ne pas afficher les prompts internes ni supprimer les anciens échanges lors d’une compaction ou d’un nouveau chat.
- **Données** : préserver l’identité de mise à jour (`build.appId`) et le dossier historique de données malgré le renommage du produit. Ne pas déplacer ou réinitialiser ces données sans migration explicite.
- **Stabilité** : maintenir le [répertoire des codes FST](docs/error-codes.md) avec le catalogue de `desktop/stability.js`. Ne pas inventer de cause quand seul un arrêt anormal est connu. Le diagnostic local reste limité aux métadonnées techniques, sans contenu de conversation, secret, trace complète ni envoi automatique.
- **Plateformes** : pour les prochaines versions, Windows et Mac Apple Silicon ARM64 uniquement. Le support Mac Intel est arrêté après la 1.3.5 ; conserver ses anciennes releases, sans réintroduire de build Intel ni proposer un DMG ARM64 à un processus x64.
- **Questions de l’agent** : `ask_user` déclenche le QCM ou le champ libre pendant une tâche ; ne pas détecter les questions à partir des points d’interrogation dans du texte arbitraire. Full accès n’auto-répond pas et Passer ne donne aucune autorisation. Conserver l’historique des questions et réponses.

## Vérifications courantes

**Préférence du contributeur : réserver les tests automatisés à la préparation d’une publication, ou à une demande explicite de test.** Pendant le développement, ne pas relancer les suites après chaque modification. Préparer le code et documenter ce qui reste à vérifier ; avant publication, effectuer les contrôles adaptés et les parcours nécessaires. Cette règle remplace toute recommandation de test immédiat ci-dessous.

```sh
npm run lint
npm run build:renderer
npm run check:renderer
npm test
```

Pour une modification de l’interface, utiliser les tests Electron pertinents avec un environnement graphique et contrôler le rendu. La suite complète peut se lancer avec :

```sh
node --test --test-concurrency=4 e2e/*.e2e.test.js
```

`npm test` isole les réglages et historiques par processus. Un `node --test` lancé directement sans le préchargement d’isolation peut lire les préférences personnelles et produire des résultats trompeurs. Ne pas désactiver un garde-fou pour faire passer un test ; chercher d’abord la cause.

## Commits et publication

- Ne jamais versionner de session, jeton, `.env`, historique personnel, dépendance ou exécutable.
- Avant un commit, vérifier le diff et les fichiers sélectionnés ; éviter un ajout global quand des fichiers étrangers sont présents.
- Ne pousser, taguer ou publier que dans le cadre d’une demande explicite du contributeur. Une demande de test ou de modification n’est pas une demande de release.
- Pour une version, mettre à jour `package.json`, `CHANGELOG.md` **et** le résumé de `desktop/release-highlights.js` ; consulter la procédure de [CONTRIBUTING.md](CONTRIBUTING.md).
- Les noms d’assets viennent de `package.json`, pas d’un ancien exemple. GitHub Releases reçoit l’installeur, son `.blockmap`, `latest.yml` et `SHA256SUMS.txt`. Les portables restent locaux.

## Maintenir ce contexte

Mettre à jour le guide lié lorsqu’une architecture, une commande ou une contrainte importante change. Écrire le résultat actuel et les limites vérifiées, pas une retranscription de conversation. Le code, `package.json`, les tests et les workflows restent les sources de vérité.
