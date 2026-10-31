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
const LOOSE_DENIALS = [
    /\b(?:je\s+)?n'ai\s+(?:pas|aucun|plus|donc\s+pas)\s+(?:d'?\s*)?acces(?:\s*[.,;:!)]|\s*$|\s+(?:direct\s+)?(?:a|au|aux)\s+(?:ton|tes|votre|vos|ce|ces|le|la|les|l'|un|une)?\s*(?:dossier|projet|code|repertoire|depot|fichiers?|systeme|ordinateur|machine|disque|environnement|espace))/,
    /\bpas\s+(?:d'?\s*)?acces\s+(?:direct\s+)?(?:a|au|aux)\s+(?:ton|tes|votre|vos|ce|ces|le|la|les)?\s*(?:dossier|projet|code|repertoire|depot|fichiers?|systeme)/,
    new RegExp(`\\bje\\s+ne\\s+(?:peux|puis|vois|parviens|suis)\\s+pas\\s+(?:en\\s+mesure\\s+de\\s+|a\\s+)?(?:(?:voir|lire|ouvrir|acceder|consulter|parcourir|explorer)\\s+)?${TARGET}`),
    /\b(?:partage|envoie|colle|copie|fournis|transmets|partagez|envoyez|collez|copiez|fournissez|transmettez)(?:-moi|-nous|\s+moi)?\s+(?:le|les|ton|tes|votre|vos|ce|son)\s+(?:code|fichiers?|contenu|dossier|projet)/,
    /\bi\s+(?:can't|cannot|can not|don't|do not|am unable to|am not able to)\s+(?:directly\s+)?(?:see|access|read|open|browse|view)\s+(?:your|the|any)\s+(?:files?|folder|project|code|repository|repo|directory)/,
    /\b(?:please\s+)?(?:share|paste|upload|provide)\s+(?:the|your)\s+(?:code|files?|project|folder|repository)/,
    /\bno\s+access\s+to\s+(?:the\s+|your\s+)?(?:files?|folder|project|code|repo|repository|directory|local)/,
    /\b(?:sans|aucun)\s+acces\s+(?:a|au|aux)\s+(?:ton\s+|votre\s+|ce\s+|le\s+|tes\s+|vos\s+)?(?:dossier|fichiers?|projet|systeme|code)/
];

function deniesAccessLoosely(text) {
    const normalized = norm(text);
    return Boolean(normalized) && LOOSE_DENIALS.some(pattern => pattern.test(normalized));
}

function smallModelAccessHint(workspace, followUp = false) {
    return "ACCÈS AU DOSSIER — RAPPEL COURT ET PRIORITAIRE\n" +
        `Le dossier du projet est OUVERT et ACCESSIBLE : ${workspace}\n` +
        (followUp ? "" : "L’IDE l’a déjà listé : voir list_directory dans les RÉSULTATS DES OUTILS.\n") +
        "Tu lis et modifies ses fichiers toi-même avec les outils locaux, en écrivant l’objet JSON. L’utilisateur n’a pas besoin de coller ou partager son code.\n" +
 'Lire : {"type":"tool","name":"read_file","args":{"path":"package.json"},"reason":"Lire le fichier"}\n' +
        'Explorer : {"type":"tool","name":"list_directory","args":{"path":"."},"reason":"Voir le dossier"} ou search_files {"path":".","query":"mot"}\n' +
        "N’écris jamais « je n’ai pas accès » : demande l’outil. Seule une erreur réelle d’un outil (refus, annulation, EACCES, introuvable) peut justifier un blocage.";
}

module.exports = { isSmallModel, deniesAccessLoosely, smallModelAccessHint };
