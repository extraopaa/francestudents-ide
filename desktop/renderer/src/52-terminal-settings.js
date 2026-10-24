/* Terminal profile applies to new terminals; running shells are preserved. */
const terminalSettingsCard = document.createElement("section");
terminalSettingsCard.className = "settings-card"; terminalSettingsCard.dataset.settingsGroup = "general";
terminalSettingsCard.setAttribute("aria-labelledby", "settings-terminal-title");
terminalSettingsCard.innerHTML = '<h3 id="settings-terminal-title">Terminal intégré</h3><p class="settings-help">Choisis le terminal des nouveaux onglets. Avec WSL, retrouve les packages et outils déjà installés dans ta distribution Linux. Les terminaux ouverts gardent leur environnement.</p><label class="center-code-label">Terminal par défaut<select id="settings-terminal-profile" disabled></select></label><label id="settings-terminal-distribution-label" class="center-code-label hidden">Distribution WSL<select id="settings-terminal-distribution"><option value="">Distribution par défaut de WSL</option></select></label><div class="studio-actions"><button type="button" id="settings-terminal-save" class="primary" disabled>Enregistrer</button><button type="button" id="settings-terminal-refresh">Actualiser les terminaux</button></div><p id="settings-terminal-message" class="settings-help" role="status"></p><p class="settings-help">Ce réglage concerne le terminal intégré, pas les commandes de l’agent, les serveurs MCP ou les autres outils Windows. WSL doit être installé au préalable. Ouvre un nouveau terminal avec + après avoir enregistré. Le terminal simple de secours ne conserve pas tout l’état d’un shell interactif.</p>';
$("settings-model-title").closest(".settings-card").after(terminalSettingsCard);
const terminalProfileSelect = $("settings-terminal-profile"), terminalDistributionSelect = $("settings-terminal-distribution");
let terminalSettingsLoading = false, terminalDistributionSerial = 0;
function terminalSettingsMessage(text) { $("settings-terminal-message").textContent = text; }
async function refreshTerminalDistributions(selected = "") {
    const serial = ++terminalDistributionSerial;
    const wsl = terminalProfileSelect.value === "wsl";
    $("settings-terminal-distribution-label").classList.toggle("hidden", !wsl);
    if (!wsl) return;
    terminalDistributionSelect.disabled = true; $("settings-terminal-save").disabled = true;
    try {
        const names = await api.terminalPreferences("distributions");
        if (serial !== terminalDistributionSerial || terminalProfileSelect.value !== "wsl") return;
        terminalDistributionSelect.replaceChildren(new Option("Distribution par défaut de WSL", ""));
        for (const name of names) terminalDistributionSelect.append(new Option(name, name));
        if (selected && !names.includes(selected)) terminalSettingsMessage(`La distribution ${selected} est introuvable. Choisis une distribution installée.`);
        terminalDistributionSelect.value = names.includes(selected) ? selected : "";
        if (!names.length) { terminalSettingsMessage("Aucune distribution WSL installée. Installe-la avant de sélectionner WSL."); return; }
        terminalDistributionSelect.disabled = false; $("settings-terminal-save").disabled = false;
    } catch (error) { if (serial === terminalDistributionSerial) terminalSettingsMessage(error.message); }
}
async function loadTerminalSettings() {
    if (terminalSettingsLoading) return;
    terminalSettingsLoading = true; terminalSettingsMessage("Détection des terminaux…");
    terminalProfileSelect.disabled = true; $("settings-terminal-save").disabled = true;
    try {
        const value = await api.terminalPreferences();
        terminalProfileSelect.replaceChildren();
        for (const profile of value.profiles) terminalProfileSelect.append(new Option(profile.name, profile.id));
        if (!value.profiles.some(profile => profile.id === value.profile)) {
            const missing = new Option(`Terminal indisponible (${value.profile})`, value.profile); missing.disabled = true; terminalProfileSelect.append(missing);
        }
        terminalProfileSelect.value = value.profile; terminalProfileSelect.disabled = false;
        $("settings-terminal-save").disabled = false; terminalSettingsMessage("");
        await refreshTerminalDistributions(value.distribution);
    } catch (error) { terminalSettingsMessage(error.message); }
    finally { terminalSettingsLoading = false; }
}
terminalProfileSelect.onchange = () => {
    terminalSettingsMessage(""); $("settings-terminal-save").disabled = false;
    refreshTerminalDistributions();
};
$("settings-terminal-refresh").onclick = loadTerminalSettings;
$("settings-terminal-save").onclick = async () => {
    $("settings-terminal-save").disabled = true; terminalProfileSelect.disabled = true;
    try {
        const value = await api.terminalPreferences("save", { profile: terminalProfileSelect.value, distribution: terminalDistributionSelect.value });
        terminalSettingsMessage(`Terminal enregistré : ${value.profiles.find(item => item.id === value.profile)?.name || value.profile}. Ouvre un nouvel onglet avec +.`);
    } catch (error) { terminalSettingsMessage(error.message); }
    finally { $("settings-terminal-save").disabled = false; terminalProfileSelect.disabled = false; }
};
loadTerminalSettings();
