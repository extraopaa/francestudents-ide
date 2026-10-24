/* FranceStudent stores this preference on the account, not in each chat. */
const reasoningButton = document.createElement("button");
reasoningButton.id = "chat-reasoning"; reasoningButton.type = "button"; reasoningButton.hidden = true;
reasoningButton.setAttribute("aria-haspopup", "menu"); reasoningButton.setAttribute("aria-expanded", "false");
reasoningButton.setAttribute("aria-controls", "chat-reasoning-menu");
composerSettingsRow.append(reasoningButton);
chatControlContent(reasoningButton, '<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 3H9c0-1 0-2-1-3Z"/>', "Réflexion");
const reasoningMenu = document.createElement("div");
reasoningMenu.id = "chat-reasoning-menu"; reasoningMenu.className = "chat-access-menu"; reasoningMenu.setAttribute("popover", "auto");
reasoningMenu.innerHTML = '<div class="chat-access-heading">Niveau de réflexion</div><p class="reasoning-account-note">Préférence du compte FranceStudent, commune aux chats GPT. Un niveau élevé peut consommer davantage de quota.</p><div class="chat-access-choices" role="menu" aria-label="Niveau de réflexion du GPT"></div><p class="chat-access-error" role="status"></p>';
document.body.append(reasoningMenu);
const reasoningLabels = { none: ["Désactivée", "Privilégie une réponse rapide, sans raisonnement supplémentaire."], minimal: ["Minimale", "Réflexion très courte."], low: ["Faible", "Privilégie la rapidité et une consommation réduite."], medium: ["Moyenne", "Équilibre entre rapidité et réflexion."], high: ["Élevée", "Davantage de réflexion pour les tâches difficiles."], xhigh: ["Très élevée", "Réflexion approfondie, potentiellement plus lente et coûteuse."] };
let reasoningSnapshot = null, reasoningModelKey = null, reasoningSerial = 0, reasoningLoading = false, reasoningSavingUi = false;
function positionReasoningMenu() {
    const rect = reasoningButton.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 24);
    reasoningMenu.style.width = `${width}px`; reasoningMenu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    reasoningMenu.style.maxHeight = `${Math.max(80, rect.top - 20)}px`;
    reasoningMenu.style.top = `${Math.max(12, rect.top - reasoningMenu.getBoundingClientRect().height - 8)}px`;
}
function paintReasoning() {
    const focusedLevel = reasoningMenu.contains(document.activeElement) ? document.activeElement.dataset.level : null;
    const snapshot = reasoningSnapshot;
    reasoningButton.hidden = !snapshot?.levels?.length;
    reasoningButton.disabled = reasoningLoading || reasoningSavingUi || Boolean(ui.status.busy);
    if (reasoningButton.hidden) { if (reasoningMenu.matches(":popover-open")) reasoningMenu.hidePopover(); return; }
    const supported = snapshot.levels.includes(snapshot.level);
    const prefix = document.createElement("span"); prefix.className = "chat-control-prefix"; prefix.textContent = "Réflexion · ";
    reasoningButton.querySelector(".chat-control-label").replaceChildren(prefix, document.createTextNode(supported ? reasoningLabels[snapshot.level]?.[0].toLowerCase() || snapshot.level : "à choisir"));
    reasoningButton.title = "Régler la réflexion du GPT · préférence du compte FranceStudent · un niveau élevé peut consommer davantage de quota";
    const choices = reasoningMenu.querySelector(".chat-access-choices"); choices.replaceChildren();
    for (const level of snapshot.levels) {
        const row = document.createElement("button"); row.type = "button"; row.dataset.level = level;
        row.setAttribute("role", "menuitemradio"); row.setAttribute("aria-checked", String(snapshot.level === level));
        row.classList.toggle("selected", snapshot.level === level); row.disabled = reasoningSavingUi || Boolean(ui.status.busy);
        row.innerHTML = '<span class="chat-access-copy"><strong></strong><small></small></span><span class="chat-access-check" aria-hidden="true"></span>';
        row.querySelector("strong").textContent = reasoningLabels[level]?.[0] || level;
        row.querySelector("small").textContent = reasoningLabels[level]?.[1] || "";
        row.querySelector(".chat-access-check").textContent = snapshot.level === level ? "✓" : "";
        row.onclick = () => saveChatReasoning(level); choices.append(row);
    }
    reasoningMenu.querySelector(".chat-access-error").textContent = supported ? "" : "Le réglage actuel du compte n’est pas compatible avec ce GPT ou n’est pas fourni. Choisis un niveau pour l’enregistrer.";
    if (focusedLevel && reasoningMenu.matches(":popover-open")) reasoningMenu.querySelector(`[data-level="${focusedLevel}"]`)?.focus();
}
async function loadChatReasoning() {
    if (!ui.status.booted || reasoningSavingUi) return;
    const serial = ++reasoningSerial; reasoningLoading = true; paintReasoning();
    try {
        const value = await api.reasoning();
        if (serial !== reasoningSerial || value.modelId !== ui.status.modelId) return;
        reasoningSnapshot = value;
    } catch (error) {
        if (serial === reasoningSerial) {
            reasoningSnapshot = null;
            if (reasoningMenu.matches(":popover-open")) studioFeedback(`Réflexion : ${error.message}`);
        }
    } finally {
        if (serial === reasoningSerial) { reasoningLoading = false; paintReasoning(); if (reasoningMenu.matches(":popover-open")) positionReasoningMenu(); }
    }
}
function updateChatReasoning(status) {
    const key = status.booted ? status.modelId : null;
    if (key !== reasoningModelKey) {
        reasoningModelKey = key; reasoningSerial++; reasoningSnapshot = null; reasoningLoading = false;
        if (reasoningMenu.matches(":popover-open")) reasoningMenu.hidePopover();
        if (key !== null) loadChatReasoning();
    }
    paintReasoning();
}
async function saveChatReasoning(level) {
    if (reasoningSavingUi || ui.status.busy || !reasoningSnapshot) return;
    reasoningSavingUi = true; reasoningSerial++; reasoningLoading = false; paintReasoning();
    try {
        const value = await api.reasoning("save", { modelId: reasoningSnapshot.modelId, level });
        if (value.modelId !== ui.status.modelId) return;
        reasoningSnapshot = value; reasoningMenu.hidePopover(); reasoningButton.focus();
        studioFeedback(`Réflexion ${reasoningLabels[level]?.[0].toLowerCase() || level} enregistrée sur ton compte FranceStudent.`);
    } catch (error) { reasoningMenu.querySelector(".chat-access-error").textContent = error.message; studioFeedback(error.message); }
    finally { reasoningSavingUi = false; const message = reasoningMenu.querySelector(".chat-access-error").textContent; paintReasoning(); reasoningMenu.querySelector(".chat-access-error").textContent = message; }
}
reasoningButton.onclick = () => {
    if (reasoningMenu.matches(":popover-open")) { reasoningMenu.hidePopover(); return; }
    hideModelMenu(); if (chatAccessMenu.matches(":popover-open")) chatAccessMenu.hidePopover();
    paintReasoning(); reasoningMenu.showPopover(); positionReasoningMenu();
    (reasoningMenu.querySelector('[aria-checked="true"]') || reasoningMenu.querySelector("button"))?.focus();
    loadChatReasoning();
};
reasoningMenu.addEventListener("toggle", () => reasoningButton.setAttribute("aria-expanded", String(reasoningMenu.matches(":popover-open"))));
reasoningMenu.addEventListener("keydown", event => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = [...reasoningMenu.querySelectorAll("[data-level]")];
    if (!rows.length || !rows.includes(document.activeElement)) return;
    event.preventDefault(); const index = rows.indexOf(document.activeElement);
    rows[event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : (index + (event.key === "ArrowUp" ? rows.length - 1 : 1)) % rows.length].focus();
});
window.addEventListener("resize", () => { if (reasoningMenu.matches(":popover-open")) positionReasoningMenu(); });
updateChatReasoning(ui.status);
