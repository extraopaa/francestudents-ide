# Validation 1.4.2 — pièces jointes locales expérimentales

Préparation du 24 octobre 2026. La bêta est désactivée par défaut ; elle doit être activée dans les paramètres IA avec confirmation. Les ZIP, PDF et autres pièces jointes gardent leur ancien traitement sans activation.

## Contrôles Windows

- 743 tests unitaires : 740 réussis, 3 tests Unix ignorés, aucun échec. Parallélisme fixé à quatre processus pour borner la consommation mémoire des tests natifs PDF/canvas ; la première exécution sans cette borne avait interrompu un processus de test PDF. Les tests PDF ciblés et la suite bornée ont réussi.
- Six scénarios ciblés réussis : activation explicite/persistance, sélection ZIP, recherche locale, séparation Code/Motion, texte PDF sans image, rendu visuel à la demande et page scannée.
- Parcours Electron ZIP réussi : fonctionnement normal sans activation, activation via les paramètres et confirmation, recherche, sélection d’un seul fichier, ajout et désactivation. Capture du sélecteur inspectée visuellement.
- Premier passage complet Electron : 33 réussis et un échec sur le texte d’avertissement normal. Texte historique rétabli hors bêta ; les deux contrôles ciblés glisser-déposer/ZIP ont ensuite réussi, puis la suite complète finale : **34 parcours réussis, aucun échec**.
- Bundle renderer et paquet EffectCraft contrôlés ; audit npm sans vulnérabilité signalée au moment de la préparation. Lint sans erreur, un avertissement préexistant `preserve-caught-error` dans desktop/main.js.
- Application Windows empaquetée : terminal PTY et vrai moteur EffectCraft contrôlés. Les 22 fichiers applicatifs modifiés depuis 1.4.1 correspondent au tag (fins de ligne normalisées) ; version 1.4.2 et métadonnées SHA-512/taille de latest.yml vérifiées.
- Contrôle réel depuis l’ASAR Windows : bêta désactivée par défaut, conversion ZIP filtrée au seul fichier choisi, lecture du texte PDF sans image, rendu PNG de la page sur demande.

## Publication et limites

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum. Source applicative : tag immuable v1.4.2, commit e19df91bed3c2b0a217d60f63eb602a72d3f20ed. Les commits de compte rendu suivants ne changent pas ces binaires. Construction Mac : [40127168442](https://github.com/extraopaa/francestudents-ide/actions/runs/40127168442). CI multiplateforme Node 22 : [40127165183](https://github.com/extraopaa/francestudents-ide/actions/runs/40127165183). Les résultats finaux et empreintes sont consignés après construction. Le numéro du paquet seul ne prouve pas que la release est publique.

La CI multiplateforme et la construction Mac ont réussi. Sur Mac ARM64 : 743 tests unitaires, 736 réussis et 7 ignorés selon la plateforme ; contrôles d’interface/migration réussis ; vrai terminal PTY et moteur EffectCraft contrôlés dans l’application empaquetée. Signature locale vérifiée dans l’application et dans le DMG monté. Ces vérifications ne sont pas une notarisation Apple ni une validation sur chaque Mac physique.

La [release 1.4.2](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.2) est publique, ni brouillon ni préversion. Les six assets ont été comparés aux tailles et empreintes serveur GitHub avant publication. Les DMG/ZIP téléchargés correspondent également au manifeste du runner Mac. SHA256SUMS.txt regroupe les cinq fichiers distribués hors manifeste lui-même.

| Fichier | Taille | SHA-256 |
| --- | ---: | --- |
| FranceStudentIDE-1.4.2-setup.exe | 190901501 | `63580267789fd068ea540fdbe6aab58ba377cc0b44d00f9666e752a218d388da` |
| FranceStudentIDE-1.4.2-mac-arm64.dmg | 227333928 | `8b93a9bc46844b51d209865819b02361bb7ded7932adf5768a0500ee8bb9a5c8` |
| FranceStudentIDE-1.4.2-mac-arm64.zip | 219317965 | `0add6543a24a19cb85ddd18aa391e05a4d333ea0a9143bbf94fc0d0f97d9734f` |

Le gain réel de quota fournisseur n’est pas mesuré. Les appels IA et les contenus effectivement consultés restent facturables. L’index local est temporaire et borné à 128 Mo ; un redémarrage, une expiration après deux heures sans lecture ou une éviction demande un nouvel envoi. Les documents ne déclenchent aucune commande sur le PC. La sélection ZIP filtre les entrées avant décompression ; une erreur n’envoie pas un aperçu binaire global qui exposerait des éléments exclus.

Le Mac reste en bêta, signé ad hoc et non notarisé. L’application propose le téléchargement Mac ; les mises à jour Windows utilisent latest.yml. Aucun paquet Mac Intel ni portable Windows publié.
