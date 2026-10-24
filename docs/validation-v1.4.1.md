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

- Source applicative : tag `v1.4.1`, commit `54bddeefdf0cdfcd743baabb434f0c0cf8431f3b`. Les commits de compte rendu ultérieurs ne changent pas ces binaires.
- Windows : installateur NSIS final construit, application empaquetée démarrée ; vrai terminal PTY et vrai moteur EffectCraft vérifiés. Les 21 fichiers applicatifs modifiés depuis la 1.4.0 correspondent au tag après normalisation des fins de ligne. Les métadonnées `latest.yml` correspondent à la taille et au SHA-512 de l’installateur final.
- Mac ARM64 : [construction 40124696058](https://github.com/extraopaa/francestudents-ide/actions/runs/40124696058) réussie sur ce tag. 737 tests unitaires : 730 réussis, 7 ignorés selon la plateforme. Quatre contrôles d’interface/migration réussis ; application empaquetée, EffectCraft et terminal PTY contrôlés ; signature ad hoc vérifiée dans l’application et dans le DMG monté. Capture du chat Motion plein écran inspectée.
- [CI 40124693454](https://github.com/extraopaa/francestudents-ide/actions/runs/40124693454) réussie sur Windows, Linux et macOS avec Node 22.
- Les SHA-256 du DMG et du ZIP téléchargés correspondent au manifeste du runner. Les tailles et SHA-256 des six assets distribués ont été vérifiés contre les empreintes serveur GitHub avant publication ; le manifeste regroupe les cinq fichiers utiles hors manifeste lui-même.

La [release 1.4.1](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.4.1) est publique (ni brouillon ni préversion). Consulter `SHA256SUMS.txt` pour les empreintes finales.

| Fichier | Taille | SHA-256 |
| --- | ---: | --- |
| FranceStudentIDE-1.4.1-setup.exe | 190893441 | `4642b6f8dbf44e969809c429bbdf8ec9e5f2523f389963acda8ad0657604e7ec` |
| FranceStudentIDE-1.4.1-mac-arm64.dmg | 227341448 | `53eac7ff247e2892bcd446c5871f1cbdc992f3d3ec800654afa2136af707e3a4` |
| FranceStudentIDE-1.4.1-mac-arm64.zip | 219307685 | `be77e2820d40a65bc9a688ca93da582371e358d1c26fbfa31b42805b108365ea` |

Les tests du fournisseur IA et de Blender sont simulés : aucune session personnelle OpenAI/Claude/Blender n’a été utilisée. Le gain réel de quota n’est pas mesuré ; conserver un historique côté serveur peut toujours être facturé par le service. Un accès visuel non confirmé ne devient jamais un succès inventé.

La version Mac est en bêta, signée ad hoc et non notarisée. Les contrôles automatisés sur Apple Silicon ne remplacent pas une validation sur chaque Mac physique. L’application propose le téléchargement Mac ; la mise à jour Windows utilise `latest.yml`.
