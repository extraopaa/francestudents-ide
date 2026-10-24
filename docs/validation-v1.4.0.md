# Validation 1.4.0

Validation locale sous Windows, Node 24.21.0, le 24 octobre 2026.

- 723 tests unitaires : 720 réussis, 3 hooks Unix ignorés, aucun échec.
- Lint : aucune erreur ; un avertissement existant preserve-caught-error dans le masquage des erreurs GitHub.
- Audit npm : aucune vulnérabilité connue.
- Bundle renderer et paquet EffectCraft compilé vérifiés.
- Parcours Electron : suite générale, contrôles de chat/import local et récupération après crash vérifiés. Les résultats finaux des constructions natives sont ajoutés ci-dessous après compilation.
- Encodage MP3 réel dans un worker Node ; upload et résultat de transcription simulés. Microphone simulé dans Electron, décodage/rééchantillonnage réels et insertion sans envoi dans le brouillon.
- Réglage de réflexion et erreurs API : capacités validées, sauvegarde/relecture simulées dans le parcours UI. Aucun changement de préférence effectué sur le compte personnel.
- Import local : SKILL.md, dossier/ZIP avec références/scripts, refus des collections ambiguës et chemins de traversée, activation explicite et non-écrasement via le centre d’extensions.
- WSL : routage et garde-fous testés avec simulations ; aucune distribution WSL n’est installée sur cette machine, donc aucune session Linux réelle sous WSL n’a été exécutée. Cela reste une limite de validation, pas une garantie de fonctionnement sur toutes les distributions.
- Un lancement parallèle des tests de crash a expiré ; le parcours isolé a réussi. Un lancement en série a révélé une hypothèse trop stricte du test sur le code de sortie de app.exit avec ConPTY, corrigée pour vérifier tout arrêt non propre. Le parcours corrigé a réussi.

Les appels distants (FranceStudent/GitHub), le vrai microphone et une installation par-dessus le profil personnel ne sont pas validés par les simulations. Aucune installation de WSL ni migration de fichiers utilisateur effectuée.

## Résultats locaux finaux

- 31/31 parcours Electron réussis sur la suite finale en série, après correction du menu d’historique et finition des contrôles du compositeur.
- Application Windows empaquetée : parcours EffectCraft, agent motion et terminal réussi.
- Encodeur de dictée exécuté depuis app.asar dans l’exécutable Windows : sortie MP3 de 8 640 octets pour une seconde de PCM, code de sortie 0.
- Installeur Windows 1.4.0 construit ; identité de mise à jour conservée. La construction/signature ad hoc Mac ARM64 est confiée au workflow GitHub du tag et ses résultats restent à consulter avant publication.

## R?sultats GitHub et publication

- CI du commit applicatif 296f78d : succ?s sur Windows, Ubuntu et macOS avec Node 22.
- Construction Mac ARM64 valid?e par le run 40113873528, ? partir du tag immuable v1.4.0, avec harnais de migration born? et keychain de validation isol?e. Tests unitaires, migration, offres de mise ? jour, IPC, paquet EffectCraft/terminal, codesign et int?grit? du DMG r?ussis.
- Le workflow de reprise ne modifie pas les sources applicatives du tag ; seuls les tests utilisent le harnais courant.
- DMG ARM64 : 228 825 588 octets, SHA-256 b08f70405c2851b45c1b9eb621600590137ba522205557413ebdc5503e315125.
- ZIP ARM64 : 220 791 012 octets, SHA-256 08ae14343a17677bc42e5fc13019ac5a89a25a0764242f36a0c07341f83bbdd7.
- Installateur Windows : 190 876 722 octets, SHA-256 1c2b74d941ad1ae02e5b1bfd0e9c0dac13885f3e44cd486faafccb5ffb7191bb.
- Six assets attendus dans la release, avec manifeste SHA256SUMS.txt commun. Mac Intel non construit.

La nouvelle refonte plein ?cran du chat reste une modification suivante, distincte des binaires 1.4.0.

Précision sur le parcours de migration Mac : le harnais borne app.close à 5 secondes et peut terminer le processus Electron de test si le pilote ne confirme pas sa fermeture. La restauration des identifiants et préférences est bien vérifiée après relancement ; cela ne constitue pas une validation manuelle de la fermeture normale sur un Mac physique. Le DMG n’est pas notarisé, conformément au statut bêta documenté.
