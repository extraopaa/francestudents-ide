# Répertoire des erreurs de stabilité

Ces codes sont propres à FranceStudent IDE. Le code, la version et les détails techniques copiés depuis le message de redémarrage permettent à un contributeur ou à une IA de retrouver la catégorie du problème. Un code décrit ce qui a été observé, pas nécessairement la cause profonde.

| Code | Ce qui a été détecté | Suite utile |
| --- | --- | --- |
| FST-001 | Session précédente non fermée normalement ; cause inconnue. Cela inclut une fermeture forcée ou une coupure de courant. | Demander l’action en cours et consulter les informations disponibles ; ne pas inventer de cause. |
| FST-101 | Processus d’interface arrêté, signalé par Electron. | Examiner `reason` et `exitCode`, puis le scénario de reproduction. |
| FST-102 | Manque de mémoire ou éviction mémoire de l’interface signalé par Electron. | Vérifier les gros flux, sorties, conversations et aperçus. |
| FST-103 | Échec du contrôle d’intégrité du processus d’affichage sous Windows. | Vérifier la provenance et l’installation du paquet. |
| FST-104 | Interface impossible à démarrer ou à recharger. | Vérifier les fichiers embarqués et les événements de chargement. |
| FST-201 | Processus graphique arrêté. | Vérifier les informations GPU et le scénario ; ne pas conclure automatiquement à un pilote défectueux. |
| FST-202 | Processus auxiliaire arrêté. | Examiner le type de processus et son code de sortie. |
| FST-301 | Erreur de connexion du terminal. | Vérifier `errorCode`, l’état du shell et les tuyaux Windows. Le terminal concerné est fermé ; l’IDE continue. |
| FST-401 | Exception non gérée dans le processus principal. | Examiner la catégorie d’exception et reproduire. Le diagnostic ne masque pas l’erreur fatale. |
| FST-402 | Initialisation de l’application en échec. | Vérifier les étapes de démarrage. |
| FST-501 | Événement local impossible à transmettre à l’interface. | Vérifier le cycle de vie de la fenêtre et les données sérialisables. Le transport d’interface ne doit pas faire tomber l’application. |

## Affichage au redémarrage

Après une panne enregistrée ou une session interrompue, une fenêtre affiche le code, la raison disponible, la version, le système et l’heure. **Copier le diagnostic** prépare un texte à transmettre volontairement. **J’ai compris**, Échap ou la fermeture de cette fenêtre acquittent le message ; un simple affichage ne le supprime pas.

Sans raison enregistrée, le code reste FST-001 : une fermeture forcée n’est pas présentée comme une panne identifiée du logiciel. Une fermeture normale ne déclenche pas cette alerte. Les erreurs récupérées du terminal ne sont pas présentées comme un crash complet de l’IDE.

## Données locales

Le journal `stability.json` se trouve dans le dossier de données FranceStudent (`FS_DATA_DIR`, ou `~/.francestudent-cli`). Il garde au plus 50 événements. Il n’enregistre pas les contenus des conversations ou fichiers, les messages complets d’exception, leurs traces, les jetons ni les mots de passe. Aucun diagnostic n’est envoyé automatiquement. Aucun dump mémoire n’est activé par ce mécanisme.

Les sorties fatales natives ne peuvent pas toutes être interceptées. Le marqueur de session permet alors seulement de reconnaître un arrêt non terminé normalement. Ne pas prétendre que chaque crash a une cause précise connue.

## Repères pour les autres IA

- Catalogue et persistance : `desktop/stability.js`.
- Surveillance des processus, terminal et récupération : `desktop/main.js`.
- Fenêtre de diagnostic : `desktop/renderer/src/48-stability-notice.js`.
- Tests : `test/stability.test.js`, `test/stream-rendering.test.js` et le parcours Electron de redémarrage.
- Ne jamais remplacer ce diagnostic limité par une collecte des prompts, secrets ou dumps mémoire sans une décision explicite.
