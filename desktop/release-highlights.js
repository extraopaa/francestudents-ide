"use strict";
// Maintain this short summary with each release. Unknown versions get a safe fallback.
const releases={
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
        get(){const content=releases[version] || {headline:"Ton IDE continue de s’améliorer.",items:[{icon:"spark",title:"Améliorations et correctifs",text:"Consulte les notes complètes de cette version pour découvrir tous les changements."}]};return {version,...content,shouldShow:enabled && load().releaseHighlightsSeen!==version,url:`https://github.com/extraopaa/francestudents-ide/releases/tag/v${encodeURIComponent(version)}`};},
        seen(value){if(value!==version)throw new Error("Version de notes invalide.");save({releaseHighlightsSeen:version});return true;}
    };
}
module.exports={createReleaseHighlights};
