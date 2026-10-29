/* ---------- IDE Link bêta ---------- */
const chatIdeLinkButton = document.createElement("button");
chatIdeLinkButton.type = "button";
chatIdeLinkButton.id = "chat-ide-link-button";
chatIdeLinkButton.setAttribute("aria-haspopup", "dialog");
chatIdeLinkButton.setAttribute("aria-expanded", "false");
chatIdeLinkButton.setAttribute("aria-controls", "chat-ide-link-menu");
chatControlContent(chatIdeLinkButton, '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>', "IDE Link");
chatAccessButton.after(chatIdeLinkButton);
const chatIdeLinkMenu = document.createElement("div");
chatIdeLinkMenu.id = "chat-ide-link-menu";
chatIdeLinkMenu.className = "chat-access-menu chat-ide-link-menu";
chatIdeLinkMenu.setAttribute("popover", "auto");
chatIdeLinkMenu.setAttribute("role", "dialog");
chatIdeLinkMenu.setAttribute("aria-labelledby", "chat-ide-link-title");
chatIdeLinkMenu.innerHTML = `<div class="ide-link-heading"><div><div class="chat-access-heading" id="chat-ide-link-title">IDE Link <span class="ide-link-badge">Bêta</span></div><p class="ide-link-subtitle">Retrouve ton agent sur mobile</p></div><button type="button" id="ide-link-close" aria-label="Fermer">×</button></div>
<div class="ide-link-intro"><p class="settings-help">Connecte ton mobile au chat. Le tunnel est inclus dans l’application distribuée ; une connexion Internet est nécessaire. En développement, cloudflared doit être disponible dans le PATH.</p><p class="settings-help">Le QR code ouvre la page de connexion : le PIN est obligatoire. Ne communique le code qu’à une personne de confiance.</p></div>
<div id="ide-link-details" hidden><img id="ide-link-qr" width="256" height="256" alt="QR code de connexion privé IDE Link"><label for="ide-link-address">Adresse de connexion</label><input id="ide-link-address" type="text" readonly><button type="button" id="ide-link-copy">Copier l’adresse</button><label>Code PIN à usage unique</label><div id="ide-link-pin" class="ide-link-pin" aria-live="polite"></div><p class="settings-help">Code valable 10 minutes, cinq essais maximum. S’il est utilisé, expiré ou bloqué, redémarre IDE Link.</p></div>
<p id="ide-link-status" class="settings-help" role="status">Désactivé.</p>
<div class="ide-link-actions"><button type="button" id="ide-link-start">Activer IDE Link</button><button type="button" id="ide-link-stop" disabled>Arrêter IDE Link</button></div>`;
document.body.append(chatIdeLinkMenu);
function positionChatIdeLink() {
    const rect = chatIdeLinkButton.getBoundingClientRect();
    const width = Math.min(370, window.innerWidth - 24);
    chatIdeLinkMenu.style.width = `${width}px`;
    chatIdeLinkMenu.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    chatIdeLinkMenu.style.maxHeight = `${Math.max(80, rect.top - 20)}px`;
    chatIdeLinkMenu.style.overflowY = "auto";
    chatIdeLinkMenu.style.top = `${Math.max(12, rect.top - chatIdeLinkMenu.getBoundingClientRect().height - 8)}px`;
}
chatIdeLinkButton.onclick = () => {
    if (chatIdeLinkMenu.matches(":popover-open")) { chatIdeLinkMenu.hidePopover(); return; }
    chatIdeLinkMenu.showPopover(); positionChatIdeLink(); refreshIdeLink();
};
chatIdeLinkMenu.addEventListener("toggle", () => chatIdeLinkButton.setAttribute("aria-expanded", String(chatIdeLinkMenu.matches(":popover-open"))));
window.addEventListener("resize", () => { if (chatIdeLinkMenu.matches(":popover-open")) positionChatIdeLink(); });
async function refreshIdeLink() {
    try {
        const info = await api.ideLink("status");
        $("ide-link-start").disabled = info.state !== "stopped";
        $("ide-link-stop").disabled = info.state === "stopped";
        $("ide-link-details").hidden = info.state !== "running";
        $("ide-link-status").textContent = info.state === "running" ? "Actif : garde ce lien secret et arrête le partage après utilisation." : info.state === "starting" ? "Démarrage du tunnel…" : "Désactivé.";
        $("ide-link-qr").src = info.qr || "";
        $("ide-link-address").value = info.address || "";
        const pinBox = $("ide-link-pin"); pinBox.replaceChildren();
        if (info.pin) {
            pinBox.setAttribute("aria-label", `Code PIN ${info.pin.split("").join(" ")}`);
            for (const digit of info.pin) { const cell = document.createElement("span"); cell.textContent = digit; cell.setAttribute("aria-hidden", "true"); pinBox.append(cell); }
        } else { pinBox.removeAttribute("aria-label"); pinBox.textContent = "Code utilisé, expiré ou bloqué."; }
        if (chatIdeLinkMenu.matches(":popover-open")) positionChatIdeLink();
    } catch (error) { $("ide-link-status").textContent = error.message; }
}
$("ide-link-close").onclick = () => chatIdeLinkMenu.hidePopover();
setInterval(() => { if (chatIdeLinkMenu.matches(":popover-open")) refreshIdeLink(); }, 30000);
$("ide-link-start").onclick = async () => {
    if (!await confirmStudioAction("Ce lien permet de voir la conversation actuelle, y compris les messages précédents, de lancer des tâches et de répondre aux questions et confirmations avec les autorisations actuelles de l’agent. Toute personne possédant le lien et le code PIN peut s’y connecter ; garde-les secrets. Activer le partage Internet ?", { title: "Activer IDE Link · Bêta", confirmLabel: "Activer", danger: true })) return;
    if (!chatIdeLinkMenu.matches(":popover-open")) { chatIdeLinkMenu.showPopover(); positionChatIdeLink(); }
    $("ide-link-start").disabled = true;
    try { await api.ideLink("start"); } catch (error) { $("ide-link-status").textContent = error.message; $("ide-link-start").disabled = false; return; }
    await refreshIdeLink();
};
$("ide-link-stop").onclick = async () => { try { await api.ideLink("stop"); await refreshIdeLink(); } catch (error) { $("ide-link-status").textContent = error.message; } };
$("ide-link-copy").onclick = async () => { try { await navigator.clipboard.writeText($("ide-link-address").value); $("ide-link-status").textContent = "Adresse de connexion copiée. Ne la partage qu’avec une personne de confiance."; } catch { $("ide-link-address").select(); $("ide-link-status").textContent = "Sélectionne et copie l’adresse manuellement."; } };
api.onEvent(channel => { if (channel === "ideLink") refreshIdeLink(); });
refreshIdeLink();
