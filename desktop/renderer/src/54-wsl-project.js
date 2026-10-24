/* Project execution environment, independent of the terminal-only preference. */
const wslProjectCard = document.createElement("section");
wslProjectCard.className = "settings-card"; wslProjectCard.dataset.settingsGroup = "general";
wslProjectCard.setAttribute("aria-labelledby", "settings-wsl-project-title");
wslProjectCard.innerHTML = '<h3 id="settings-wsl-project-title">Environnement du projet · WSL</h3><p class="settings-help">WSL permet d’utiliser Linux dans Windows. Si tes outils sont déjà installés dans ta distribution, active ce mode pour les utiliser dans le terminal, les commandes de l’agent, les tâches, les serveurs du projet et les diagnostics. Aucune réinstallation automatique.</p><p id="wsl-project-name" class="settings-help"></p><label class="center-code-label">Exécuter ce projet avec<select id="wsl-project-mode"><option value="native">Windows · environnement habituel</option><option value="wsl">WSL · mes outils Linux</option></select></label><label id="wsl-project-distribution-label" class="center-code-label hidden">Distribution Linux<select id="wsl-project-distribution"><option value="">Distribution par défaut</option></select></label><div class="studio-actions"><button type="button" id="wsl-project-save" class="primary">Appliquer à ce projet</button><button type="button" id="wsl-project-check">Vérifier l’environnement</button><button type="button" id="wsl-project-refresh">Actualiser</button></div><p id="wsl-project-message" class="settings-help" role="status"></p><p class="settings-help">Arrête les tâches avant de changer d’environnement, puis ouvre un nouveau terminal. Le choix est conservé pour ce projet. L’interface, l’éditeur, le moteur Motion et les connecteurs natifs Windows restent sur Windows. Ce mode ne déplace pas tes fichiers et n’installe pas WSL.</p>';
terminalSettingsCard.after(wslProjectCard);
terminalSettingsCard.querySelector(":scope > p:last-child").textContent = "Ce choix de terminal seul ne change pas les commandes de l’agent. Pour utiliser aussi tes outils Linux dans les tâches du projet, active l’environnement WSL ci-dessous : il a priorité pour les nouveaux terminaux de ce projet. Les sessions ouvertes sont conservées.";
let wslProjectSnapshot = null, wslProjectKey = null, wslProjectSerial = 0, wslProjectSaving = false;
const wslProjectMode = $("wsl-project-mode"), wslProjectDistribution = $("wsl-project-distribution");
function wslProjectMessage(text) { $("wsl-project-message").textContent = text; }
function setWslProjectDisabled(disabled) { for (const control of wslProjectCard.querySelectorAll("button,select")) control.disabled = disabled; }
async function populateWslProjectDistributions(selected = "") {
    const serial = ++wslProjectSerial, wsl = wslProjectMode.value === "wsl";
    $("wsl-project-distribution-label").classList.toggle("hidden", !wsl);
    if (!wsl) return;
    wslProjectDistribution.disabled = true; $("wsl-project-save").disabled = true; $("wsl-project-check").disabled = true;
    try {
        const distributions = await api.terminalPreferences("distributions");
        if (serial !== wslProjectSerial || wslProjectMode.value !== "wsl") return;
        wslProjectDistribution.replaceChildren(new Option("Distribution par défaut", ""));
        for (const name of distributions) wslProjectDistribution.append(new Option(name, name));
        wslProjectDistribution.value = distributions.includes(selected) ? selected : "";
        if (!distributions.length) { wslProjectMessage("Aucune distribution installée. Installe et initialise WSL avant d’activer cette option."); return; }
        if (selected && !distributions.includes(selected)) wslProjectMessage(`La distribution ${selected} n’est plus disponible. Sélectionne sa remplaçante.`);
        wslProjectDistribution.disabled = false; $("wsl-project-save").disabled = false; $("wsl-project-check").disabled = false;
    } catch (error) { if (serial === wslProjectSerial) wslProjectMessage(error.message); }
}
async function loadWslProject() {
    const serial = ++wslProjectSerial; setWslProjectDisabled(true);
    try {
        const value = await api.projectEnvironment();
        if (serial !== wslProjectSerial) return;
        wslProjectSnapshot = value; $("wsl-project-name").textContent = value.workspace || "Ouvre un projet pour choisir son environnement.";
        wslProjectMode.value = value.mode; $("wsl-project-distribution-label").classList.toggle("hidden", value.mode !== "wsl");
        if (!value.available || !value.workspace) { wslProjectMessage("Cette option est réservée aux projets Code ouverts sur Windows."); return; }
        setWslProjectDisabled(false);
        wslProjectMessage(value.mode === "wsl" ? `Actif : WSL · ${value.distribution}. Les nouveaux terminaux utilisent ce choix.` : "Environnement Windows actif pour ce projet.");
        await populateWslProjectDistributions(value.distribution);
    } catch (error) { if (serial === wslProjectSerial) { wslProjectMessage(error.message); $("wsl-project-refresh").disabled = false; } }
}
function updateWslProject(status) {
    const key = `${status.workspace || ""}:${status.chatContextKey?.split(":")[0] || "false"}`;
    if (key === wslProjectKey) return;
    wslProjectKey = key; loadWslProject();
}
async function applyWslProject(action) {
    if (!wslProjectSnapshot?.workspace || wslProjectSaving) return;
    wslProjectSaving = true; setWslProjectDisabled(true); wslProjectMessage("Vérification du dossier et des outils dans la distribution…");
    const payload = { workspace: wslProjectSnapshot.workspace, mode: wslProjectMode.value, distribution: wslProjectDistribution.value };
    try {
        const value = await api.projectEnvironment(action, payload);
        if (value.workspace !== ui.workspace) return;
        if (action === "save") { await loadWslProject(); }
        const detected = value.detected;
        wslProjectMessage(detected ? `${action === "save" ? "WSL activé pour ce projet" : "Vérification réussie"} · ${detected.distribution}\nDossier Linux : ${detected.linuxRoot}\nNode : ${detected.node || "non trouvé dans Linux"} · npm : ${detected.npm || "non trouvé dans Linux"} · Git : ${detected.git || "non trouvé dans Linux"}\n${action === "save" ? "Ouvre un nouveau terminal (+)." : "Aucun réglage modifié."}` : action === "save" ? "Environnement Windows rétabli. Ouvre un nouveau terminal (+)." : "Environnement Windows sélectionné. Aucun réglage modifié.");
    } catch (error) { wslProjectMessage(error.message); }
    finally { wslProjectSaving = false; if (wslProjectSnapshot?.available && wslProjectSnapshot.workspace === ui.workspace) setWslProjectDisabled(false); }
}
wslProjectMode.onchange = () => { wslProjectMessage(""); $("wsl-project-save").disabled = false; $("wsl-project-check").disabled = false; populateWslProjectDistributions(); };
$("wsl-project-save").onclick = () => applyWslProject("save");
$("wsl-project-check").onclick = () => applyWslProject("check");
$("wsl-project-refresh").onclick = loadWslProject;
updateWslProject(ui.status);
