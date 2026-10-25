# Validation 1.4.4

Préparation du 25 octobre 2026. La version généralise les pièces jointes locales avec repli classique, réduit les répétitions des prompts et renforce le protocole MCP/OpenAI. L’analyse IA automatique du projet est rétablie avec cache, à la demande du contributeur.

## Contrôles locaux

- 771 tests unitaires : 768 réussis, 3 tests Unix ignorés sous Windows, aucun échec.
- Lint : aucune erreur, un avertissement préexistant `preserve-caught-error` dans desktop/main.js.
- Renderer reconstruit et contrôlé, moteur EffectCraft vérifié, audit npm sans vulnérabilité signalée au moment du contrôle.
- Régressions MCP : récupération du schéma réel avant reprise, découverte indisponible non répétée, absence de reprise automatique en plan/Éco, erreurs de l’outil signalées comme échecs, même action au résultat incertain non répétée même avec clés réordonnées.
- Régressions de consommation : référence des lectures entièrement livrées dans leur conversation/modèle/projet, conservation des résultats complets pour une reprise, JSON minifié sans altérer les nombres/chaînes, détail des journaux réussis accessible localement, images identiques dédupliquées dans le même envoi et retransmises lors d’un nouvel envoi explicite.
- Régressions pièces jointes : activation automatique malgré l’ancien drapeau bêta, repli classique préservant la sélection ZIP, provenance des captures MCP pour l’exception GPT 6.1 Sol, reprise du cache d’analyse et actualisation des fichiers modifiés.

- Suite Electron complète : **35 parcours réussis**, aucun échec. Sélecteur ZIP, retour classique, pièces jointes distinctes de même nom/taille, cache d’analyse, quota, historique, plein écran Code/Motion, questions et annulation contrôlés. Carte de quota inspectée visuellement.
- Application Windows empaquetée : démarrage, terminal PTY et vrai moteur EffectCraft contrôlés avec succès ; version 1.4.4 confirmée. Installateur Authenticode `NotSigned`, limite annoncée maintenue.
- Les 22 fichiers applicatifs modifiés ont été comparés au contenu de l’ASAR, fins de ligne normalisées. Version, taille et SHA-512 de latest.yml vérifiées. Contrôle direct dans le paquet : première analyse IA automatique, seconde ouverture servie par cache, /index force une deuxième analyse ; sélection ZIP limitée à keep.txt ; extraction du PDF sans image puis rendu visuel explicite réussi. Le processus Node du script auxiliaire de démarrage est resté actif après ses assertions et a été arrêté ; les parcours Electron ordinaires et le contrôle empaqueté EffectCraft se terminent normalement.

La [CI Node 22 Windows/Linux/macOS](https://github.com/extraopaa/francestudents-ide/actions/runs/40146356097) a réussi sur le commit applicatif `31b95d6234de73f47d4b27c151b26868c22277dd`. Chacune des plateformes exécute les 771 tests : Windows 768 réussis / 3 ignorés, Linux et macOS 764 réussis / 7 ignorés. Audit, lint, renderer, EffectCraft et construction du paquet réussis.

La [construction Mac ARM64](https://github.com/extraopaa/francestudents-ide/actions/runs/40146358313) a réussi : 764 tests unitaires réussis et 7 ignorés, quatre parcours de mise à jour/sécurité/migration réussis, application empaquetée avec PTY et vrai EffectCraft contrôlés. Signature ad hoc vérifiée dans l’application et dans le DMG monté. Capture du mode motion inspectée visuellement. Aucune notarisation Apple ni validation sur un Mac M5 physique n’est revendiquée. Aucun test réel du service fournisseur ou d’un Blender utilisateur n’est revendiqué : les réponses correspondantes sont instrumentées.

## Distribution publiée

La [release 1.4.4](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.4) est publique, ni brouillon ni préversion. Source applicative : tag immuable `v1.4.4`, commit `31b95d6234de73f47d4b27c151b26868c22277dd`. Les commits ultérieurs de compte rendu ne changent pas les binaires.

Les tailles et SHA-256 des six assets ont été comparés aux empreintes serveur GitHub avant et après publication. Les deux paquets Mac téléchargés correspondent aussi au manifeste du runner. SHA256SUMS.txt contient les cinq fichiers distribués hors manifeste lui-même, au format minuscules et deux espaces avant le nom.

Le [workflow Windows de publication](https://github.com/extraopaa/francestudents-ide/actions/runs/40146848752) a réussi et conservé les assets déjà joints.

| Fichier | Taille | SHA-256 |
| --- | ---: | --- |
| FranceStudentIDE-1.4.4-setup.exe | 190907808 | `804620bdeeb2d45ddd82f028f56a11b8f023d4f894b9bf1b978eb0929f3b025b` |
| FranceStudentIDE-1.4.4-mac-arm64.dmg | 227346864 | `d3cb673f260f4c4fa3b4a59103577a52fc0d05b1dc92eb1fa5a8d36c241baa57` |
| FranceStudentIDE-1.4.4-mac-arm64.zip | 219325170 | `93cf2b59ba10d31e9d269279f85c30ff949ad5ec0118e45e7fa27a6b8c3612fd` |

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum. Windows reste non signé par un éditeur reconnu, Mac en bêta avec signature ad hoc et sans notarisation. Les mises à jour Windows utilisent latest.yml ; le Mac propose le téléchargement de son installateur.
