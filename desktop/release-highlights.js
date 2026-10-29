"use strict";
// Maintain this short summary with each release. Unknown versions get a safe fallback.
const releases={
    "2.0.2":{headline:"Tu gardes le contrôle de tes points de reprise.",items:[
        {icon:"tools",title:"Activation proposée après la mise à jour",text:"Choisis si l’IDE doit conserver un point de reprise avant les tâches de l’agent."},
        {icon:"chat",title:"Les dossiers exclus restent protégés",text:"release, .frst et les archives asar ne sont pas touchés par une restauration."}
    ]},
    "2.0.1":{headline:"Moins d’erreurs de protocole, plus de travail accompli.",items:[
        {icon:"tools",title:"Réponses du modèle mieux tolérées",text:"L’agent répare les réponses JSON approximatives et relance le modèle avant d’afficher une erreur de protocole."},
        {icon:"chat",title:"Accès aux outils vérifié",text:"Quand le modèle prétend ne pas avoir accès au dépôt ou à GitHub, l’agent vérifie réellement ses outils avant de renoncer."}
    ]},
    "2.0.0":{headline:"Poursuis ton travail sur plusieurs modèles et appareils.",items:[
        {icon:"chat",title:"Change de modèle sans perdre le fil",text:"Les échanges textuels récents accompagnent le changement ; les pièces jointes doivent être ajoutées de nouveau si nécessaire."},
        {icon:"tools",title:"IDE Link en bêta",text:"Retrouve ton agent sur mobile avec un QR code et un PIN temporaire."},
        {icon:"spark",title:"Sauvegardes avant demande",text:"Prévisualise les fichiers concernés avant de restaurer un état précédent du projet."}
    ]},
    "1.5.3":{headline:"L’agent garde mieux le fil de ton travail.",items:[
        {icon:"chat",title:"Demande et plan conservés",text:"Les suivis rappellent la demande et les étapes du plan pour aider l’agent à poursuivre la tâche."},
        {icon:"tools",title:"Accès au projet mieux vérifié",text:"L’agent reconnaît davantage de déclarations erronées et respecte les refus et interruptions réels."}
    ]},
    "1.5.2":{headline:"La liaison GitHub est plus claire et mieux protégée.",items:[
        {icon:"tools",title:"Un dossier Git nécessaire",text:"Le connecteur indique si le dossier ouvert n’est pas un dépôt Git et rappelle que la liaison ne télécharge pas les fichiers."},
        {icon:"chat",title:"Confirmation avant remplacement",text:"Avant de remplacer le remote origin existant depuis le connecteur, une confirmation est demandée."},
        {icon:"tools",title:"Accès au projet mieux signalé",text:"L’agent traite mieux les déclarations erronées d’inaccessibilité et signale si la tâche reste incomplète."}
    ]},
    "1.5.1":{headline:"Teste ton propre fournisseur en toute sécurité.",items:[
        {icon:"tools",title:"Profils API personnalisés",text:"Ajoute un nom, un modèle, une URL et une clé pour utiliser une API compatible OpenAI depuis le sélecteur de modèle."},
        {icon:"spark",title:"Clé protégée localement",text:"La clé est conservée dans le coffre sécurisé du système et n’apparaît ni dans le renderer ni dans les conversations."},
        {icon:"chat",title:"FranceStudent reste inchangé",text:"La bêta est séparée et désactivée tant que tu ne sélectionnes pas un fournisseur personnalisé."}
    ]},
    "1.5.0":{headline:"Tes PDF arrivent au bon circuit dès le premier essai.",items:[
        {icon:"tools",title:"Les PDF sont traités comme des documents",text:"Même après une ancienne session, un PDF ne passe plus par la route réservée aux images. Il rejoint automatiquement la conversion locale et le circuit fichiers."},
        {icon:"chat",title:"Une erreur plus claire",text:"Les refus de pièce jointe ne sont plus confondus avec une réponse d’outil incompatible."}
    ]},
    "1.4.9":{headline:"Les outils de l’agent reprennent sans faux blocage.",items:[
        {icon:"tools",title:"Les appels complets sont récupérés",text:"Un fournisseur peut signaler une erreur après avoir transmis un outil valide. FranceStudent le vérifie et poursuit avec ses permissions habituelles."},
        {icon:"chat",title:"Des erreurs moins brutales",text:"Les résultats déjà obtenus restent visibles et les erreurs de protocole ne sont plus présentées comme une suspension définitive."}
    ]},
    "1.4.7":{headline:"Des plans fiables, des suppressions adaptées à ton système.",items:[
        {icon:"chat",title:"Le plan ne bloque plus ta tâche",text:"Les étapes en texte, sans statut ou trop nombreuses sont adaptées localement, sans requête IA supplémentaire."},
        {icon:"tools",title:"La bonne suppression, sur chaque système",text:"L’agent utilise la corbeille et les confirmations de FranceStudent au lieu d’une commande rm ou del."}
    ]},
    "1.4.6":{headline:"L’agent retrouve ses outils, sans gaspiller ton quota.",items:[
        {icon:"tools",title:"Ton projet reste accessible",text:"Si un modèle affirme à tort qu’il ne peut pas lire le projet ouvert, l’IDE vérifie le dossier puis lui fait reprendre la tâche."},
        {icon:"clock",title:"Des reprises plus légères",text:"Après un conflit de conversation, l’agent reprend sans renvoyer tout l’index du projet. Une réponse d’outil invalide n’entraîne plus de requête de secours supplémentaire."},
        {icon:"chat",title:"Des onglets plus lisibles",text:"Conversation, Activité et Usage ont maintenant de vrais boutons avec plus d’espace."}
    ]},
    "1.4.5":{headline:"Ta voix reste sur ton ordinateur. Ton quota aussi.",items:[
        {icon:"chat",title:"Dicte sans envoyer ton audio",text:"La voix est reconnue localement avec Whisper. Le modèle se télécharge une fois ; le texte apparaît comme brouillon modifiable."},
        {icon:"clock",title:"L’index du projet ne coûte plus de quota",text:"L’ouverture et les changements de fichiers restent locaux. Lance /index si tu veux demander un résumé à l’IA."},
        {icon:"spark",title:"Une transcription annulable",text:"Le traitement reste dans un worker séparé. Ton brouillon et les ressources du projet restent disponibles."}
    ]},
    "1.4.4":{headline:"Moins de répétitions, plus de travail utile.",items:[
        {icon:"clock",title:"Des échanges plus légers",text:"Les lectures identiques et les longs journaux réussis évitent les répétitions inutiles. Les détails restent accessibles à l’agent."},
        {icon:"tools",title:"Tes fichiers préparés sur ton ordinateur",text:"Choisis les fichiers utiles dans un ZIP. La préparation locale devient automatique, avec un retour au traitement classique si nécessaire."},
        {icon:"chat",title:"Des connecteurs mieux guidés",text:"Les modèles reçoivent les vrais arguments des outils MCP. Les erreurs et les actions dont le résultat est incertain sont mieux prises en compte."},
        {icon:"spark",title:"Ton projet analysé automatiquement",text:"L’analyse IA revient à l’ouverture quand elle est nécessaire, avec réutilisation du cache. Cette analyse peut consommer du quota."}
    ]},
    "1.4.3":{headline:"Ouvre ton projet, garde ton quota.",items:[
        {icon:"clock",title:"Aucun résumé IA lancé à l’ouverture",text:"L’IDE prépare un index local et reprend le cache disponible. La génération d’un résumé IA se demande explicitement avec /index."},
        {icon:"chat",title:"Le quota expliqué clairement",text:"Les messages de quota pendant l’indexation affichent une carte lisible, l’heure de reprise et le bouton de vérification d’un reset."},
        {icon:"tools",title:"La bêta reste facultative",text:"Le traitement local expérimental des pièces jointes reste désactivé par défaut. L’indexation sans appel IA à l’ouverture s’applique à tous."}
    ]},
    "1.4.2":{headline:"Teste des pièces jointes plus légères.",items:[
        {icon:"spark",title:"Une bêta au choix",text:"Active Pièces jointes locales dans les paramètres IA pour la tester. Désactivée par défaut : le fonctionnement habituel reste disponible."},
        {icon:"tools",title:"Choisis dans ton ZIP",text:"Recherche et coche les fichiers utiles avant l’envoi. L’inventaire se fait sur ton ordinateur, sans requête IA."},
        {icon:"chat",title:"Le contenu utile, au bon moment",text:"Archives et gros textes restent dans un index local. L’agent peut lire les passages nécessaires et poursuivre jusqu’à la fin."},
        {icon:"clock",title:"PDF page par page",text:"Le texte est extrait localement. Les pages scannées ou demandées visuellement passent par la vision du modèle. Le gain de quota dépend de la tâche."}
    ]},
    "1.4.1":{headline:"Plus de place, moins de répétitions.",items:[
        {icon:"chat",title:"Un vrai chat plein écran",text:"Tout l’espace disponible, un en-tête simplifié et les outils secondaires regroupés dans un menu."},
        {icon:"spark",title:"Un plan unique et lisible",text:"Les étapes, leur état et leur progression restent dans une seule carte, sans doublon dans le fil."},
        {icon:"clock",title:"Des échanges plus légers",text:"Les consignes inchangées ne sont plus répétées à chaque demande. Le gain de quota dépend de la facturation du service."},
        {icon:"tools",title:"Des ZIP mieux lus",text:"Les fichiers lisibles sont conservés si une entrée échoue. Un avertissement précise les limites de la lecture."},
        {icon:"tools",title:"Des connecteurs mieux compris",text:"Contrôle visuel moins fragile et rappel de l’accès MCP pour les modèles qui ignorent un connecteur disponible."}
    ]},
    "1.4.0":{headline:"Ton environnement, tes outils, ton rythme.",items:[
        {icon:"chat",title:"Tout sous la main dans le chat",text:"Modèle, réflexion des GPT compatibles, niveau d’accès et jauge du contexte sont réunis près de la saisie. La dictée vocale arrive en bêta."},
        {icon:"tools",title:"Retrouve tes outils Linux",text:"L’environnement WSL par projet utilise tes outils déjà installés pour le terminal, les commandes de l’agent, les tâches et les serveurs."},
        {icon:"spark",title:"Des questions au bon moment",text:"L’agent peut proposer des choix ou un champ de réponse pendant une tâche. Tu peux répondre ou passer."},
        {icon:"tools",title:"Importe tes skills téléchargés",text:"Choisis un SKILL.md, un dossier ou un ZIP, consulte l’aperçu puis importe les ressources."},
        {icon:"clock",title:"Des incidents mieux expliqués",text:"Un diagnostic local et un code FST apparaissent après un arrêt inattendu. Cette version Mac cible uniquement Apple Silicon."}
    ]},
    "1.3.5":{headline:"Moins de répétitions, un meilleur suivi.",items:[
        {icon:"clock",title:"Des échanges plus légers",text:"Les messages de suivi évitent de répéter les catalogues et consignes. Les longs journaux gardent leurs erreurs utiles."},
        {icon:"chat",title:"Ton plan reste à jour",text:"Les cases sont actualisées dans les réponses de l’agent. Toutes les cinq requêtes, un bref rappel demande où en est le travail."},
        {icon:"tools",title:"Aucun appel dédié aux cases",text:"Le rappel accompagne le message existant. Le gain de quota réel dépend du modèle et de la facturation du service."}
    ]},
    "1.3.4":{headline:"Tes connexions, mieux protegees.",items:[
        {icon:"tools",title:"Moteur mis a jour",text:"Electron 45 corrige des vulnerabilites connues. Sur Mac, macOS 13 minimum est requis."},
        {icon:"chat",title:"Connexions protegees",text:"Les anciennes sessions et connexions GitHub sont migrees vers le coffre systeme disponible."},
        {icon:"spark",title:"Version Mac verifiee",text:"Signature locale et controle de l’integrite du DMG. La version Mac reste en beta, sans notarisation Apple."}
    ]},
    "1.3.3-mac.2":{headline:"Les nouvelles versions Mac, plus faciles a trouver.",items:[
        {icon:"clock",title:"Verification automatique",text:"L’IDE recherche les nouvelles versions Mac au demarrage et toutes les quatre heures."},
        {icon:"tools",title:"Le bon installateur",text:"Un bouton ouvre le telechargement Intel ou Apple Silicon. L’installation reste manuelle."}
    ]},
    "1.3.3-mac.1":{headline:"FranceStudent IDE arrive sur Mac en beta.",items:[
        {icon:"spark",title:"Intel et Apple Silicon",text:"Une application adaptee a chaque architecture Mac."},
        {icon:"tools",title:"EffectCraft et terminal integres",text:"Le studio motion design et le terminal sont verifies dans les applications empaquetees."},
        {icon:"chat",title:"Une premiere beta",text:"Enregistre regulierement ton travail et signale les problemes rencontres."}
    ]},
    "1.3.3":{headline:"Un IDE plus clair, du chat au studio.",items:[
        {icon:"spark",title:"FranceStudent IDE",text:"Un nouveau nom et une interface plus soignée, avec un studio EffectCraft réorganisé."},
        {icon:"chat",title:"Tes conversations, mieux rangées",text:"Des cartes lisibles, des titres proposés par l’IA et un chat vide quand tu démarres une nouvelle conversation."},
        {icon:"clock",title:"Le quota, sans surprise",text:"Erreurs expliquées, compte à rebours de réinitialisation et vérification d’un reset accordé par le staff."},
        {icon:"tools",title:"Des skills plus simples à gérer",text:"Installer ou désinstaller depuis la même carte, avec un bouton rouge pour la suppression."}
    ]}
};
function createReleaseHighlights({version,enabled=true,load,save}){
    return {
        get(){const content=releases[version] || {headline:"Ton IDE continue de s’améliorer.",items:[{icon:"spark",title:"Améliorations et correctifs",text:"Consulte les notes complètes de cette version pour découvrir tous les changements."}]};const settings=load();return {version,...content,shouldShow:enabled && settings.releaseHighlightsSeen!==version,showFileVersionsIntro:enabled && settings.fileVersionsIntroSeen!==true,url:`https://github.com/extraopaa/francestudents-ide/releases/tag/v${encodeURIComponent(version)}`};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;},
        seenFileVersions(){save({fileVersionsIntroSeen:true});return true;}
    };
}
module.exports={createReleaseHighlights};
