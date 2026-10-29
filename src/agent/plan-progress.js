"use strict";

const { check, updatePlan } = require("../tools/update-plan");

const STATUS_ALIASES = {
    pending: "pending", todo: "pending", "to_do": "pending", open: "pending", waiting: "pending", "a_faire": "pending", "en_attente": "pending", "not_started": "pending",
    in_progress: "in_progress", inprogress: "in_progress", progress: "in_progress", doing: "in_progress", running: "in_progress", active: "in_progress", current: "in_progress", "en_cours": "in_progress", started: "in_progress",
    completed: "completed", complete: "completed", done: "completed", finished: "completed", ok: "completed", success: "completed", "termine": "completed", "terminee": "completed", "fait": "completed", "faite": "completed", closed: "completed"
};

const statusKey = value => String(value).trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[\s-]+/g, "_");

/**
 * Ramène un plan_progress approximatif à un tableau de statuts canoniques :
 * synonymes (done, en cours…), objets {step,status} ou {status}, chaîne JSON ou
 * liste séparée par des virgules. Retourne undefined si rien n'est lisible : le
 * suivi est alors ignoré, sans faire échouer la réponse du modèle.
 */
function normalizeProgress(progress) {
    let list = progress;
    if (typeof list === "string") {
        const text = list.trim();
        try { list = JSON.parse(text); } catch { list = text.split(/[,;\n]+/); }
    }
    if (list && typeof list === "object" && !Array.isArray(list)) {
        // Seules les enveloppes explicites sont lues ; un objet quelconque n'est pas un suivi.
        list = Array.isArray(list.steps) ? list.steps : Array.isArray(list.statuses) ? list.statuses : Array.isArray(list.plan_progress) ? list.plan_progress : undefined;
    }
    if (!Array.isArray(list) || !list.length) return undefined;
    const statuses = list.map(item => {
        const value = item && typeof item === "object" ? item.status : item;
        if (typeof value === "boolean") return value ? "completed" : "pending";
        return typeof value === "string" ? STATUS_ALIASES[statusKey(value)] : undefined;
    });
    if (statuses.some(status => !status)) return undefined;
    // Plusieurs étapes « en cours » : seule la dernière est conservée en cours, les précédentes restent à faire.
    const last = statuses.lastIndexOf("in_progress");
    return statuses.map((status, index) => status === "in_progress" && index !== last ? "pending" : status);
}

function validateProgress(progress, plan) {
    if (!Array.isArray(progress)) throw new Error("plan_progress doit être un tableau de statuts.");
    check({ steps: progress.map(status => ({ step: "Étape", status })) });
    if (plan && progress.length !== plan.length) throw new Error("plan_progress doit contenir un statut pour chaque étape du plan actuel, dans le même ordre.");
}

/**
 * Ajuste un plan_progress valide à la taille du plan courant : statuts manquants
 * complétés par l'état actuel, statuts en trop ignorés. Retourne undefined si
 * aucun plan n'existe ou si les statuts ne sont pas lisibles.
 */
function fitProgress(progress, plan = []) {
    const statuses = normalizeProgress(progress);
    if (!statuses || !plan.length) return undefined;
    if (statuses.length === plan.length) return statuses;
    const fitted = plan.map((step, index) => statuses[index] ?? step.status ?? "pending");
    const last = fitted.lastIndexOf("in_progress");
    return fitted.map((status, index) => status === "in_progress" && index !== last ? "pending" : status);
}

function progressPrompt(plan = [], { compact = false } = {}) {
    if (compact) return plan.length
        ? 'PLAN DE TRAVAIL ACTUEL (ordre inchangé) : ' + JSON.stringify(plan.map(({ step, status }) => ({ step, status }))) + '\nAjoute plan_progress avec tous les statuts dans l’ordre. Ne valide que le travail vérifié : refus et interruptions ne valident rien. Pour modifier les étapes, utilise update_plan.'
        : "";
    if (!plan.length) return 'SUIVI DU TRAVAIL — Pour une tâche complexe, crée un "plan" de 3 à 6 étapes courtes dans ta première réponse outil, ou utilise update_plan. Ensuite, ajoute "plan_progress" dans tes réponses normales : les statuts de toutes les étapes dans leur ordre. Exemple : ["completed","in_progress","pending"]. Ne valide que le travail vérifié, pas l’action que tu demandes maintenant.';
    return "PLAN DE TRAVAIL ACTUEL — suivi obligatoire\n" +
        JSON.stringify(plan.map(({ step, status }, index) => ({ numero: index + 1, step, status }))) + "\n" +
        'Ajoute "plan_progress" à ta prochaine réponse JSON (outil, lot ou final) : un tableau des statuts de TOUTES ces étapes, dans cet ordre. ' +
        'Exemple pour trois étapes : "plan_progress":["completed","in_progress","pending"]. ' +
        "Actualise les cases d’après les résultats déjà reçus, avant de passer à la suite. Une seule étape in_progress. " +
        "Un appel demandé n’est pas encore réussi : ne coche completed qu’après vérification. Une erreur, un refus, une interruption ou une commande encore en arrière-plan ne valide pas une étape. " +
        "Si tu es bloqué, conserve les étapes inachevées et indique completed:false dans final. Tu peux aussi utiliser update_plan pour modifier le contenu du plan ; cet outil transmet déjà ses statuts, n’y ajoute pas plan_progress.";
}

function applyProgress(plan, progress) {
    const statuses = fitProgress(progress, plan);
    if (!statuses) return;
    validateProgress(statuses, plan);
    if (plan.some((step, index) => step.status !== statuses[index])) {
        updatePlan({ steps: plan.map((step, index) => ({ ...step, status: statuses[index] })) });
    }
}

function periodicProgressPrompt(plan, requestNumber) {
    return plan.length && Number.isInteger(requestNumber) && requestNumber > 0 && requestNumber % 5 === 0
        ? "POINT PLAN — Où en es-tu ? Actualise plan_progress avec les étapes réellement vérifiées, puis continue."
        : "";
}

module.exports = { validateProgress, normalizeProgress, fitProgress, progressPrompt, applyProgress, periodicProgressPrompt };
