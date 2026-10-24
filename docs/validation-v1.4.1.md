# Validation de la version 1.4.1

Préparation du 24 octobre 2026. Cette version reprend les binaires Electron 45 et l’identité de données/mise à jour de la 1.4.0. Windows x64 et Mac Apple Silicon ARM64 ; macOS 13 minimum, Mac Intel non construit.

## Contrôles locaux Windows

- 737 tests unitaires : 734 réussis, 3 tests Unix ignorés sous Windows, aucun échec.
- 33 parcours Electron réussis : Code/Motion, plein écran, plan unique, terminal, migration de profil, paramètres, marketplace, questions, historique et autres parcours existants.
- Après retrait de la jauge de contexte : 3 parcours ciblés réussis (compositeur et dictée, plein écran Code/Motion, plan de travail). Capture du plein écran contrôlée visuellement.
- Lint : aucune erreur ; avertissement existant `preserve-caught-error` sur le traitement GitHub de `desktop/main.js`.
- Bundle renderer et paquet EffectCraft vérifiés ; audit npm sans vulnérabilité signalée au moment du contrôle.
- Tests d’intégration simulés : reformulation visuelle unique sans renvoyer les images, arrêt après échec de cette reformulation, réutilisation des instructions entre demandes et renvoi complet après changement de modèle.

## Distribution et contrôles restants

Le paquet final Windows et les artefacts Mac doivent provenir du tag exact de cette version ; les résultats du build et les empreintes sont joints à la release. La préparation n’est pas une preuve de publication : consulter la release et le workflow `Build and test macOS` pour le statut effectif.

Les tests du fournisseur IA et de Blender sont simulés : aucune session personnelle OpenAI/Claude/Blender n’a été utilisée. Le gain réel de quota n’est pas mesuré ; conserver un historique côté serveur peut toujours être facturé par le service. Un accès visuel non confirmé ne devient jamais un succès inventé.

La version Mac est en bêta, signée ad hoc et non notarisée. Les contrôles automatisés sur Apple Silicon ne remplacent pas une validation sur chaque Mac physique. L’application propose le téléchargement Mac ; la mise à jour Windows utilise `latest.yml`.
