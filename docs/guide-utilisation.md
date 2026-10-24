# Bien commencer avec FranceStudent IDE

[← Les guides](README.md) · [Connexion](connexion.md) · [Guide avancé](avance.md)

Un dossier, une idée et une conversation : voici comment démarrer. Les captures utilisent le projet fictif **Aurora**, sans compte personnel.

## 1. Installer et se connecter

Télécharge l’installateur adapté depuis le [guide d’installation](installation.md). L’application installée ne demande ni Node.js ni npm.

Utilise l’adresse e-mail et le mot de passe de ton compte FranceStudent. Aucune clé API n’est nécessaire. [Voir les trois étapes de connexion](connexion.md).

![Le guide de connexion FranceStudent](images/connexion-compte.png)

## 2. Choisir ton espace

| Tu veux… | Ouvre… | Exemple de demande |
| --- | --- | --- |
| Créer un site ou modifier une application | **Code**, avec le dossier du projet | « Présente ce projet et propose une première amélioration. » |
| Préparer une composition ou une animation | **Motion design** | « Prépare un titre pour mon association avec une signature. » |

Les conversations et brouillons Code et Motion sont séparés. L’assistant motion travaille dans son propre espace EffectCraft.

## 3. Faire une demande en mode Code

1. Clique sur **Ouvrir un dossier** et choisis ton projet.
2. Clique sur un fichier pour l’ouvrir dans l’éditeur.
3. Explique ton objectif dans le chat, puis appuie sur **Entrée**.
4. Lis les changements et les éventuelles confirmations. **Stop** interrompt la tâche.

![Un fichier ouvert et le chat Code](images/mode-code.png)

Une consigne précise aide : « Ajoute une navigation accessible et conserve les couleurs actuelles ». **Maj+Entrée** ajoute une ligne sans envoyer le message.

Pendant le travail, les nouvelles demandes s’empilent au-dessus de la saisie. **Orienter** transmet une consigne à la tâche en cours ; **Reprendre** relance une file suspendue. Les pièces jointes restent associées à leur demande.

### Quand l’agent te pose une question

Si une précision est nécessaire, l’agent affiche une carte au-dessus de la saisie : choix proposés, sélection multiple ou champ de réponse libre. Sélectionne ta réponse ou écris la tienne, puis clique sur **Répondre**. **Ctrl+Entrée** valide aussi le texte. L’agent reçoit ta réponse et reprend sa tâche.

**Passer** lui indique que tu ne réponds pas ; ce bouton ne donne aucune autorisation. **Stop** interrompt la tâche. Ces questions restent disponibles en Full accès et figurent dans l’historique. L’agent ne les affiche que lorsqu’il en demande une ; aucun bouton manuel n’est nécessaire pour les déclencher.

## 4. Essayer le mode Motion

Ouvre **Motion design**, garde **Simple** et décris ta composition. **Tutos** prépare des exemples, **Skills** ouvre les méthodes disponibles et **Avancé** affiche les outils complets.

![Le studio EffectCraft et son chat spécialisé](images/mode-motion.png)

**Enregistrer** garde le projet modifiable dans le stockage local du moteur. Pour les travaux importants, conserve aussi une copie du projet et de ses médias. [Parcours Motion](motion-design.md).

## 5. Ajouter les bons éléments

- [Documents et images](attachments.md) : trombone ou glisser-déposer, sans envoi automatique.
- [Conversations Codex](conversation-import.md) : reprendre un échange dans un projet existant.
- [Skills et MCP](extensions.md) : ajouter et gérer des outils spécialisés.
- [Serveurs locaux](server-controls.md) : démarrer, arrêter et ouvrir un site.

## 6. Suivre le travail et le quota

**Conversation** affiche les échanges, **Activité** les actions et **Usage** la consommation. Clique sur la jauge pour ouvrir le détail. [Comprendre les compteurs](usage.md).

Les conversations récentes permettent de reprendre un échange. Une nouvelle conversation vide le chat affiché sans supprimer les précédentes. La compaction allège le contexte de l’IA en conservant le journal visible.

## 7. Garder le contrôle

Commence avec **Demander**, qui conserve les confirmations. **Full accès** autorise l’agent à agir sans question supplémentaire, avec les droits de ton compte, y compris hors du projet selon les outils. Il n’accorde pas de droits administrateur.

![Réglages des autorisations](images/parametres-autorisations.png)

**Annuler l’action** tente d’interrompre l’opération courante ; **Stop** arrête toute la tâche. Les commandes et effets distants déjà terminés ne sont pas toujours annulables.

## Les raccourcis utiles

Sur Mac, utilise **Cmd** à la place de **Ctrl** pour les raccourcis correspondants.

| Raccourci | Action |
| --- | --- |
| Ctrl+O | Ouvrir un dossier |
| Ctrl+P | Aller à un fichier |
| Ctrl+Maj+P | Palette de commandes |
| Ctrl+S | Enregistrer |
| Ctrl+L | Aller à la saisie |
| Ctrl+B | Afficher ou masquer la barre latérale |
| Ctrl+J | Afficher ou masquer le panneau du bas |

Un problème ? Consulte le [dépannage](depannage.md). Pour le terminal, les réglages techniques et la compilation, ouvre le [guide avancé](avance.md).

## Saisie du chat : modèle, contexte et dictée

Le choix du modèle se trouve dans le cadre de saisie, en Code comme en Motion. La jauge de contexte du chat a été retirée. La compaction automatique fonctionne en arrière-plan et conserve l’historique visible. Le suivi du quota du compte reste disponible dans Usage.

Le bouton micro **Bêta** permet de dicter un brouillon. À la première utilisation, confirme l’envoi de l’audio à FranceStudent et autorise le microphone dans ton système. Clique à nouveau pour terminer et transcrire (2 minutes maximum). Pendant la transcription, le bouton permet d’annuler. Le texte est ajouté au brouillon sans envoi automatique. La transcription nécessite une connexion et peut consommer son quota FranceStudent ; annuler après l’envoi ne supprime pas nécessairement le job distant. Les enregistrements ne sont pas sauvegardés localement. Sur Mac, vérifie Réglages Système → Confidentialité et sécurité → Microphone si l’accès est refusé.

Le bouton de niveau d’accès, à côté du modèle dans la saisie, permet de choisir **Sur approbation**, **Automatique** ou **Accès complet**. Le menu explique chaque mode ; une option permet de mémoriser le choix pour les prochaines sessions. Le même réglage reste accessible dans les paramètres et s’applique en Code comme en Motion. L’accès complet autorise aussi les actions hors du projet et approuve les actions déjà en attente ; il ne répond pas aux questions de l’agent à ta place.

## Choisir son terminal, notamment WSL

Dans **Paramètres → Général → Terminal intégré**, choisis PowerShell Windows, PowerShell 7 (si installé), Invite de commandes ou **WSL · Linux**. Pour WSL, sélectionne ta distribution installée (Ubuntu, Debian…) ou conserve sa distribution par défaut, puis clique sur **Enregistrer**. Ouvre un nouveau terminal avec **+** : il utilisera cet environnement et ses packages existants. Les terminaux déjà ouverts sont conservés. Le bouton Actualiser relance la détection si tu viens d’installer un terminal ou une distribution.

WSL doit être installé et initialisé au préalable ; l’IDE ne réinstalle pas ses outils. Un projet Windows est ouvert dans WSL via son montage Linux. Tu peux aussi ouvrir un projet depuis `\\wsl.localhost\Ubuntu\home\ton-nom\projet` dans le sélecteur de dossier ; choisis alors la même distribution que celle du projet. Les chemins vers une autre distribution sont refusés avec une explication.

Sur Mac, le choix propose le shell système et les shells présents dans `/bin`. Ce réglage concerne le terminal interactif et les commandes du terminal simple de secours ; il ne transforme pas l’IDE entier en environnement distant WSL. Les commandes de l’agent, MCP et les autres outils continuent à utiliser leur environnement actuel. Le terminal simple de secours ne conserve pas les variables et sessions d’un shell interactif.

## Régler la réflexion des GPT

Avec un GPT compatible, le bouton **Réflexion** apparaît à côté du modèle dans le chat, en Code et Motion. Choisis Faible, Moyenne, Élevée ou Très élevée ; Désactivée est proposée seulement si le modèle le permet. Les niveaux non compatibles ne sont pas affichés. Un modèle inconnu ne reçoit pas de capacités supposées.

Le réglage est une **préférence du compte FranceStudent**, commune aux conversations GPT et potentiellement aux autres clients connectés au même compte. Il est enregistré par l’API puis relu pour confirmation. Il ne peut pas être modifié pendant une tâche. Un niveau élevé peut augmenter la durée et le quota consommé. Si la valeur du compte est incompatible avec le modèle sélectionné, le bouton indique « à choisir » : aucune préférence n’est remplacée automatiquement. Les autres fournisseurs ne reçoivent pas ce réglage.

## Utiliser ses outils WSL pour tout le travail du projet

Sous Windows, ouvre ton projet puis **Paramètres → Général → Environnement du projet · WSL**. Choisis **WSL · mes outils Linux**, sélectionne ta distribution, puis **Appliquer à ce projet**. L’IDE vérifie qu’il peut ouvrir le dossier dans Linux et affiche les versions de Node, npm et Git trouvées. Aucun outil n’est installé automatiquement.

L’option utilise les outils de cette distribution pour les commandes de l’agent, ses commandes en arrière-plan, les tâches et serveurs du projet, les diagnostics ESLint/TypeScript, la lecture Git et les nouveaux terminaux. Les dépendances déjà installées dans la distribution restent utilisables ; tu n’as pas à réinstaller leurs équivalents Windows. Les outils manquants sont signalés comme tels. Les permissions et boutons d’arrêt restent applicables.

Arrête les tâches et serveurs avant de changer d’environnement, puis ouvre un nouveau terminal avec **+**. Le choix est mémorisé uniquement pour ce projet ; Windows reste le mode habituel des autres projets. Pour revenir en arrière, sélectionne Windows puis applique. Si tu as réglé séparément un terminal WSL par défaut, ce choix de terminal reprend alors effet.

L’interface et l’éditeur restent sur Windows, ainsi que les connecteurs natifs et serveurs MCP configurés pour Windows ; le studio Motion reste indépendant. Le projet peut se trouver sur un disque Windows ou dans `\\wsl.localhost\Ubuntu\home\ton-nom\projet`. Dans ce dernier cas, sélectionne la distribution correspondante. Ce mode requiert une distribution initialisée avec Bash et setsid, et ne migre ni ne copie tes fichiers. Si Node est installé par un gestionnaire de versions, son PATH doit être accessible au shell de connexion Linux utilisé pour les commandes.

## Importer un skill téléchargé

Dans **Extensions → Mes skills**, clique sur **Importer un fichier** pour choisir un `SKILL.md` ou une archive `.zip`, ou sur **Importer un dossier** pour reprendre ses références et scripts annexes. L’aperçu présente les instructions et la liste des ressources. Choisis le nom et la destination, puis clique sur **Importer**. Le skill est ajouté désactivé : active-le ensuite dans Mes skills quand tu es prêt. Aucun script n’est exécuté pendant l’import.

Les dossiers et ZIP doivent contenir un seul skill (un unique `SKILL.md`), avec au maximum 200 ressources et 4 Mo au total. Une collection doit être importée dossier par dossier. Les liens de dossiers ne sont pas suivis ; `.git` et `node_modules` sont exclus. Un SKILL.md choisi seul importe uniquement ses instructions. Un skill existant n’est pas écrasé.

## Chat en plein écran et interface allégée (prochaine mise à jour)

Le bouton d’agrandissement du chat utilise toute la largeur et la hauteur utiles de la fenêtre, en Code et Motion. Il masque l’explorateur, la barre latérale et la barre d’état pendant ce mode ; le bouton de retour reste dans l’en-tête. Échap permet de revenir au projet hors tâche et hors menu ouvert.

L’en-tête réunit Conversation, Activité et Usage avec les actions Historique, Nouvelle conversation et Agrandir. La barre en doublon affichant le projet et l’accès est retirée. Le niveau d’accès reste réglable dans la saisie. Les favoris, l’export, l’import Codex, le mode Éco, l’effacement d’affichage et le choix Agent/Discussion sont accessibles dans le bouton **… Outils du chat**, près des pièces jointes. Les informations de connexion/indexation et le rappel de transmission des données restent consultables dans un bloc de session repliable ; les autres avertissements et erreurs restent visibles.

Le plan de travail apparaît dans une seule carte de suivi : compteur, jauge et étapes avec états distincts. Ses mises à jour remplacent son contenu sans ajouter une nouvelle liste dans le fil. Tu peux le replier ; ce choix est conservé pendant la tâche. Les plans de l’historique restent consultables, et un statut de tâche terminée ne coche pas automatiquement les étapes non vérifiées.
