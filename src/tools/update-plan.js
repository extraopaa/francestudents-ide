"use strict";
const { state } = require("../state");
const { ui } = require("../ui-bridge");
const STATUSES = new Set(["pending", "in_progress", "completed"]);
function check(args) {
    if (!Array.isArray(args.steps)) throw new Error("steps doit être un tableau.");
    args.steps = args.steps.slice(0, 12).map(step => typeof step === "string"
        ? { step, status: "pending" }
        : step && typeof step === "object" && !Array.isArray(step)
            ? { step: step.step, status: step.status || "pending" }
            : step);
    if (args.steps.some(s => !s || typeof s.step !== "string" || !s.step.trim() || s.step.length > 300 || !STATUSES.has(s.status))) throw new Error("Chaque étape doit avoir un texte step et un statut pending, in_progress ou completed.");
    if (args.steps.filter(s => s.status === "in_progress").length > 1) throw new Error("Une seule étape peut être en cours.");
}
function updatePlan(args) {
    check(args);
    state.agentPlan = args.steps.map(s => ({ step: s.step.trim(), status: s.status }));
    const icons = { pending: "○", in_progress: "◉", completed: "✓" };
    ui.plan(state.agentPlan.map(s => `${icons[s.status]} ${s.step}`));
    return { steps: state.agentPlan.map(s => ({ ...s })), changed: false, message: `${state.agentPlan.filter(s => s.status === "completed").length}/${state.agentPlan.length} étapes terminées.` };
}
module.exports = { name: "update_plan", run: updatePlan, check, describe: a => `${a.steps?.length || 0} étapes`, updatePlan };
