# Version macOS bêta

> [!IMPORTANT]
> La version 1.3.4 utilise Electron 45 et nécessite **macOS 13 (Ventura) ou plus récent**. Les bêtas 1.3.3-mac.1 et mac.2 ont été construites avec l’ancien moteur.

[← Les guides](README.md) · [Installation](installation.md) · [Connexion](connexion.md)

Les prochaines versions prennent en charge **Apple Silicon ARM64 uniquement** : M1 et suivants. Le support Mac Intel s’arrête à la version 1.3.5 ; ses anciens fichiers restent archivés, sans nouvelle mise à jour.


Le studio et la distribution Mac restent en bêta. À partir de la version 1.3.4, les fichiers Mac accompagnent la version Windows dans la même release. Elle affiche un avertissement bêta à chaque démarrage.

- Apple Silicon : choisir le fichier `mac-arm64.dmg`.
- Ouvrir le DMG et déplacer FranceStudent IDE dans Applications.

La version utilise une signature locale ad hoc, vérifiée dans le DMG, mais elle n’est pas notariée par Apple. Cette signature contrôle l’intégrité ; elle ne constitue pas une approbation d’Apple. macOS peut demander une autorisation dans Réglages système > Confidentialité et sécurité. À partir de la bêta 1.3.3-mac.2, l’IDE vérifie les nouvelles versions au démarrage puis toutes les quatre heures si la préférence de mise à jour est activée. Le bouton de téléchargement ouvre le DMG Apple Silicon dans le navigateur. Le vérificateur mis à jour indique la fin du support aux processus Intel, sans leur proposer un paquet ARM64. Les anciennes applications Intel ne sont pas modifiées à distance. L’installation reste manuelle : ouvre le DMG et remplace l’application dans Applications.

Le workflow `release-mac.yml` construit uniquement ARM64 sur un runner Apple Silicon natif, lance les tests unitaires puis vérifie le terminal, le vrai moteur EffectCraft, le rendu d’image, la sauvegarde, les modes Simple/Avancé et le chat plein écran dans l’application empaquetée. Les captures et empreintes accompagnent les artefacts Actions.

**Historique Intel :** la [1.3.5](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.3.5) est la dernière version distribuée pour Intel. Les rapports historiques conservent les limites de validation qui existaient alors ; ils ne décrivent pas les plateformes prises en charge par les prochaines versions.

Les préversions dont le numéro contient `-mac.` ne déclenchent pas la publication Windows. Les fichiers Windows déjà publiés restent inchangés.
