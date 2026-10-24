# Validation 1.4.3

Préparation du 25 octobre 2026. Cette version désactive la génération automatique du résumé IA lors du chargement d’un projet, indépendamment de la bêta des pièces jointes. Le résumé existant et l’index local restent disponibles ; `/index` demande explicitement la génération IA.

## Contrôles locaux

- 745 tests unitaires : 742 réussis, 3 tests Unix ignorés sous Windows, aucun échec.
- Nouveau parcours Electron réussi : ouverture puis réouverture d’un projet modifié sans appel à requestModel ; `/index` déclenche une tentative explicite, et une réponse de quota épuisé est rendue en carte avec détails repliés et bouton de reset. Capture inspectée visuellement.
- Lint sans erreur, avertissement préexistant `preserve-caught-error` dans desktop/main.js.
- Renderer et EffectCraft vérifiés ; audit npm sans vulnérabilité signalée au moment du contrôle.

Les résultats finaux de la suite Electron, des applications empaquetées et de la CI sont consignés après construction. Aucun appel fournisseur réel n’a été nécessaire pour ces contrôles : la requête de résumé est instrumentée, et son erreur de quota est simulée.

## Distribution

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum. La release et les paquets doivent correspondre au tag immuable v1.4.3 ; les commits ultérieurs de compte rendu ne changent pas ces binaires.

La version Windows reste sans signature d’éditeur reconnue. Le signalement Smart App Control de la 1.4.2 n’est pas corrigé par cette version : une signature de confiance de l’installateur et de ses composants reste nécessaire. Le Mac est en bêta, signé ad hoc et non notarisé. Les mises à jour Windows utilisent latest.yml ; le Mac propose le téléchargement de son installateur.
