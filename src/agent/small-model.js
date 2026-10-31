"use strict";

// Petits modèles rapides (Luna, Haiku, Flash…) : ils suivent moins bien les
// longues consignes et affirment plus souvent, à tort, ne pas avoir accès au
// dossier ouvert. Ils reçoivent un rappel court, une détection de refus plus
// large et une récupération supplémentaire. Aucun refus réel n'est contourné.
const SMALL_MODEL_IDS = new Set(["51", "65", "-1002", "-2002", "-3002"]);
const SMALL_MODEL_NAME = /\b(?:luna|haiku|flash|mini|nano|lite|small)\b/i;

function isSmallModel(model, name = "") {
    const id = String(model ?? "").trim();
    if (SMALL_MODEL_IDS.has(id)) return true;
    return SMALL_MODEL_NAME.test(`${id} ${name}`.replace(/[-_.:/]+/g, " "));
}

const norm = text => String(text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’`]/g, "'").toLowerCase();

const TARGET = "(?:ton|tes|votre|vos|le|les|ce|ces|au|aux|a|a ton|a votre)\\s+(?:dossier|projet|code|repertoire|depot|fichiers|contenu du projet|systeme de fichiers)";
// Formulations typiques de Claude Haiku (« Je ne peux pas accéder directement à vos
// fichiers », « Je n'ai pas la possibilité… », « I don't have the ability to access
// your file system », « Pourriez-vous partager le contenu… »). Une cible possessive
// (votre/ton…) ou « local » est exigée pour éviter les faux positifs sur du code.
const OBJ = String.raw`(?:fichiers?|dossiers?|projet|code|repertoires?|depot|systeme(?:\s+de\s+fichiers)?|ordinateur|machine|environnement|disque|pc)`;
const POSS_OBJ = String.raw`(?:\b(?:ton|tes|votre|vos)\s+(?:[a-z']+\s+){0,2}?${OBJ}\b|\b(?:fichiers?|dossiers?|projet|code|environnement)\s+loca(?:l|le|ux|les)\b|\bsysteme\s+de\s+fichiers\b)`;
const EN_OBJ = String.raw`\b(?:your|local)\s+(?:[a-z]+\s+){0,2}?(?:files?|folders?|project|code|repository|repo|director(?:y|ies)|file\s*system|filesystem|computer|machine)\b`;
const LOOSE_DENIALS = [
    /\b(?:je\s+)?n'ai\s+(?:pas|aucun|plus|donc\s+pas)\s+(?:d'?\s*)?acces(?:\s*[.,;:!)]|\s*$|\s+(?:direct\s+)?(?:a|au|aux)\s+(?:ton|tes|votre|vos|ce|ces|le|la|les|l'|un|une)?\s*(?:dossier|projet|code|repertoire|depot|fichiers?|systeme|ordinateur|machine|disque|environnement|espace))/,
    /\bpas\s+(?:d'?\s*)?acces\s+(?:direct\s+)?(?:a|au|aux)\s+(?:ton|tes|votre|vos|ce|ces|le|la|les)?\s*(?:dossier|projet|code|repertoire|depot|fichiers?|systeme)/,
    new RegExp(`\\bje\\s+ne\\s+(?:peux|puis|vois|parviens|suis)\\s+pas\\s+(?:en\\s+mesure\\s+de\\s+|a\\s+)?(?:(?:voir|lire|ouvrir|acceder|consulter|parcourir|explorer)\\s+)?${TARGET}`),
    /\b(?:partage|envoie|colle|copie|fournis|transmets|partagez|envoyez|collez|copiez|fournissez|transmettez)(?:-moi|-nous|\s+moi)?\s+(?:le|les|ton|tes|votre|vos|ce|son)\s+(?:code|fichiers?|contenu|dossier|projet)/,
    /\bi\s+(?:can't|cannot|can not|don't|do not|am unable to|am not able to)\s+(?:directly\s+)?(?:see|access|read|open|browse|view)\s+(?:your|the|any)\s+(?:files?|folder|project|code|repository|repo|directory)/,
    /\b(?:please\s+)?(?:share|paste|upload|provide)\s+(?:the|your)\s+(?:code|files?|project|folder|repository)/,
    /\bno\s+access\s+to\s+(?:the\s+|your\s+)?(?:files?|folder|project|code|repo|repository|directory|local)/,
    /\b(?:sans|aucun)\s+acces\s+(?:a|au|aux)\s+(?:ton\s+|votre\s+|ce\s+|le\s+|tes\s+|vos\s+)?(?:dossier|fichiers?|projet|systeme|code)/,
    new RegExp(String.raw`\bje\s+ne\s+(?:peux|puis|suis)\s+(?:donc\s+)?pas\s+(?:en\s+mesure\s+d'?\s*|a\s+meme\s+d'?\s*)?(?:(?:directement|moi-meme)\s+)?(?:acceder|lire|voir|consulter|parcourir|explorer|naviguer|ouvrir|executer|lancer)\b[^.!?\n]{0,60}` + POSS_OBJ),
    new RegExp(String.raw`\bn'ai\s+(?:pas|aucune?)\s+(?:la\s+|les\s+|d'?\s*)?(?:possibilite|capacite|moyens?|outils?|acces)\b[^.!?\n]{0,80}` + POSS_OBJ),
    new RegExp(String.raw`\bje\s+ne\s+dispose\s+(?:pas|d'aucune?)\b[^.!?\n]{0,80}` + POSS_OBJ),
    /\bje\s+ne\s+vois\s+(?:aucun|pas\s+de)\s+(?:fichiers?|dossiers?|code|projet)\b[^.!?\n]{0,60}\b(?:conversation|message|joints?|partages?|envoyes?)\b/,
    /\bn'ai\s+acces\s+qu'(?:a|au|aux)\s+(?:(?:ce|cette|la|le|notre|nos|vos|votre|les)\s+)?(?:texte|messages?|conversation|contenu)/,
    /\b(?:pourriez|pouvez|peux|peut)[- ](?:vous|tu)\s+(?:me\s+|nous\s+)?(?:partager|copier|coller|envoyer|fournir|transmettre|montrer)\s+(?:ici\s+)?(?:le|les|ton|tes|votre|vos|ce|son)\s+(?:code|fichiers?|dossier|projet|contenu\s+(?:des?|du)\s+(?:fichiers?|dossier|projet|[\w-]+\.\w+))/,
    new RegExp(String.raw`\bi\s*(?:'m|\s+am)?\s*(?:not\s+able\s+to|unable\s+to|can't|cannot|can\s+not|(?:don't|do\s+not)\s+have\s+the\s+(?:ability|capability|means)\s+to|have\s+no\s+way\s+to)\s+(?:directly\s+)?(?:access|read|see|open|browse|view|explore|navigate)\b[^.!?\n]{0,60}` + EN_OBJ),
    new RegExp(String.raw`\bi\s+(?:don't|do\s+not)\s+have\s+(?:any\s+)?(?:direct\s+)?(?:access|tools?)\b[^.!?\n]{0,60}` + EN_OBJ),
    /\b(?:could|can|would)\s+you\s+(?:please\s+)?(?:share|paste|upload|provide|send)\s+(?:me\s+)?(?:the|your)\s+(?:relevant\s+)?(?:code|files?|project|folder)/,
    // Refus visant « ce dossier / ce projet » (sauf erreur réelle : ENOENT, introuvable, refusé…).
    new RegExp(String.raw`\bje\s+ne\s+(?:peux|puis|suis)\s+(?:donc\s+)?pas\s+(?:en\s+mesure\s+d'?\s*)?(?:directement\s+)?(?:acceder|lire|voir|consulter|parcourir|explorer|ouvrir|ecrire|modifier)\b[^.!?\n]{0,30}\b(?:a\s+)?(?:ce|ces|cet)\s+(?:dossier|projet|repertoire|depot|fichiers)\b(?![^.!?\n]{0,60}(?:n'existe|introuvable|enoent|eacces|eperm|refuse))`),
    // Le modèle croit n'avoir que les outils natifs du fournisseur (recherche web, météo).
    /\bn'ai\s+(?:acces\s+)?qu(?:e\s+|'\s*)(?:a\s+|aux?\s+)?(?:la\s+|les\s+|des\s+|un\s+|une\s+|d'\s*)?(?:recherche\s+web|outils?\s+(?:de\s+)?(?:recherche|web|meteo)|meteo|web)/,
    /\bi\s+only\s+have\s+(?:access\s+to\s+)?(?:a\s+|the\s+)?(?:web\s+search|weather|search\s+and\s+weather)/
];

function deniesAccessLoosely(text) {
    const normalized = norm(text);
    return Boolean(normalized) && LOOSE_DENIALS.some(pattern => pattern.test(normalized));
}

// Refus explicite du format agent (« je ne répondrai pas au format JSON demandé »,
// « je ne peux pas répondre au format d'un agent de code ») : relancer dans le même
// fil ne sert plus à rien.
const FORMAT_REFUSALS = [
    /\bje\s+ne\s+(?:peux|puis|vais|pourrai|saurais?)\s+(?:donc\s+)?pas\s+(?:vous\s+|te\s+)?repondre\s+(?:au|dans\s+le|sous\s+le|en|selon\s+le)\s+format\s+(?:json|d'un\s+agent|agent|demande)/,
    /\bje\s+ne\s+(?:repondrai|repondrais|reponds?)\s+(?:donc\s+)?pas\s+(?:au|dans\s+le|sous\s+le|en|selon\s+le)\s+format\s+(?:json|d'un\s+agent|agent|demande)/,
    /\bi\s+(?:won't|will\s+not|can't|cannot|can\s+not)\s+(?:respond|reply|answer)\s+in\s+(?:the\s+)?(?:requested\s+)?(?:json|agent)\s+format/
];

function refusesAgentFormat(text) {
    const normalized = norm(text);
    return Boolean(normalized) && FORMAT_REFUSALS.some(pattern => pattern.test(normalized));
}

// Retire les blocs de code et les objets entre accolades d'une réponse : un petit
// modèle qui refuse en citant un exemple JSON ou un bloc ``` reste un refus en
// texte libre, et non une action exploitable.
function stripCodeAndJson(text) {
    let out = String(text ?? "").replace(/```[\s\S]*?(?:```|$)/g, " ");
    let previous;
    do {
        previous = out;
        out = out.replace(/\{[^{}]*\}/g, " ");
    } while (out !== previous);
    return out.replace(/[ \t]{2,}/g, " ").trim();
}

function smallModelAccessHint(workspace, followUp = false) {
    return "ACCÈS AU DOSSIER — RAPPEL COURT ET PRIORITAIRE\n" +
        `Le dossier du projet est OUVERT et ACCESSIBLE : ${workspace}\n` +
        (followUp ? "" : "L’IDE l’a déjà listé : voir list_directory dans les RÉSULTATS DES OUTILS.\n") +
        "Tu lis et modifies ses fichiers toi-même avec les outils locaux, en écrivant l’objet JSON. L’utilisateur n’a pas besoin de coller ou partager son code.\n" +
 'Lire : {"type":"tool","name":"read_file","args":{"path":"package.json"},"reason":"Lire le fichier"}\n' +
        'Explorer : {"type":"tool","name":"list_directory","args":{"path":"."},"reason":"Voir le dossier"} ou search_files {"path":".","query":"mot"}\n' +
        "Les outils intégrés de ton fournisseur (recherche web, météo…) ne sont PAS ta liste complète : read_file, list_directory, search_files, write_file, edit_file et run_command fonctionnent ici, en écrivant l’objet JSON dans ta réponse.\n" +
        "N’écris jamais « je n’ai pas accès » : demande l’outil. Seule une erreur réelle d’un outil (refus, annulation, EACCES, introuvable) peut justifier un blocage.";
}

module.exports = { isSmallModel, deniesAccessLoosely, refusesAgentFormat, stripCodeAndJson, smallModelAccessHint };
