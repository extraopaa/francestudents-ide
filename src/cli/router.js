"use strict";

const { state } = require("../state");

const LETTER = "\\p{L}";

function wordRegex(words) {
    return new RegExp(`(?<!${LETTER})(?:${words})(?!${LETTER})`, "iu");
}

const FILE_NOUN_RE = wordRegex(
    "fichiers?|dossiers?|r[ée]pertoires?|code|source|readme|src|projet|" +
    "fonctions?|classes?|module|script|fichier|arborescence"
);

const FILE_NAME_RE = new RegExp(
    "package\\.json" +
    "|\\.(?:js|mjs|cjs|ts|tsx|jsx|json|md|py|html|css|txt|ya?ml|env|sh|ps1)(?![\\p{L}\\d])",
    "iu"
);

const FILE_VERB_RE = wordRegex(
    "lis|lire|ouvre|ouvrir|affiche|liste|lister|cr[ée]e|cr[ée]er|ajoute|ajouter|" +
    "modifie|modifier|corrige|corriger|[ée]dite|[ée]diter|remplace|remplacer|" +
    "renomme|renommer|d[ée]place|d[ée]placer|copie|copier|supprime|supprimer|efface|" +
    "[ée]cris|[ée]crire|g[ée]n[èe]re|explique|analyse|refactor\\w*|am[ée]liore|" +
    "mets?\\s+[àa]\\s+jour|mettre\\s+[àa]\\s+jour|mise\\s+[àa]\\s+jour|" +
    "applique|appliquer|int[èe]gre|int[ée]grer|migr\\w*|corrige|reprends|reprend|" +
    "read|open|list|create|write|edit|fix|move|rename|delete|copy|add|update|upgrade|implement|apply"
);

function seemsToRequestLocalFiles(input) {
    return FILE_NAME_RE.test(input) || (FILE_VERB_RE.test(input) && FILE_NOUN_RE.test(input));
}

// Le raccourci « Projet actuel : … » est réservé aux questions courtes et
// explicites sur l'emplacement du projet (« quel est le projet actuel ? »,
// « dans quel dossier suis-je ? »). Tout autre message qui mentionne le
// dossier (remarque, demande, signalement de bug…) reçoit une vraie réponse.
// L'ancienne règle acceptait n'importe quel texte contenant « ou » et
// « dossier » : « … du mal ou n'arrive pas … au dossier » ne recevait que le chemin.
const WORKSPACE_QUESTION_RE = new RegExp(
    "^(?:" +
    "quel(?:le)?\\s+(?:est\\s+)?(?:le\\s+|la\\s+|ton\\s+|mon\\s+)?(?:projet|dossier|workspace|repertoire)(?:\\s+(?:actuel|courant|ouvert|selectionne))?" +
    "|dans\\s+quel(?:le)?\\s+(?:projet|dossier|repertoire|workspace)\\s+(?:suis[- ]je|sommes[- ]nous|on\\s+est|est[- ]on|es[- ]tu|travailles[- ]tu|travaille[- ]t[- ]on|on\\s+travaille)" +
    "|ou\\s+(?:est|se\\s+trouve)\\s+(?:le\\s+|mon\\s+|ce\\s+)?(?:projet|dossier|workspace|repertoire)(?:\\s+(?:actuel|courant|ouvert|selectionne))?" +
    "|(?:le\\s+)?(?:projet|dossier)\\s+(?:actuel|courant|ouvert)" +
    "|(?:which|what)\\s+(?:is\\s+(?:the|my)\\s+)?(?:current\\s+)?(?:project|workspace|folder|directory)(?:\\s+(?:is\\s+(?:this|open|selected)|am\\s+i\\s+in))?" +
    ")\\s*[?!.]*$"
);

const normalizeQuestion = input => String(input ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[’`]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

function isWorkspaceQuestion(input) {
    return (
        WORKSPACE_QUESTION_RE.test(normalizeQuestion(input)) &&
        !seemsToRequestLocalFiles(input)
    );
}

/** Faut-il passer par l'agent (outils fichiers) pour ce message ? */
function shouldUseAgent(input) {
    if (!state.workspace) return false;
    if (state.mode === "agent") return true;
    if (state.mode === "chat") return false;
    return seemsToRequestLocalFiles(input);
}

module.exports = { seemsToRequestLocalFiles, isWorkspaceQuestion, shouldUseAgent };
