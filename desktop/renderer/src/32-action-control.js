/* ---------- Annulation d’une action sans interrompre l’agent ---------- */
const actionControlPanel = document.createElement("section");
actionControlPanel.id = "action-controls";
actionControlPanel.className = "action-controls hidden";
actionControlPanel.setAttribute("aria-label", "Actions en accès complet");
document.querySelector("#agent .agent-context-bar")?.after(actionControlPanel);
if (!actionControlPanel.isConnected) $("agent-activity").before(actionControlPanel);
api.onEvent((channel, action) => {
    if (channel !== "actionControl") return;
    let row = [...actionControlPanel.children].find(item => item.dataset.actionId === action.id);
    if (action.state === "running" && !row) {
        row = document.createElement("div"); row.className = "action-control-row"; row.dataset.actionId = action.id;
        row.dataset.actionName = action.name;
        const label = document.createElement("span"); label.textContent = toolLabel(action.name); label.title = action.description;
        const cancel = document.createElement("button"); cancel.type = "button"; cancel.textContent = "Annuler l’action";
        cancel.title = "Écarter le résultat et arrêter l’opération si possible, sans arrêter l’agent. Les effets déjà produits ne sont pas automatiquement annulés.";
        cancel.onclick = async () => { cancel.disabled = true; try { await api.cancelAction(action.id); } catch (error) { studioFeedback(error.message); cancel.disabled = false; } };
        row.append(label, cancel); actionControlPanel.appendChild(row);
    }
    if (row && action.state === "canceling") { row.querySelector("button").disabled = true; row.querySelector("button").textContent = "Annulation…"; }
    if (row && ["done", "failed", "canceled"].includes(action.state)) {
        row.remove();
        if (action.state === "canceled") studioFeedback("Action annulée. L’agent continue ; les effets déjà produits restent à vérifier.");
    }
    actionControlPanel.classList.toggle("hidden", !actionControlPanel.children.length);
});
