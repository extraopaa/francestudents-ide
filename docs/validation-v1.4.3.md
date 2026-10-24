# Validation 1.4.3

Préparation du 25 octobre 2026. Cette version désactive la génération automatique du résumé IA lors du chargement d’un projet, indépendamment de la bêta des pièces jointes. Le résumé existant et l’index local restent disponibles ; `/index` demande explicitement la génération IA.

## Contrôles locaux

- 745 tests unitaires : 742 réussis, 3 tests Unix ignorés sous Windows, aucun échec.
- Nouveau parcours Electron réussi : ouverture puis réouverture d’un projet modifié sans appel à requestModel ; `/index` déclenche une tentative explicite, et une réponse de quota épuisé est rendue en carte avec détails repliés et bouton de reset. Capture inspectée visuellement.
- Lint sans erreur, avertissement préexistant `preserve-caught-error` dans desktop/main.js.
- Renderer et EffectCraft vérifiés ; audit npm sans vulnérabilité signalée au moment du contrôle.

- Suite Electron complète : **35 parcours réussis**, aucun échec.
- Application Windows empaquetée : terminal PTY et vrai moteur EffectCraft contrôlés ; six fichiers applicatifs modifiés depuis la 1.4.2 comparés au tag avec fins de ligne normalisées. Version 1.4.3 et métadonnées latest.yml (taille et SHA-512) vérifiées.
- Contrôle depuis l’ASAR Windows : deux chargements du projet produisent zéro appel de résumé IA ; la demande explicite en produit un ; le contenu du projet reste présent dans le contexte local.
- Installateur Windows final : signature Authenticode vérifiée `NotSigned`, conformément à la limite annoncée.

Les résultats de la CI et de la construction Mac sont consignés après construction. Aucun appel fournisseur réel n’a été nécessaire pour les contrôles du résumé : sa requête est instrumentée et son erreur de quota est simulée.

CI Windows/Linux/macOS Node 22 et construction Mac réussies. Mac ARM64 : 745 tests unitaires, 738 réussis et 7 ignorés selon la plateforme ; contrôles d’interface/migration et paquet EffectCraft/terminal réussis. Signature ad hoc vérifiée dans l’application et dans le DMG monté ; aucune notarisation Apple n’est revendiquée.

## Distribution

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum. Source applicative : tag immuable v1.4.3, commit 8d60dbd7f7f05c07ebef79dfd3ce0aae0fb4b762 ; les commits ultérieurs de compte rendu ne changent pas ces binaires. Construction Mac : [40140515406](https://github.com/extraopaa/francestudents-ide/actions/runs/40140515406). CI Node 22 : [40140513135](https://github.com/extraopaa/francestudents-ide/actions/runs/40140513135).

La [release 1.4.3](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.3) est publique, ni brouillon ni préversion. Avant publication, les tailles et SHA-256 des six assets ont été comparés aux empreintes serveur GitHub ; les deux paquets Mac téléchargés correspondent aussi au manifeste du runner. SHA256SUMS.txt réunit les cinq fichiers distribués hors manifeste lui-même.

| Fichier | Taille | SHA-256 |
| --- | ---: | --- |
| FranceStudentIDE-1.4.3-setup.exe | 190902713 | `bfa137e0d98a8e3d351722fff960c878cf0c712a838cb8186a7e9dbf0cf78238` |
| FranceStudentIDE-1.4.3-mac-arm64.dmg | 227335102 | `5291ea62e641d2e02d8f958982aa27eee018fc559dea30132795c4aa111db0a2` |
| FranceStudentIDE-1.4.3-mac-arm64.zip | 219319298 | `c06a8186afd4b14de2b87b2927d493b4b5229dfb3c2fa2b261d2a6b1ec5c34b3` |

La version Windows reste sans signature d’éditeur reconnue. Le signalement Smart App Control de la 1.4.2 n’est pas corrigé par cette version : une signature de confiance de l’installateur et de ses composants reste nécessaire. Le Mac est en bêta, signé ad hoc et non notarisé. Les mises à jour Windows utilisent latest.yml ; le Mac propose le téléchargement de son installateur.
