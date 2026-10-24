# Validation de la version 1.3.5

Cette version modifie les prompts de suivi et le suivi du plan. Elle conserve Electron 45.0.0, le chiffrement des connexions, l’identité de mise à jour et les dossiers de profil de la version 1.3.4.

## Contrôles ciblés locaux

- Transmission de la progression au panneau d’activité en Code et Motion, sans appel dédié aux cases.
- Bref point sur le plan aux requêtes 5 et 10, compteur incluant les tentatives de correction du protocole.
- Absence de double exécution, conservation du plan existant, compatibilité avec `update_plan`, refus et interruptions sans complétion automatique.
- Reprise : le message complet rétablit les outils, les permissions et les libellés du plan.
- Journaux longs : début et fin conservés, métadonnées d’erreur et troncature présentes, original non modifié.
- Analyse JSON, messages de suivi, observations en lot, rôle Motion, gestion du contexte et notes de mise à jour contrôlés ; lint des fichiers modifiés sans erreur.

Les scénarios utilisent des réponses de modèle simulées. Ils ne constituent pas une validation de chaque fournisseur distant. La baisse de 65 à 76 % concerne la longueur de messages de suivi synthétiques, pas la facturation du service ni le contexte initial de chaque nouvelle demande.

## Construction native

Les installateurs sont construits par le workflow [Security and upgrade validation](https://github.com/extraopaa/francestudents-ide/actions/workflows/security-validation.yml). Les résultats du commit de la release font foi ; la présence du workflow ne prouve pas sa réussite.

Windows et Mac Apple Silicon exécutent le parcours EffectCraft empaqueté, notamment terminal, rendu, sauvegarde et interface. Le runner Intel a une limitation WebGL connue : un échec graphique doit rester visible dans les résultats. La signature et les empreintes sont contrôlées indépendamment après une construction réussie.

## Limites

- Mac en bêta, macOS 13 minimum, sans certificat Developer ID ni notarisation. Une signature d’intégrité valide n’est pas une approbation Gatekeeper.
- EffectCraft sur Mac Intel physique reste à vérifier.
- Démarrage de la version précédente signalé comme réussi par un utilisateur sur M5 ; pas de test physique de cette version par les runners.
- Aucun changement de tarification du service ni garantie sur le nombre de tokens facturés.
