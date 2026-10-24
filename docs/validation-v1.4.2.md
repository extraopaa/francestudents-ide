# Validation 1.4.2 — pièces jointes locales expérimentales

Préparation du 24 octobre 2026. La bêta est désactivée par défaut ; elle doit être activée dans les paramètres IA avec confirmation. Les ZIP, PDF et autres pièces jointes gardent leur ancien traitement sans activation.

## Contrôles Windows

- 743 tests unitaires : 740 réussis, 3 tests Unix ignorés, aucun échec. Parallélisme fixé à quatre processus pour borner la consommation mémoire des tests natifs PDF/canvas ; la première exécution sans cette borne avait interrompu un processus de test PDF. Les tests PDF ciblés et la suite bornée ont réussi.
- Six scénarios ciblés réussis : activation explicite/persistance, sélection ZIP, recherche locale, séparation Code/Motion, texte PDF sans image, rendu visuel à la demande et page scannée.
- Parcours Electron ZIP réussi : fonctionnement normal sans activation, activation via les paramètres et confirmation, recherche, sélection d’un seul fichier, ajout et désactivation. Capture du sélecteur inspectée visuellement.
- Premier passage complet Electron : 33 réussis et un échec sur le texte d’avertissement normal. Texte historique rétabli hors bêta ; les deux contrôles ciblés glisser-déposer/ZIP ont ensuite réussi. Consulter les résultats finaux de préparation pour la suite complète.
- Bundle renderer et paquet EffectCraft contrôlés ; audit npm sans vulnérabilité signalée au moment de la préparation.

## Publication et limites

Windows x64 et Mac Apple Silicon ARM64, macOS 13 minimum. Les paquets finaux doivent provenir du tag immuable v1.4.2 ; les contrôles empaquetés, CI et empreintes de distribution sont consignés après construction. Le numéro du paquet seul ne prouve pas que la release est publique.

Le gain réel de quota fournisseur n’est pas mesuré. Les appels IA et les contenus effectivement consultés restent facturables. L’index local est temporaire et borné à 128 Mo ; un redémarrage, une expiration après deux heures sans lecture ou une éviction demande un nouvel envoi. Les documents ne déclenchent aucune commande sur le PC. La sélection ZIP filtre les entrées avant décompression ; une erreur n’envoie pas un aperçu binaire global qui exposerait des éléments exclus.

Le Mac reste en bêta, signé ad hoc et non notarisé. L’application propose le téléchargement Mac ; les mises à jour Windows utilisent latest.yml. Aucun paquet Mac Intel ni portable Windows publié.
