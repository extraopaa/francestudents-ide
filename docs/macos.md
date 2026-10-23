# Version macOS bêta

> [!IMPORTANT]
> La version 1.3.4 utilise Electron 45 et nécessite **macOS 13 (Ventura) ou plus récent**. Les bêtas 1.3.3-mac.1 et mac.2 ont été construites avec l’ancien moteur.

[← Les guides](README.md) · [Installation](installation.md) · [Connexion](connexion.md)

Choisis **arm64** pour une puce Apple Silicon, ou **x64** pour un Mac Intel. Le DMG s’ouvre avant de déplacer l’application dans Applications.


Le studio et la distribution Mac restent en bêta. À partir de la version 1.3.4, les fichiers Mac accompagnent la version Windows dans la même release. Elle affiche un avertissement bêta à chaque démarrage.

- Apple Silicon : choisir le fichier `mac-arm64.dmg`.
- Intel : choisir le fichier `mac-x64.dmg`.
- Ouvrir le DMG et déplacer FranceStudent IDE dans Applications.

La version utilise une signature locale ad hoc, vérifiée dans le DMG, mais elle n’est pas notariée par Apple. Cette signature contrôle l’intégrité ; elle ne constitue pas une approbation d’Apple. macOS peut demander une autorisation dans Réglages système > Confidentialité et sécurité. À partir de la bêta 1.3.3-mac.2, l’IDE vérifie les nouvelles versions au démarrage puis toutes les quatre heures si la préférence de mise à jour est activée. Le bouton de téléchargement ouvre le bon DMG pour Intel ou Apple Silicon dans le navigateur. L’installation reste manuelle : ouvre le DMG et remplace l’application dans Applications. La bêta précédente doit être remplacée une première fois manuellement pour obtenir cette fonction.

Le workflow `release-mac.yml` construit chaque architecture sur un runner natif, lance les tests unitaires puis vérifie le terminal, le vrai moteur EffectCraft, le rendu d’image, la sauvegarde, les modes Simple/Avancé et le chat plein écran dans l’application empaquetée. Les captures et empreintes accompagnent les artefacts Actions.

Les préversions dont le numéro contient `-mac.` ne déclenchent pas la publication Windows. Les fichiers Windows déjà publiés restent inchangés.
