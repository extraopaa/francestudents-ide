"use strict";

const { check, updatePlan } = require("../tools/update-plan");

function validateProgress(progress, plan) {
    if (!Array.isArray(progress)) throw new Error("plan_progress doit être un tableau de statuts.");
    check({ steps: progress.map(status => ({ step: "Étape", status })) });
    if (plan && progress.length !== plan.length) throw new Error("plan_progress doit contenir un statut pour chaque étape du plan actuel, dans le même ordre.");
}

function progressPrompt(plan = [], { compact = false } = {}) {
    if (compact) return plan.length
        ? 'PLAN DE TRAVAIL ACTUEL (ordre inchangé) : ' + JSON.stringify(plan.map(step => step.status)) + '\nAjoute plan_progress à ta réponse avec les statuts actualisés, dans cet ordre. Coche uniquement le travail déjà vérifié ; un refus ou une interruption ne valide rien. update_plan suffit si tu modifies les étapes.'
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
    validateProgress(progress, plan);
    if (plan.some((step, index) => step.status !== progress[index])) {
        updatePlan({ steps: plan.map((step, index) => ({ ...step, status: progress[index] })) });
    }
}

function periodicProgressPrompt(plan, requestNumber) {
    return plan.length && Number.isInteger(requestNumber) && requestNumber > 0 && requestNumber % 5 === 0
        ? "POINT PLAN — Où en es-tu ? Actualise plan_progress avec les étapes réellement vérifiées, puis continue."
        : "";
}

module.exports = { validateProgress, progressPrompt, applyProgress, periodicProgressPrompt };
