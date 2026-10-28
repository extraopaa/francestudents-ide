# Changelog

## [1.5.2] — Liaison GitHub plus claire

- Le connecteur explique que le dossier ouvert doit être un dépôt Git et que la liaison ne télécharge pas les fichiers.
- Une confirmation est demandée avant de remplacer le remote origin existant depuis le connecteur.
- Le message d’erreur est plus explicite lorsque le dossier n’est pas un dépôt Git.
- L’agent traite mieux les déclarations erronées d’inaccessibilité du projet et signale clairement une tâche incomplète si le modèle persiste.

## [1.5.1] — Fournisseurs personnalisés en bêta

- Ajout de profils personnalisés avec nom, modèle, URL et clé API.
- Les clés sont conservées dans le coffre sécurisé du système et ne sont jamais exposées au renderer.
- Le routage compatible OpenAI est disponible depuis le sélecteur de modèle.
- Le compte FranceStudent et son fonctionnement restent inchangés par défaut.

## [1.5.0] — Pièces jointes PDF plus fiables

- Les PDF mal classés dans la file d’images sont automatiquement redirigés vers le traitement local des documents.
- L’IDE n’envoie plus un PDF à la route réservée aux images PNG/JPEG/WEBP.
- Les erreurs HTTP 400 de pièce jointe ne sont plus présentées comme une incompatibilité du protocole d’outils.

## [1.4.9] — Outils agent plus fiables

- Les appels d’outils natifs complets sont récupérés même si le fournisseur ajoute une erreur de flux générique.
- Les erreurs de protocole restantes sont présentées sans suspendre abusivement les résultats déjà reçus.

## [1.4.8] — Questions et interface plus lisibles

- Les questions interactives tolèrent les choix incomplets ou mal formés et basculent proprement vers une réponse libre au lieu de suspendre la tâche.
- Les consignes et commandes des questions sont affichées sur plusieurs lignes, avec les séparateurs de commandes lisibles.
- Les onglets Conversation, Activité et Usage disposent d’un espacement et d’une zone cliquable cohérents.
- Le quota du compte s’actualise automatiquement toutes les cinq requêtes modèle sans ajouter de requête au modèle.

Historique du fork d’amélioration de **extraopaa**. **FranceStudent IDE est un projet de [EsteG7](https://github.com/EsteG7/francestudents-ide).** La numérotation du fork est indépendante des tags historiques du dépôt amont.

## [1.4.7] — Plans agent et suppressions plus fiables

- Les mises à jour de plan acceptent les formats de réponse courants des modèles ; les longues listes sont limitées localement et un plan vide ne bloque plus le travail.
- L’agent reçoit une consigne multiplateforme claire : supprimer avec l’outil sécurisé de l’IDE, jamais une commande shell dépendante de Windows ou Unix.
- Aucun appel IA supplémentaire n’est ajouté pour normaliser un plan.

## [1.4.6] — Reprises agent moins coûteuses

- Après un conflit de flux (HTTP 409), le nouveau fil reçoit la tâche et les résultats récents sans renvoyer l’index complet du projet.
- Une réponse d’outil invalide reçoit au plus la correction déjà prévue. Si le protocole reste invalide, l’IDE explique localement le blocage au lieu de lancer une requête modèle supplémentaire en lecture seule.
- Si l’agent affirme sans preuve qu’il ne peut pas accéder aux fichiers du projet sélectionné, l’IDE vérifie une fois le dossier localement puis lui demande de poursuivre ; un refus utilisateur ou une véritable erreur d’accès n’est jamais contourné.

## [1.4.5] — Dictée locale et quota mieux maîtrisé

- Dictée vocale transcrite sur l’ordinateur avec Whisper et le processeur, sans envoyer l’audio à FranceStudent ni consommer le quota. Le modèle (environ 100 Mo) est téléchargé une fois avant l’accès au micro ; la transcription reste un brouillon modifiable.
- L’ouverture d’un projet et les changements de fichiers mettent à jour l’index local sans appel IA. La génération d’un résumé IA est explicite avec `/index` et réutilise le cache.
- Le moteur local est isolé dans un worker annulable ; l’audio et les échantillons sont effacés après traitement.

## [1.4.4] — Moins de répétitions, des connecteurs mieux guidés

- Lorsqu’un modèle nie l’accès à une application MCP sans l’avoir essayé, récupération locale du schéma réel d’un outil avant la reprise unique. Validation, hooks, annulation et affichage habituels conservés ; aucune commande de l’application exécutée automatiquement par cette découverte. Pas de reprise en mode plan/Éco ni après un refus ou une tentative réelle, y compris dans un lot.

- Images classiques : uploads identiques réutilisés uniquement au sein du même envoi ; copies strictement identiques transmises une seule fois à la vision, avec correspondance explicite des positions d’origine. Aucun rééchantillonnage supplémentaire ni cache interconversation ; un nouvel envoi explicite est toujours traité.
- Ajout des pièces jointes sérialisé pour éviter les traitements concurrents ; même nom et même taille ne suffisent plus à supprimer un fichier dont le contenu diffère. Les petites lectures restent inchangées si une référence serait plus coûteuse que leur contenu.
- Analyse IA automatique du projet rétablie à la demande du contributeur : reprise du résumé inchangé, actualisation des seuls fichiers modifiés, /index pour forcer. Cette analyse peut consommer du quota.
- Consommation : lectures répétées identiques référencées dans la même conversation, sans modifier les résultats conservés ni les prompts de reprise. Gros JSON MCP/EffectCraft minifiés sans changer chaînes ou nombres ; journaux de vérifications réussies allégés avec détail complet accessible localement. Échecs et avertissements gardent leur traitement détaillé.
- Pièces jointes locales généralisées : sélection des ZIP et indexation ciblée automatiques pour tous, avec repli classique si la préparation locale est indisponible. Annuler la sélection n’envoie rien ; un index plein conserve les pièces déjà actives. Suppression de l’ancien réglage bêta.
- Préchargement des fichiers cités limité à un premier extrait de 160 lignes ; l’agent conserve les outils pour lire toute la suite selon le besoin.
- Fiabilité : erreurs de canal MCP contenues, appels dont le résultat est incertain non répétés automatiquement dans la tâche, véritables erreurs MCP signalées comme échecs. Correction des réponses d’outils invalides limitée au budget du protocole, sans relances réseau aveugles ni repli supplémentaire payant.
- Réponses SSE/MCP et arguments d’outils bornés pour limiter les risques de saturation mémoire ; événements SSE invalides rejetés avec une erreur lisible.
- Pour les captures MCP avec GPT 6.1 Sol uniquement : question courte de réception, réponse Oui/Non, sans description ni JSON obligatoires. Les autres modèles et pièces jointes conservent leur contrôle visuel existant. Une réception confirmée n’est pas présentée comme une description du contenu.
- Traduction des appels natifs OpenAI portant le nom d’un outil MCP disponible en appels `mcp_call` locaux, avec les permissions et l’isolation Code/Motion habituelles. Les noms ambigus ne sont pas choisis automatiquement.
- Lecture des appels `tool_calls` Chat Completions en plus des événements Responses, sans exécuter d’appel incomplet.
- Exemple concret de découverte MCP dans les nouvelles demandes ; une description de schéma ne compte plus comme une connexion vérifiée à l’application. Reprise unique conservée, sans boucle de relances.

## [1.4.3] — Ouvrir le projet sans consommer de quota IA

- Ouverture du projet sans génération IA automatique de RESUME.md : index local et cache existant uniquement ; résumé IA sur demande explicite avec /index, hors bêta également.
- Quota épuisé au démarrage : l’échec du résumé IA du projet est présenté dans la carte de quota, avec compte à rebours et vérification du reset. Le contexte partiel est expliqué ; le message technique reste replié.

## [1.4.2] — Pièces jointes locales en bêta expérimentale

- Fonction proposée uniquement via une option « Bêta expérimentale » dans les paramètres, désactivée par défaut et réversible ; traitement habituel conservé pour les autres utilisateurs.
- Choix des fichiers d’un ZIP avant l’envoi : inventaire local, recherche, cases à cocher et sélection globale ; aucun fichier non sélectionné transmis à l’agent.
- Archives et gros textes conservés dans un index local en mode agent : seuls l’inventaire et les passages demandés sont envoyés. Extraction, recherche et pagination sans appel IA ; images des archives envoyées sur demande seulement.
- Lecture complète toujours possible par blocs via `read_attachment`, avec séparation Code/Motion. Aucun modèle local à télécharger ni commande fournie par le document à exécuter.

## [1.4.1] — Un chat plus clair, des échanges plus légers

- Suppression de la jauge de contexte du chat et de son actualisation périodique ; la compaction automatique et le suivi du quota dans Usage restent disponibles.
- MCP et modèles OpenAI : rappel que les connecteurs sont exécutés par l’IDE, et une reprise unique lorsqu’un modèle déclare ne pas avoir accès à une application du catalogue sans avoir essayé MCP. Aucun contournement d’un refus ou d’un échec réel ; pas de reprise supplémentaire en mode Éco.
- Quota : nouvelles demandes allégées dans une conversation déjà initialisée, sans répéter le catalogue d’outils et les consignes inchangées. Réinitialisation au changement de configuration ou de conversation ; plus de relecture automatique du fichier actif ni de listing racine à chaque suivi. La demande utilisateur reste intégrale.
- Captures MCP : lecture du JSON visuel entouré de texte, une seule reformulation automatique sans renvoyer l’image si le format est incorrect, et suppression du double affichage des erreurs de soumission. Un accès visuel non confirmé reste signalé.
- ZIP joints au chat : conservation des fichiers lisibles lorsqu’une entrée est trop grosse ou illisible, avertissement explicite de lecture partielle et repli local sur 7-Zip pour les compressions ZIP non prises en charge par le premier lecteur.
- Plan de travail unique : compteur, progression et étapes mieux présentés, sans copie supplémentaire dans le fil ; les mises à jour conservent l’état ouvert/replié et le plan reste disponible dans l’historique/export.
- Import de skills ZIP : mêmes exclusions que les dossiers pour les dépendances, `.git` et métadonnées macOS, avant lecture des ressources et calcul de leurs limites.
- Plein écran Code/Motion sur toute la largeur et la hauteur utiles, sans centrage étroit ni barres latérales superflues.
- Un seul en-tête de conversation ; suppression du libellé Agent et de la barre projet/accès en doublon. L’accès reste réglable près de la saisie.
- Favoris, export, import Codex, mode Éco et options secondaires regroupés dans le menu Outils du chat ; informations de session repliables, sans perte d’historique.

## [1.4.0] — Un chat plus pratique, un environnement adapté

- Import local de skills téléchargés : fichier SKILL.md, dossier avec ressources ou archive ZIP, avec aperçu, choix de destination et activation explicite après installation.
- Environnement WSL optionnel par projet : commandes de l’agent, tâches, serveurs, diagnostics, Git en lecture et nouveaux terminaux utilisent la distribution Linux choisie. Vérification du dossier et des outils avant activation, adaptation des chemins et du prompt Linux, arrêt ciblé des groupes de processus sans fermer toute la distribution.
- Réglage de réflexion directement dans le chat pour les GPT compatibles connus. Niveaux filtrés par modèle et par l’API FranceStudent ; préférence du compte lue et enregistrée via gptReasoning, avec confirmation serveur et indication du coût potentiel.
- Choix du terminal intégré : PowerShell Windows, PowerShell 7 si installé, cmd ou WSL avec distribution au choix ; shell système, bash ou zsh sur Mac. Préférence persistante pour les nouveaux terminaux, sans interrompre les sessions ouvertes.
- Consigne commune Code/Motion : exploiter les pièces jointes transmises sans rechercher leur original sur le PC, même en accès complet ; signaler un contenu inaccessible au lieu de parcourir les dossiers personnels.
- Choix du niveau d’accès depuis la saisie du chat : sur approbation, automatique ou accès complet, avec descriptions et mémorisation optionnelle, synchronisé avec les paramètres.
- Choix du modèle directement dans la saisie du chat et jauge du contexte de la conversation active, distincte du quota du compte, en Code et Motion.
- Dictée vocale en bêta : microphone sur activation explicite, transcription FranceStudent puis insertion dans le brouillon sans envoi automatique ; annulation, durée limitée à 2 minutes et gestion de la permission micro sur Mac.

- Questions interactives déclenchées par l’agent pendant les tâches : QCM, sélection multiple ou réponse libre, avec bouton Passer. L’agent reçoit la réponse puis reprend ; Full accès ne répond pas automatiquement aux questions.

- Fin du support Mac Intel : les prochains paquets Mac et la validation native ciblent uniquement Apple Silicon ARM64. La 1.3.5 reste archivée pour Intel ; aucun installateur incompatible n’est proposé par le vérificateur mis à jour.

- Répertoire de codes `FST-…` et message au redémarrage après un arrêt inattendu, avec raison disponible et diagnostic copiable. La cause reste explicitement inconnue si elle n’a pas pu être enregistrée.
- Journal technique local limité à 50 événements, sans messages, fichiers, jetons ni traces complètes ; aucun envoi automatique.
- Gestion des erreurs de connexion du terminal Windows, protection des envois à une fenêtre fermée et récupération contrôlée de l’interface après son arrêt.
- Affichage des réponses en flux regroupé ; les très longs messages restent complets dans un rendu texte léger. Le tampon initial des terminaux est borné.
- Fermeture : une erreur de nettoyage ne bloque plus les autres opérations d’arrêt.

## [1.3.5] — Quota et suivi du plan

- Suivi du plan commun à tous les modèles en Code et Motion : état du plan rappelé à chaque tour et cases actualisées depuis les réponses normales de l’agent.
- Suivi du plan intégré aux réponses normales : aucun appel supplémentaire uniquement pour les cases. Une erreur ou une interruption ne coche pas automatiquement les étapes restantes.
- Toutes les cinq requêtes de l’agent, un bref « Où en es-tu ? » demande une actualisation du plan dans le message déjà envoyé, sans appel supplémentaire.
- Consommation : messages de suivi allégés, catalogues et consignes initiales non répétés à chaque tour ; journaux longs raccourcis en conservant le début, la fin et les métadonnées d’erreur.

## [1.3.4] — Sécurité et migration des profils

- Sécurité : Electron 45.0.0, retrait des dépendances vulnérables et audit complet bloquant dans les workflows.
- Chiffrement système des connexions GitHub et des cookies FranceStudent, avec migration automatique des anciens profils.
- Vérification de la fenêtre et du frame émetteurs de tous les appels IPC natifs.
- Compatibilité : macOS 13 minimum ; signature ad hoc et vérification des signatures jusque dans les DMG.
- Migration testée des anciens identifiants, réglages et historiques, sans modification de l’identité de mise à jour.

- Carte rouge « Conversation verrouillée » pour CHAT_LOCKED et les signalements du fournisseur, avec explication, indication d’ouvrir un nouveau chat et bouton « J’ai bien compris ». Aucun nouveau chat ni renvoi de demande n’est déclenché par ce bouton.

## [1.3.3-mac.2] — Mises à jour Mac

- Détection des nouvelles versions Mac au démarrage et toutes les quatre heures, selon la préférence de mise à jour.
- Téléchargement du DMG correspondant au Mac Intel ou Apple Silicon depuis le chat de démarrage et les réglages ; installation manuelle.
- Les préversions Mac sont reconnues sans proposer de version antérieure ni de fichier Windows.

## [1.3.3-mac.1] — Bêta macOS

- Installateurs Mac Intel et Apple Silicon, avec tests sur chaque architecture.
- Message bêta à chaque démarrage sur Mac.
- Publication Mac séparée ; les fichiers Windows v1.3.3 restent inchangés.


## [1.3.3] — 23 octobre 2026 · FranceStudent IDE et interface simplifiée

- Guide de reprise pour les contributeurs et assistants IA : point d’entrée AGENTS.md, contexte commun, repères d’architecture, tests et publication. Entrées légères Claude, Gemini et Copilot sans duplication de l’historique privé. Le workflow Windows lit désormais le nom attendu de l’installeur dans package.json.
- Validation générale : tests unitaires exécutés dans des dossiers de données isolés par processus, pour ne plus dépendre des préférences réelles de l’utilisateur ni les modifier. Protection des titres des anciennes conversations lors du passage au titrage IA.
- Identité visuelle commune aux fenêtres Mode Éco, import Codex, GitHub, skills, MCP et confirmations. En-têtes illustrés, sections, champs et boutons harmonisés, actions accessibles pendant le défilement, dispositions adaptées aux petites fenêtres. Remplacement des confirmations natives par des fenêtres de l’IDE, avec annulation au clavier.
- Application renommée FranceStudent IDE, avec conservation du dossier de données existant et de l’identité de mise à jour.
- Court écran de nouveautés au premier lancement de chaque version installée, consultable à nouveau dans les paramètres. Résumé embarqué, sans requête réseau supplémentaire.
- Cartes illustrées pour les erreurs API, avec explication et détail technique repliable. Quota épuisé : compte à rebours en heures/minutes et bouton « J’ai reçu un reset », confirmé uniquement par l’API. Actualisation silencieuse toutes les 15 minutes et vérification à l’échéance connue.
- Conversations récentes présentées en cartes, regroupées par date, avec titres courts proposés dans les réponses de l’agent sans requête supplémentaire. Les titres personnalisés sont préservés.
- Nouvelle conversation : effacement du chat visible en code comme en motion, sans supprimer les conversations sauvegardées.
- Skills : bouton Installer clarifié, remplacé après installation par Désinstaller en rouge. Action disponible dans les bibliothèques code/motion et les téléchargements communautaires associés.
- En-tête EffectCraft harmonisé, commandes de lecture plus lisibles ; retrait du bouton Agent redondant dans la barre latérale et des limites techniques du compte dans Usage.

## [1.3.2] — 23 octobre 2026 · Isolation motion, historique et vision MCP

- Vision MCP : les captures et ressources images renvoyées par les serveurs (notamment Roblox) sont préparées et jointes à la prochaine requête visuelle, au lieu d’être remplacées par du texte « non affiché ». Réception vérifiée par le circuit de vision existant ; une image invalide produit une erreur explicite sans masquer les autres résultats.
- Réouverture lisible des conversations : les anciens prompts techniques sont remplacés par la demande réelle, les tours internes sont masqués et les réponses/outils retrouvent les cartes du chat. Correction appliquée aussi aux historiques API déjà mis en cache ; les journaux complets des nouvelles conversations sont conservés.
- Isolation du motion design : contexte, outils, rendus, skills de projet, activité et historique distincts du code. Aucun chargement du dossier, des instructions, du profil, des hooks ou des serveurs MCP du projet code dans une tâche EffectCraft. Les outils de fichiers et de shell sont bloqués dans le chat motion, même en Full accès.
- Toute erreur « maximum token limit » déclenche la compaction et une tentative de reprise, quel que soit le plafond annoncé, même sans valeur numérique. Prise en charge des erreurs HTTP et des erreurs reçues dans le flux SSE.
- Plein écran du chat motion : l’éditeur EffectCraft ne recouvre plus le chat. Sortir du plein écran retrouve la composition et le brouillon ; changer d’espace rétablit l’affichage normal.

## [1.3.1] — 23 octobre 2026 · Skills motion, contexte et historique

- Nouvel onglet Motion design dans le centre d’extensions, accessible aussi par le bouton Skills d’EffectCraft. Le marketplace code SkillsMP reste séparé et conserve sa recherche habituelle.
- Huit skills natifs hors ligne : titres, logos, transitions, mouvements fluides, réseaux sociaux, infographies, sous-titres et export.
- Cinq skills de la collection officielle Remotion, sélectionnés selon les installations affichées sur Skills.sh au 23 octobre 2026 : bases, rendu, création, sous-titres et animation/mise en page. Source du classement et compatibilité affichées.
- Import Remotion avec ses ressources annexes, depuis une archive épinglée et vérifiée par SHA-256. Aperçu obligatoire, annulation et installation désactivée conservés. La recherche SkillsMP habituelle importe toujours seulement le SKILL.md.
- Catalogues de l’agent adaptés au moteur : EffectCraft dans le chat motion, Remotion dans le chat code. Aucun skill n’est installé automatiquement.
- Images : suppression de la question de mémoire périodique. Description visuelle vérifiée une seule fois à la réception ; images non renvoyées sur les tours suivants. Cette réception initiale utilise une requête par lot d’images. Un refus de vision est signalé avant d’exécuter la tâche.
- Compaction : suivi distinct de chaque conversation, restauration à la réouverture et consultation de l’occupation serveur pendant les tâches. L’erreur « maximum token limit of 250000 » déclenche une compaction et une reprise ; la limite réelle est mémorisée par modèle et service. Une reprise échouée conserve l’identifiant initial.
- Historique visible enregistré localement avec les messages, actions et résultats, indépendant du contexte compacté. Réouverture complète et récupération des anciens messages via l’API si aucun journal local n’existe. Les actions anciennes non conservées par le serveur ne peuvent pas être recréées.

## [1.3.0] — 23 octobre 2026 · EffectCraft piloté par le chat motion design

- Remplacement du studio canvas natif par le véritable éditeur EffectCraft 0.16.0, reconstruit depuis une révision épinglée avec une interface interne adaptée à FranceStudent. Sources des modifications et procédure de compilation incluses.
- Mode Simple par défaut : quatre outils lisibles, une grande composition et une timeline allégée. Le bouton Avancé retrouve les panneaux et outils complets. Palette, espacements et traductions des panneaux harmonisés avec l’IDE.
- Trois petits tutos : premier titre, mouvement, enregistrement et export. Ils préparent une demande modifiable sans déclencher l’IA ni consommer de quota.
- Chat spécialisé dans l’animation, consignes accessibles aux débutants, actions lisibles et contexte de code exclu des demandes motion.
- Interface harmonisée : thème sombre EffectCraft, en-tête compact, contrôles Lecture / Arrêter / Annuler / Enregistrer, éditeur sur toute la hauteur disponible, chat à droite.
- Conversations, modèles, brouillons et exports de conversation distincts entre code et motion design. Une tâche ou des demandes en attente doivent être terminées avant de changer de chat.
- Outil `effectcraft` pour l’agent : inspection, découverte des schémas de commandes, compositions, calques, textes, propriétés, keyframes, effets, lecture et rendus PNG consultables avec `view_image`. Les confirmations habituelles s’appliquent aux modifications ; Full accès reste disponible.
- Enregistrer sauvegarde dans le stockage local d’EffectCraft. Origine locale stable entre lancements pour retrouver ce stockage ; fermer l’onglet conserve le moteur et le projet ouvert. Le menu File d’EffectCraft permet les imports et copies de projet.
- Compatibilité WebGL activée pour éviter la perte de périphérique WebGPU constatée dans Electron. Les rendus lourds peuvent être plus lents ; l’intégration reste en bêta.
- Vérification du terminal PowerShell et du véritable moteur dans le paquet Windows 1.3.0. Test Electron avec des réponses IA contrôlées : création de composition, ajout d’un titre, rendu PNG, sauvegarde, modes Simple / Avancé, tutos et conservation du projet au retour dans l’onglet.

## [1.2.1] — 22 octobre 2026 · Studio motion design natif et message de budget épuisé

- Onglet **Motion design** : nouveau studio natif qui ne dépend plus d’EffectCraft. Il s’appuie sur un moteur sans DOM (easings, interpolation de keyframes, presets) couvert par des tests automatiques. Le rendu et l’ergonomie dans l’IDE n’ont pas encore été vérifiés visuellement.
- Message « budget de chat épuisé » (HTTP 429) : au lieu du texte brut avec le JSON de l’erreur, l’IDE affiche une carte intégrée au thème avec l’heure de reprise en heure de Paris, le temps restant et un bloc « Détails techniques » replié. Le CLI et le terminal affichent toujours le message d’origine.
- Limites : 4 tests automatiques étaient déjà en échec avant cette version (runCommand cd/cwd, policy denialReason, 2 confirmations desktop-backend). L’installateur n’est pas signé.

## [1.2.0] — 22 octobre 2026 · Motion design EffectCraft et images moins coûteuses

- Nouvel onglet **Motion design** : intégration d’EffectCraft v0.14.0 (version alpha), chargé depuis `desktop/vendor-effectcraft`. Ce dossier n’est pas versionné ; il se télécharge avec `npm run vendor:effectcraft`. Le rendu WebGPU dans Electron et le pilotage de la timeline ne sont pas encore vérifiés.
- Images jointes : elles ne sont plus renvoyées automatiquement à chaque requête de la même conversation. Toutes les cinq requêtes, l’agent est interrogé (sans images ni outils) pour savoir s’il se souvient encore des images ; en cas de réponse négative, d’hésitation ou d’erreur, elles sont renvoyées. Le découpage en lots de quatre images n’a pas changé.
- Crédits mis à jour pour EffectCraft.
- Limites : la mémoire des images dépend du modèle et du fournisseur ; la question de contrôle consomme une petite requête.

## [1.1.7] — 22 octobre 2026 · Interface harmonisée et connecteur GitHub bêta

- Refonte visuelle de l’espace de travail : couleurs, espacements, boutons, navigation, accueil, chat, cartes, dialogues et panneaux cohérents. Meilleure adaptation aux petites fenêtres.
- Catégories dans les paramètres, recherche dans toutes les sections et focus clavier visible.
- Désinstallation accessible depuis la bibliothèque et les skills installés, avec confirmation et conservation dans `.trash`. Les connexions MCP peuvent être retirées ; leur programme externe n’est pas désinstallé.
- Téléchargements de skills : progression réelle en octets, annulation et nouvelle tentative. Les instructions restent consultables avant installation, désactivées par défaut pour les skills communautaires.
- Connecteur GitHub **Bêta** : consultation des dépôts, issues, PR et releases ; brouillons de release, ajout de fichiers et publication explicite. L’agent peut lire et modifier des fichiers distants, créer des commits avec une liste de fichiers, pousser, créer des PR et des issues selon les permissions du token.
- Full accès : bouton d’annulation par action, sans nouvelle confirmation systématique et sans arrêter toute la tâche. Annulation des modifications suivies disponible après l’action ; les effets de commandes ou opérations distantes déjà terminées ne sont pas automatiquement réversibles.
- Images conservées dans les requêtes suivantes de la même conversation, du même modèle et du même projet, jusqu’à quatre images récentes. Les envois en lots conservent les observations visuelles et joignent les quatre dernières images à la demande finale. La vision reste dépendante du modèle et du fournisseur ; renvoyer les images peut consommer du quota.

## [1.1.6] — 22 octobre 2026 · Boutons et suivi de consommation

- Boutons de conversation redessinés : icônes cohérentes, badge Bêta séparé, état du mode Éco et disposition adaptée à la largeur du panneau.
- Jauge de quota cliquable et nouvel onglet Usage avec quota restant, réinitialisation et limites du compte.
- Compteurs de requêtes et tokens de session, avec distinction entre estimations et relevés réels.
- Consultation et actualisation de l’usage pendant une tâche, sans lancer de génération IA ni perdre le brouillon.

## [1.1.5] — 22 octobre 2026 · Liens partagés Codex

- Reconnaissance du format de partage Codex `https://chatgpt.com/s/cx_…`.
- Lecture de l’instantané public chargé par la page, au lieu de rechercher la conversation dans un HTML vide.
- Import des messages utilisateur, commentaires et réponses de l’agent dans l’ordre, sans appliquer les différences de fichiers ni importer les résumés internes.
- Exemple de lien et documentation de l’import actualisés. Correction vérifiée sur un lien réel et couverte par un test de régression.

## [1.1.4] — 22 octobre 2026 · Fichiers, mode Éco et reprise de conversation

- Prise en charge élargie des fichiers : PDF, SVG, documents Office, présentations, tableaux, archives et extraction de contenu avec signalement des limites.
- Glisser-déposer et pièces jointes nombreuses envoyées en lots ; avertissement de quota dès cinq fichiers.
- Mode Éco avec explication avant activation, contexte automatique réduit et agent limité à quatre tours.
- Import de conversation Codex en bêta pour continuer dans le projet déjà ouvert avec un autre modèle.
- Historique repositionné dans la fenêtre, noms des modèles et confirmation de suppression désactivable.
- Boutons Démarrer, Arrêter et Ouvrir le site dans les réponses contenant une commande de serveur local reconnue.
- Récupération des appels d’outils locaux rejetés par le backend et diagnostics réseau plus précis.
- Compaction du contexte adaptée au modèle sélectionné.
- Choix de mise à jour au démarrage et README simplifié, accompagné d’un guide avancé.

Installateur Windows x64 avec les fichiers nécessaires aux mises à jour. Les versions portables restent locales.

## [1.1.3] — 22 octobre 2026 · Navigateur local, images et pièces jointes

### Navigateur et interface

- Serveurs localhost ouverts dans un onglet Chromium indépendant, avec une barre inspirée du Simple Browser de VS Code : adresse, précédent/suivant, actualiser et ouverture externe.
- Ouverture depuis les liens du chat, du terminal et le champ d’adresse de l’ancien aperçu.
- Stockage local, appels API et WebSockets fonctionnels, même pour les pages refusant l’affichage en iframe.
- Message d’erreur et bouton Réessayer quand le serveur est indisponible ; retour aux onglets de code sans perdre leur contenu.
- Écran de démarrage du chat réorganisé : cartes alignées, icônes homogènes et actions de contexte lisibles.
- Enregistrement automatique du modèle par défaut à la sélection, avec confirmation dans les paramètres et conservation après redémarrage.

### Images et captures de l’agent

- Préparation commune des images avant téléversement, y compris les captures ouvertes par `view_image` : copie limitée à 6000 pixels par côté et 5 Mo, original conservé.
- Correction du refus Claude pour les captures dépassant 8000 pixels ; reprise textuelle possible si une ancienne image hors limites reste dans l’historique serveur.
- Dimensions et avertissement de lisibilité renvoyés à l’agent après réduction d’une capture.
- Avertissement pour les pièces jointes du chat fortement réduites ou compressées ; confirmation avant envoi avec conservation du brouillon en cas d’annulation.
- Arrêt des relances répétées pour les erreurs de requête définitives du fournisseur.

### File d’attente

- Prompts accompagnés de fichiers et d’images, modification des pièces jointes et affichage de leurs noms dans la file.
- Conservation locale des pièces jointes avec leur tâche après redémarrage, stockage séparé et borné.
- **Orienter** transmet aussi les fichiers à la prochaine étape de l’agent ; une consigne non transmise reste en attente si la tâche s’arrête.
- Nettoyage des fichiers liés lors du retrait d’une demande ou de l’effacement des tâches terminées.

### Distribution

- Validation : 562 tests unitaires réussis, 3 ignorés et 12 parcours Electron réussis. Démarrage et redimensionnement d’une grande capture vérifiés dans le paquet Windows.
- Installateur Windows x64, `.blockmap`, `latest.yml` et empreinte SHA-256 sur GitHub. Les versions portables restent exclusivement locales.
- Projet original de **EsteG7** ; cette version est une amélioration du fork maintenu par extraopaa.

## [1.1.2] — 22 octobre 2026 · Images et démarrage

- Correction du prompt d’agent qui excluait à tort les capacités d’image.
- Indication explicite des pièces jointes visuelles dans la requête, sans inventer de description si la vision est indisponible.
- Validation de l’UUID d’image renvoyé par le téléversement ; erreur visible plutôt qu’une pièce jointe invalide.
- Conservation des téléversements réussis en cas d’échec d’une image suivante.
- 26 tests ciblés validés, dont le parcours image, les relances et les appels en arrière-plan.
- Lecture réelle de deux images de contrôle vérifiée sur le modèle API `gpt-5.6-terra`, en chat puis avec le protocole Agent. Les autres modèles n’ont pas été vérifiés individuellement.
- Écran de chargement au démarrage avec vérification des mises à jour, bouton pour continuer et délai limité en cas de service indisponible.
- Recherche des versions publiées aussi en mode portable, sans installation automatique.
- Suppression du sélecteur Agent / Plan de la saisie : les demandes utilisent directement le mode Agent.
- Sept tests ciblés de mises à jour validés ; démarrage, vérification publique, bouton de passage et délai de secours vérifiés dans Electron.
- Publication GitHub limitée à l’installateur et aux fichiers de mise à jour ; portable exclusivement local. Le workflow applique désormais cette règle.

## [1.1.1] — Compaction automatique

### Ajouté

- Compaction automatique entre deux appels lorsque le contexte approche de son budget estimé.
- Résumé des consignes, décisions, fichiers, vérifications et travail restant, puis reprise automatique de la demande.
- Récupération par compaction après un refus explicite pour contexte trop long.
- Messages de progression ; historique affiché et prompts en attente conservés.

### Fiabilité

- Conversation conservée si le résumé échoue ou reste vide ; mémoire locale bornée.
- 25 tests ciblés validés : compaction, relances API, annulation et pièces jointes.
- Démarrage du paquet Windows 1.1.1 et présence du code de compaction vérifiés.

### Distribution

- Installateur NSIS Windows x64 et exécutable portable.
- `latest.yml` et `.blockmap` pour les mises à jour de la version installée.
- Empreintes des exécutables dans `SHA256SUMS.txt`.

### À savoir

Seuil par défaut : 80 % d’un budget estimé de 100 000 tokens, réglable par `FS_AUTO_COMPACT_TOKENS`. La fenêtre exacte dépend du modèle ; le service ne la fournit pas. Le suivi du volume repart au redémarrage. La mise à jour complète depuis une installation précédente n’a pas encore été validée de bout en bout sur une release publique.

## 1.1.0 — Agent, cockpit et interface

Version de travail locale précédant la première release publique du fork. Les évolutions sont regroupées sans reconstituer des dates de publication intermédiaires.

### Agent et autonomie

- File de prompts intégrée : édition, suppression, ordre, pause, reprise et orientation.
- Autorisations simplifiées, Full accès et avertissement visible.
- Scripts PowerShell, commandes en arrière-plan et arrêt des processus.
- Recherche autonome, sources, captures et lecture d’images selon le modèle.
- Plan de travail, activité et points de reprise des outils de fichiers.

### Espace de travail

- Cockpit : scripts, commandes personnalisées, sorties, diagnostics et outils locaux.
- Prettier, comparaison, aperçu Markdown et HTML local isolé.
- Symboles, préférences d’éditeur, enregistrement automatique, thèmes et repères.
- Inspection des formats non éditables ; encodages UTF-8 et UTF-16.

### Extensions et compte

- Bibliothèque de skills, profils, import et marketplace SkillsMP.
- Gestion des serveurs MCP stdio et de leurs outils.
- Paramètres recherchables, budgets de contexte, connexion guidée et déconnexion.
- Préparation des mises à jour via GitHub Releases pour la version installée.

## Origine

L’historique du [projet de EsteG7](https://github.com/EsteG7/francestudents-ide) est conservé. L’éditeur, le terminal, le CLI et les intégrations existantes proviennent de cette base.

[1.1.1]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.1
[1.1.2]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.2
[1.1.6]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.6
[1.1.5]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.5
[1.1.4]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.4
[1.1.3]: https://github.com/extraopaa/francestudents-ide/releases/tag/v1.1.3
