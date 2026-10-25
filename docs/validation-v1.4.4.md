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

Les plateformes distantes sont en cours de préparation. Les résultats finaux sont consignés avant/après publication. Aucun test réel du service fournisseur ou d’un Blender utilisateur n’est revendiqué : les réponses correspondantes sont instrumentées.

## Distribution prévue

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum ; six assets attendus. Windows reste non signé par un éditeur reconnu, Mac en bêta avec signature ad hoc et sans notarisation. Les mises à jour Windows utilisent latest.yml ; le Mac propose le téléchargement de son installateur.
