/* Same permission policy as Settings, available directly in the chat composer. */
const chatAccessButton = document.createElement("button");
chatAccessButton.type = "button"; chatAccessButton.id = "chat-access-button";
chatAccessButton.setAttribute("aria-haspopup", "menu"); chatAccessButton.setAttribute("aria-expanded", "false");
chatAccessButton.setAttribute("aria-controls", "chat-access-menu");
composerSettingsRow.append(chatAccessButton);
chatControlContent(chatAccessButton, '<path d="M12 3 4 6v6c0 4 8 9 8 9s8-5 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>', "Accès");
const chatAccessMenu = document.createElement("div");
chatAccessMenu.id = "chat-access-menu"; chatAccessMenu.className = "chat-access-menu";
chatAccessMenu.setAttribute("popover", "auto");
chatAccessMenu.innerHTML = '<div class="chat-access-heading">Autorisations de l’agent</div><div class="chat-access-choices" role="menu" aria-label="Niveau d’accès"></div><label class="chat-access-remember"><input type="checkbox"> Mémoriser pour les prochaines sessions</label><p class="chat-access-error" role="status"></p>';
document.body.append(chatAccessMenu);
const chatAccessModes = [
    { id: "ask", label: "Sur approbation", icon: "♧", description: "Demande ton accord pour les modifications et les commandes sensibles." },
    { id: "auto", label: "Automatique", icon: "◈", description: "Approuve les modifications et les commandes autorisées. Les commandes bloquées restent interdites." },
    { id: "full", label: "Accès complet", icon: "◇", description: "Actions sans confirmation, y compris hors du projet. Approuve aussi les actions déjà en attente. Tu peux les annuler pendant leur exécution." }
];
let chatAccessSaving = false;
function chatAccessMode(status) {
    return status.fullAccess ? "full" : status.autoApprove && status.autoApproveCommands ? "auto" : status.autoApprove || status.autoApproveCommands ? "custom" : "ask";
}
function updateChatAccess(status) {
    const mode = chatAccessMode(status || {}), label = chatAccessModes.find(item => item.id === mode)?.label || "Personnalisé";
    chatAccessButton.querySelector(".chat-control-label").textContent = label;
    chatAccessButton.classList.toggle("full-access", mode === "full");
    chatAccessButton.title = `Niveau d’accès : ${label}. Modifier les autorisations de l’agent.`;
    for (const row of chatAccessMenu.querySelectorAll("[data-chat-access]")) {
        const selected = row.dataset.chatAccess === mode;
        row.setAttribute("aria-checked", String(selected)); row.classList.toggle("selected", selected);
        row.querySelector(".chat-access-check").textContent = selected ? "✓" : "";
    }
}
function positionChatAccess() {
    const rect = chatAccessButton.getBoundingClientRect();
    const width = Math.min(370, window.innerWidth - 24);
    chatAccessMenu.style.width = `${width}px`;
    chatAccessMenu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    chatAccessMenu.style.maxHeight = `${Math.max(80, rect.top - 20)}px`;
    chatAccessMenu.style.top = `${Math.max(12, rect.top - chatAccessMenu.getBoundingClientRect().height - 8)}px`;
}
for (const item of chatAccessModes) {
    const row = document.createElement("button"); row.type = "button"; row.dataset.chatAccess = item.id;
    row.setAttribute("role", "menuitemradio"); row.setAttribute("aria-checked", "false");
    row.innerHTML = '<span class="chat-access-icon" aria-hidden="true"></span><span class="chat-access-copy"><strong></strong><small></small></span><span class="chat-access-check" aria-hidden="true"></span>';
    row.querySelector(".chat-access-icon").textContent = item.icon;
    row.querySelector("strong").textContent = item.label; row.querySelector("small").textContent = item.description;
    row.onclick = async () => {
        if (chatAccessSaving) return;
        chatAccessSaving = true; chatAccessMenu.querySelector(".chat-access-error").textContent = "";
        chatAccessMenu.querySelectorAll("button,input").forEach(control => { control.disabled = true; });
        try {
            const remember = chatAccessMenu.querySelector("input").checked;
            applySettings(await api.setAutoApprove(`access-${item.id}-${remember ? "always" : "session"}`));
            applyStatus(await api.status()); chatAccessMenu.hidePopover(); chatAccessButton.focus();
        } catch (error) { chatAccessMenu.querySelector(".chat-access-error").textContent = error.message; }
        finally { chatAccessSaving = false; chatAccessMenu.querySelectorAll("button,input").forEach(control => { control.disabled = false; }); }
    };
    chatAccessMenu.querySelector(".chat-access-choices").append(row);
}
chatAccessButton.onclick = async () => {
    if (chatAccessMenu.matches(":popover-open")) { chatAccessMenu.hidePopover(); return; }
    hideModelMenu(); updateChatAccess(ui.status); chatAccessMenu.querySelector(".chat-access-error").textContent = "";
    chatAccessMenu.querySelector("input").checked = $("set-remember-access").checked;
    chatAccessMenu.showPopover(); positionChatAccess();
    (chatAccessMenu.querySelector('[aria-checked="true"]') || chatAccessMenu.querySelector("button")).focus();
    try {
        const settings = await api.setAutoApprove("");
        if (!chatAccessMenu.matches(":popover-open") || chatAccessSaving) return;
        applySettings(settings); updateChatAccess(settings);
        chatAccessMenu.querySelector("input").checked = $("set-remember-access").checked;
        positionChatAccess();
    } catch (error) { chatAccessMenu.querySelector(".chat-access-error").textContent = error.message; }
};
chatAccessMenu.addEventListener("toggle", () => chatAccessButton.setAttribute("aria-expanded", String(chatAccessMenu.matches(":popover-open"))));
chatAccessMenu.addEventListener("keydown", event => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const rows = [...chatAccessMenu.querySelectorAll("[data-chat-access]")];
    if (!rows.includes(document.activeElement)) return;
    event.preventDefault();
    const index = rows.indexOf(document.activeElement);
    rows[event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : (index + (event.key === "ArrowUp" ? rows.length - 1 : 1)) % rows.length].focus();
});
window.addEventListener("resize", () => { if (chatAccessMenu.matches(":popover-open")) positionChatAccess(); });
updateChatAccess(ui.status);
