# Installer FranceStudent IDE

[← Les guides](README.md) · [Se connecter](connexion.md)

## Choisir le bon fichier

| Ton ordinateur | Téléchargement |
| --- | --- |
| Windows 64 bits | [Release stable](https://github.com/extraopaa/francestudents-ide/releases/latest) : `setup.exe` |
| Mac M1 et suivants | [Bêta Mac](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.3.5) : `mac-arm64.dmg` |

Les prochaines versions Mac nécessitent une puce **Apple Silicon (M1 et suivants)**. Le support Intel s’arrête à la [version archivée 1.3.5](https://github.com/extraopaa/francestudents-ide/releases/tag/v1.3.5) ; ses fichiers existants sont conservés.

Sur Mac, **À propos de ce Mac** indique le type de puce. Pour commencer, choisis le DMG ; le ZIP est une archive alternative.

## Windows

Ouvre l’installateur, choisis son emplacement et lance FranceStudent IDE. Windows peut afficher un avertissement pour cet exécutable sans signature d’éditeur reconnue. Vérifie sa provenance : les releases de ce dépôt.

## Mac · Bêta

La version 1.3.4 requiert **macOS 13 ou plus récent**. Les anciennes bêtas ci-dessus ont été construites avec le moteur précédent.

Ouvre le DMG et déplace **FranceStudent IDE** dans **Applications**. Lance l’application depuis ce dossier. Un message rappelle son statut bêta.

La version n’est pas notariée par Apple. Si macOS bloque l’ouverture, vérifie la provenance du fichier et consulte **Réglages système → Confidentialité et sécurité**. Les protections peuvent varier selon ton ordinateur. [Détails Mac](macos.md).

## Première ouverture

![Guide de connexion au premier lancement](images/connexion-compte.png)

Tu n’as besoin ni de Node.js ni de npm pour utiliser l’installateur. Ces outils concernent le développement de l’IDE ou certains projets. [Continuer avec la connexion](connexion.md).

## Les mises à jour

| Version | Fonctionnement |
| --- | --- |
| Windows installée | Proposition au démarrage ; téléchargement et installation selon les réglages |
| Mac, à partir de la bêta 2 | Détection et bouton vers le bon DMG ; installation manuelle |
| Développement ou portable Windows | Installation manuelle |

Sur Mac, le bouton ouvre le téléchargement dans le navigateur. Ferme l’application avant de remplacer sa copie dans Applications. La première bêta doit être remplacée une fois manuellement pour obtenir la détection des versions suivantes.

Enregistre ton travail avant une mise à jour et garde des sauvegardes de tes projets importants.

Pour compiler toi-même l’IDE, consulte le [guide avancé](avance.md#développer-depuis-les-sources).
