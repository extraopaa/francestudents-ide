/* ---------- Espace agent : activité, sources, favoris et brouillons ---------- */
const studioEntries = [];
let studioRun = null;
let studioWorkspace = undefined;
let studioTab = "conversation";
let studioActivitySeq = 0;
let favoritePrompts = readStudioStorage("frst.prompt-favorites", []);
if (!Array.isArray(favoritePrompts)) favoritePrompts = [];
const starterFavorites = [
    { title: "Revue des changements", prompt: "Inspecte le diff Git local et recherche les bugs et régressions. Donne les fichiers et lignes concernés, le niveau de gravité et les vérifications utiles, sans modifier le code." },
    { title: "Corriger un bug", prompt: "Reproduis le problème suivant, identifie sa cause, corrige-le puis vérifie la correction : " },
    { title: "Écrire les tests utiles", prompt: "Inspecte le code et les tests existants. Identifie les comportements importants non couverts, ajoute les tests pertinents et lance-les." },
    { title: "Améliorer les performances", prompt: "Cherche un problème de performance mesurable. Établis une mesure de référence, propose et implémente une amélioration puis compare les résultats." },
    { title: "Documenter le projet", prompt: "Vérifie les commandes et le fonctionnement réel du projet, puis mets à jour sa documentation d’installation, d’utilisation et de test." }
];

function readStudioStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeStudioStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { studioFeedback("Le stockage local est indisponible."); }
}
function studioFeedback(message) { $("composer-feedback").textContent = message || ""; }
function studioDraftKey(workspace,mode=typeof motionChatMode!=="undefined"?motionChatMode:"code") {return `frst.draft:${workspace || "global"}${mode==="motion"?":motion":""}`;}
function saveStudioDraft() {
    if (studioWorkspace !== undefined) writeStudioStorage(studioDraftKey(studioWorkspace), input.value);
}
function setAgentTab(tab) {
    studioTab = ["conversation", "backups", "activity", "usage"].includes(tab) ? tab : "conversation";
    $("agent").dataset.tab = studioTab;
    for (const button of document.querySelectorAll("[data-agent-tab]")) {
        const selected = button.dataset.agentTab === studioTab;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-selected", String(selected));
        button.tabIndex = selected ? 0 : -1;
    }
    if (studioTab === "activity" || studioTab === "backups") refreshStudioActivity();
    if (studioTab === "usage") { renderUsageDashboard(); refreshQuota(); }
}
function updateStudioStatus(status) {
    const workspace = status.workspace || null;
    updateAgentProjectLabel(workspace);
    $("agent-access").textContent = status.fullAccess ? "Full accès" : status.autoApprove && status.autoApproveCommands ? "Automatique" : "Sur approbation";
    $("agent-access").classList.toggle("full-access", Boolean(status.fullAccess));
    if (studioWorkspace !== workspace) {
        saveStudioDraft();
        studioWorkspace = workspace;
        studioActivitySeq++;
        $("activity-checkpoints").replaceChildren();
        if (studioTab === "activity" || studioTab === "backups") refreshStudioActivity();
        input.value = readStudioStorage(studioDraftKey(workspace), "");
        autosizeInput();
        if (studioRun && studioRun.workspace !== workspace) { studioRun = null; renderAgentActivity(null); }
    }
}
function updateAgentProjectLabel(workspace=ui.workspace){
    const motion=typeof isMotionOpen==="function" && isMotionOpen();
    $("agent-project-name").textContent=motion?"Projet EffectCraft":workspace?workspace.replace(/[\\/]+$/, "").split(/[\\/]/).pop():"Aucun projet";
    $("agent-project-name").title=motion?"Projet motion indépendant du dossier ouvert dans l’espace code":workspace || "Ouvre un dossier pour travailler sur un projet";
}
let franceStudentProjects=[];
// Phrase de confirmation sous les onglets (créée par 56-chat-layout.js) ; error=true la passe en rouge.
function setFranceStudentProjectState(message,error=false){const state=$("agent-fr-project-state");if(!state)return;state.textContent=message;state.classList.toggle("error",Boolean(error));}
function renderFranceStudentProjects(selected){
    const select=$("agent-fr-project");if(!select)return;
    select.replaceChildren();select.append(new Option("Aucun projet (historique général)",""));
    for(const project of franceStudentProjects){const option=new Option(project.name||"Projet sans nom",String(project.id));option.selected=String(project.id)===String(selected?.id||"");select.append(option)}
    const chatsButton=$("agent-fr-project-chats");if(chatsButton){chatsButton.disabled=!select.value;chatsButton.title=select.value?"Ouvrir une discussion de ce projet":"Choisis un projet pour voir ses discussions";}
    const current=franceStudentProjects.find(project=>String(project.id)===select.value);const name=current?.name||selected?.name||"";
    select.title=select.value?`Nouvelles discussions dans « ${name} »`:"Choisis le projet FranceStudent des nouvelles discussions";
    setFranceStudentProjectState(select.value?`Les nouvelles discussions sont classées dans « ${name} ».`:"Sans projet : les discussions restent dans l’historique général.");
}
async function refreshFranceStudentProjects(){const data=await api.frProjects("list");franceStudentProjects=Array.isArray(data.projects)?data.projects:[];renderFranceStudentProjects(data.selected);
    // Le projet mémorisé n'existe plus sur le site : on le dit au lieu de le garder en silence.
    if(data.forgotten!==undefined)setFranceStudentProjectState(`Le projet « ${data.forgotten||"mémorisé"} » n’existe plus sur FranceStudent. Sans projet : les discussions restent dans l’historique général.`,true);
    return data;}
// ↻ : recharge la liste depuis le site (et revérifie le projet mémorisé).
$("agent-fr-project-refresh")?.addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;setFranceStudentProjectState("Actualisation des projets…");
    try{await refreshFranceStudentProjects();}
    catch(error){setFranceStudentProjectState(`Impossible d’actualiser les projets : ${error.message}`,true);}
    finally{button.disabled=false}
});
// Après la reprise d'une discussion : resélectionne son projet FranceStudent et signale un dossier associé introuvable.
// Le changement de dossier lui-même arrive par le statut (onWorkspaceChanged dans 05-status-model.js).
function afterConversationOpened(result){
    if(!result)return;
    if(result.frProject?.id && $("agent-fr-project")?.value!==String(result.frProject.id))renderFranceStudentProjects(result.frProject);
    if(result.folderMissing)studioFeedback(`Le dossier associé à cette discussion est introuvable : ${result.folderMissing}. La discussion est ouverte dans le dossier actuel.`);
    else if(result.workspaceChanged && result.workspace)studioFeedback(`Dossier du projet ouvert : ${result.workspace}`);
}
async function createFranceStudentProject(){
    const name=await inputDialog("Créer un projet FranceStudent","Donne un nom à ce groupe de conversations.");if(!name)return;
    const result=await api.frProjects("create",{name});franceStudentProjects=result.projects||franceStudentProjects;renderFranceStudentProjects(result.selected);studioFeedback(result.created?`Projet « ${result.selected.name} » créé. Les nouvelles discussions y seront classées.`:`Projet « ${result.selected.name} » sélectionné.`);
}
$("agent-fr-project")?.addEventListener("change",async event=>{
    const select=event.currentTarget;select.disabled=true;
    try{const result=await api.frProjects(select.value?"select":"clear",select.value?{id:select.value}:{});franceStudentProjects=result.projects||franceStudentProjects;renderFranceStudentProjects(result.selected);studioFeedback(result.selected?`Les nouvelles discussions seront classées dans « ${result.selected.name} ».`:"Les nouvelles discussions ne seront rattachées à aucun projet FranceStudent.");}
    catch(error){studioFeedback(error.message);await refreshFranceStudentProjects().catch(()=>{});}finally{select.disabled=false}
});
$("agent-fr-project-create")?.addEventListener("click",()=>createFranceStudentProject().catch(error=>studioFeedback(error.message)));
// Liste les discussions du projet FranceStudent choisi et reprend celle sélectionnée (chargement API si absente localement).
async function openFranceStudentProjectChats(){
    const projectId=$("agent-fr-project")?.value||"";if(!projectId){studioFeedback("Choisis d’abord un projet FranceStudent.");return;}
    const project=franceStudentProjects.find(item=>String(item.id)===projectId);
    const previous=document.activeElement,dialog=document.createElement("dialog");dialog.id="fr-project-chats-dialog";dialog.className="fs-dialog fs-project-chats-dialog";
    studioSurfaceHeader(dialog,{title:"Discussions du projet",subtitle:`Reprends une conversation de « ${project?.name||"Projet sans nom"} ».`,icon:"chat"});
    const status=centerNode("p","fs-section-description","Chargement des discussions…");status.setAttribute("role","status");
    const list=centerNode("div","fs-project-chat-list");list.setAttribute("role","list");
    const more=centerNode("button","","Charger plus");more.type="button";more.hidden=true;
    dialog.append(studioSurfaceSection("Conversations","",[status,list,more]));document.body.append(dialog);
    dialog.addEventListener("close",()=>{dialog.remove();requestAnimationFrame(()=>{if(previous?.isConnected)previous.focus();});},{once:true});
    let cursor="";
    const openChat=async id=>{
 if(ui.status && ui.status.busy){studioFeedback("Une demande est en cours : attends sa fin avant de changer de conversation.");return;}
        dialog.close();
        try{if(isMotionOpen())await closeMotionDesign();const result=await api.conversationsOpen(id,{projectId,projectName:project?.name||""});setAgentTab("conversation");afterConversationOpened(result);}catch(error){studioFeedback(error.message);}
    };
    const load=async()=>{
 more.disabled=true;
 try{
     const data=await api.frProjects("chats",{id:projectId,limit:30,cursorChatId:cursor});const chats=Array.isArray(data?.chats)?data.chats:[];
     for(const chat of chats){
         const id=String(chat?.id||chat?.chatId||"");if(!id)continue;
  const item=centerNode("button","fs-project-chat-item");item.type="button";item.setAttribute("role","listitem");
  const when=chat.updatedAt||chat.updated_at||chat.lastMessageAt||chat.createdAt||chat.created_at;
         const date=when&&!Number.isNaN(new Date(when).getTime())?new Date(when).toLocaleString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
         item.append(centerNode("strong","",chat.title||chat.name||chat.chatName||"Discussion sans titre"),centerNode("span","",[date,chat.model].filter(Boolean).join(" · ")||`ID ${id}`));
         item.title=`Reprendre cette discussion (${id})`;item.onclick=()=>openChat(id);list.append(item);
     }
     const last=chats.at(-1);cursor=last?String(last.id||last.chatId||""):"";more.hidden=!data?.hasMore||!cursor;
     status.textContent=list.children.length?"":"Aucune discussion dans ce projet pour l’instant.";
        }catch(error){status.textContent=error.message;}finally{more.disabled=false;}
    };
    more.onclick=()=>load();dialog.showModal();await load();
}
$("agent-fr-project-chats")?.addEventListener("click",()=>openFranceStudentProjectChats().catch(error=>studioFeedback(error.message)));
// Au démarrage, la session peut ne pas être encore restaurée : on réessaie seul avant d'afficher une erreur,
// puis on recharge quand l'écran de chargement ou le guide de connexion disparaît.
let franceStudentProjectsLoaded=false,franceStudentProjectsRetry=null,franceStudentProjectsLoading=false;
async function loadFranceStudentProjectsAtStartup(attempt=0){
    clearTimeout(franceStudentProjectsRetry);
    if(franceStudentProjectsLoaded || franceStudentProjectsLoading)return;
    franceStudentProjectsLoading=true;
    try{await refreshFranceStudentProjects();franceStudentProjectsLoaded=true;}
    catch(error){
        if(attempt<5){setFranceStudentProjectState("Chargement des projets FranceStudent…");franceStudentProjectsRetry=setTimeout(()=>loadFranceStudentProjectsAtStartup(attempt+1),Math.min(1000*2**attempt,8000));}
        else setFranceStudentProjectState(`Impossible de charger les projets FranceStudent : ${error.message} Utilise ↻ pour réessayer.`,true);
    }finally{franceStudentProjectsLoading=false;}
}
loadFranceStudentProjectsAtStartup();
for(const [id,attribute] of [["startup-loading","hidden"],["connection-guide","class"]]){
    const node=$(id);if(!node)continue;
    new MutationObserver(()=>{const ready=$("startup-loading")?.hidden!==false && $("connection-guide")?.classList.contains("hidden")!==false;if(ready && !franceStudentProjectsLoaded)loadFranceStudentProjectsAtStartup();}).observe(node,{attributes:true,attributeFilter:[attribute]});
}
function recordStudioEntry(entry) {
    if (entry.type === "user" && /^\/new\b/.test(entry.text || "")) studioEntries.length = 0;
    if (["user", "assistant", "tool", "result", "error", "warn", "plan"].includes(entry.type)) {
        studioEntries.push({ ...entry, at: new Date().toISOString() });
        if (studioEntries.length > 3000) studioEntries.shift();
    }
}
function exportStudioMarkdown() {
    const header = `# Conversation FranceStudent ${isMotionOpen()?"Motion design":"Code"}\n\nProjet : ${isMotionOpen()?"EffectCraft":studioWorkspace || "Aucun"}\nExport : ${new Date().toISOString()}\n\n`;
    return header + studioEntries.map(entry => {
        if (entry.type === "user" || entry.type === "assistant") return `## ${entry.type === "user" ? "Vous" : "Agent"}\n\n${entry.text}\n`;
        if (entry.type === "tool") return `**${toolLabel(entry.name)}**\n\n\`\`\`text\n${entry.arg || ""}\n\`\`\`\n`;
        if (entry.type === "plan") return `### Plan\n${(entry.items || []).map(item => `- ${item}`).join("\n")}\n`;
        return `> ${String(entry.text || "").replace(/\n/g, "\n> ")}\n`;
    }).join("\n");
}
function humanDuration(start, end) {
    const seconds = Math.max(0, Math.floor(((end || Date.now()) - start) / 1000));
    return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
function emptyStudioText(parent, text) {
    const note = document.createElement("p"); note.className = "muted"; note.textContent = text; parent.appendChild(note);
}
function renderAgentActivity(run) {
    const motion=typeof isMotionOpen==="function" && isMotionOpen();
    if(run && (!!run.motionDesign!==motion || !motion && run.workspace!==ui.workspace))run=null;
    studioRun = run;
    const steps = run?.steps || [];
    if (!ui.replayingConversation) renderWorkPlan(steps, { status: run?.status || "idle" });
    const overview = $("activity-overview"); overview.replaceChildren();
    const timeline = $("activity-timeline"); timeline.replaceChildren();
    const sources = $("activity-sources"); sources.replaceChildren();
    if (!run) {
        emptyStudioText(overview, "Les actions, les commandes et les sources apparaîtront ici dès la prochaine demande.");
        return;
    }
    const status = { running: "En cours", done: "Terminée", failed: "À vérifier", interrupted: "Interrompue" }[run.status] || run.status;
    const title = document.createElement("div"); title.className = "run-title"; title.textContent = run.prompt;
    const line = document.createElement("p"); line.className = `run-status run-status-${run.status}`; line.textContent = `${status} · ${humanDuration(run.startedAt, run.endedAt)}`;
    const stats = document.createElement("div"); stats.className = "activity-stats";
    for (const [value, label] of [[run.commands, "commandes"], [run.reads, "explorations"], [run.writes, "écritures"]]) {
        const stat = document.createElement("div"); const number = document.createElement("strong"); number.textContent = value || 0;
        const name = document.createElement("small"); name.textContent = label; stat.append(number, name); stats.appendChild(stat);
    }
    overview.append(title, line, stats);
    for (const action of (run.actions || []).slice().reverse()) {
        const row = document.createElement("details"); row.className = `activity-action activity-action-${action.status}`;
        const summary = document.createElement("summary"); summary.textContent = `${action.status === "done" ? "✓" : action.status === "running" ? "◉" : "!"} ${toolLabel(action.name)} · ${humanDuration(action.startedAt, action.endedAt)}`;
        const body = document.createElement("pre"); body.textContent = [action.argument, action.result].filter(Boolean).join("\n\n");
        row.append(summary, body); timeline.appendChild(row);
    }
    if (!run.actions?.length) emptyStudioText(timeline, "L’agent prépare sa prochaine action.");
    for (const source of run.sources || []) {
        const row = document.createElement("button"); row.type = "button"; row.className = "source-card";
        const title = document.createElement("strong"); title.textContent = source.title;
        const meta = document.createElement("small");
        try { meta.textContent = `${new URL(source.url).hostname} · ${source.consulted ? "Source consultée" : "Résultat de recherche"}`; } catch { continue; }
        row.append(title, meta); row.onclick = () => api.openExternal(source.url).catch(error => studioFeedback(error.message)); sources.appendChild(row);
    }
    if (!run.sources?.length) emptyStudioText(sources, "Les liens sont distingués selon qu’ils ont été trouvés ou effectivement consultés.");
}
async function refreshStudioActivity() {
    const seq = ++studioActivitySeq;
    try {
        const motion=isMotionOpen();
        const [run, jobs, checkpoints] = await Promise.all([api.agentActivity(), motion?[]:api.backgroundJobs("list"), motion?[]:api.checkpoints("list")]);
        if (seq !== studioActivitySeq) return;
        renderAgentActivity(run);
        const jobsHost = $("activity-jobs"); jobsHost.replaceChildren();
        if (!jobs.length) emptyStudioText(jobsHost, "Aucune commande en arrière-plan.");
        for (const job of jobs) {
            const row = document.createElement("div"); row.className = "workspace-item";
            const label = document.createElement("div"); label.textContent = `${job.id} · ${job.command}`;
            const meta = document.createElement("small"); meta.textContent = `${job.status} · ${Math.floor(job.duration_ms / 1000)} s${job.exit_code !== null ? ` · code ${job.exit_code}` : ""}`;
            const output = document.createElement("button"); output.type = "button"; output.textContent = "Sortie";
            output.onclick = async () => { try { const result = await api.backgroundJobs("output", job.id); $("activity-job-output").textContent = result.output || "Aucune sortie."; $("activity-job-output").classList.remove("hidden"); } catch (error) { studioFeedback(error.message); } };
            row.append(label, meta, output);
            if (job.status === "running") {
                const stop = document.createElement("button"); stop.type = "button"; stop.textContent = "Arrêter";
                stop.onclick = () => api.backgroundJobs("stop", job.id).then(refreshStudioActivity).catch(error => studioFeedback(error.message)); row.appendChild(stop);
            }
            jobsHost.appendChild(row);
        }
        const pointsHost = $("activity-checkpoints"); pointsHost.replaceChildren();
        if (!checkpoints.length) emptyStudioText(pointsHost, motion ? "Les sauvegardes des fichiers sont disponibles dans l’espace Code." : "Les versions disponibles apparaîtront ici après une demande à l’agent.");
        for (const point of checkpoints) {
            const row = document.createElement("div"); row.className = "workspace-item";
            const label = document.createElement("div"); label.textContent = point.task || "Version sans titre";
            const time = document.createElement("small"); time.textContent = `${new Date(point.at).toLocaleString("fr-FR")} · ${point.kind === "safety" ? "Sécurité avant restauration" : "Avant la demande"}`;
            const restore = document.createElement("button"); restore.type = "button"; restore.textContent = "Voir et restaurer"; restore.disabled = Boolean(ui.status.busy);
            restore.onclick = async () => {
                if (ui.tabs.some(tab => tab.dirty)) { studioFeedback("Enregistre tous les fichiers ouverts avant de restaurer une version."); return; }
                restore.disabled = true;
                try {
                    const preview = await api.checkpoints("preview", point.id);
                    if (!preview.changes.length) { studioFeedback("Les fichiers suivis correspondent déjà à cette version."); return; }
                    if (preview.changes.length > 100) { studioFeedback("Plus de 100 fichiers diffèrent : restauration désactivée pour éviter un aperçu incomplet."); return; }
                    const details = preview.changes.map(change => `${change.action} : ${change.path}`).join("\n");
                    const excluded = preview.excludedPaths || [];
                    const excludedDetails = excluded.length ? `\n\nChemins exclus (${excluded.length}) :\n${excluded.slice(0, 20).join("\n")}${excluded.length > 20 ? `\n… et ${excluded.length - 20} autre(s).` : ""}` : "";
                    const message = `Revenir à l’état précédant « ${point.task} » ?\n\n${details}\n\nTous les changements listés depuis cette version seront annulés, y compris tes modifications manuelles et celles des demandes suivantes. Les fichiers marqués « retirer » seront supprimés. Une version de sécurité sera créée avant la restauration.${excludedDetails}\n\nLes chemins exclus et les actions externes ne sont pas restaurés.`;
                    if (!await confirmStudioAction(message, { title: "Restaurer une version", confirmLabel: "Restaurer", danger: true })) return;
                    if (ui.tabs.some(tab => tab.dirty)) throw new Error("Enregistre tous les fichiers ouverts avant de restaurer une version.");
                    const workspace = ui.workspace;
                    const result = await api.checkpoints("restore", point.id, preview.expected);
                    let dirtyRemoved = false;
                    if (ui.workspace === workspace) {
                        for (const change of preview.changes.filter(item => item.action === "retirer")) {
                            const tab = ui.tabs.find(item => item.path === change.path);
                            if (!tab) continue;
                            if (tab.dirty) { dirtyRemoved = true; continue; }
                            await closeTab(tab.path);
                        }
                    }
                    studioFeedback(`${result.restored} fichier(s) restauré(s).${dirtyRemoved ? " Un onglet modifié reste ouvert alors que son fichier a été retiré : vérifie son contenu avant de l’enregistrer." : ""}`);
                    scheduleRefresh(); refreshStudioActivity();
                } catch (error) { studioFeedback(error.message); scheduleRefresh(); refreshStudioActivity(); }
                finally { restore.disabled = Boolean(ui.status.busy); }
            };
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Supprimer la version"; remove.disabled = Boolean(ui.status.busy);
            remove.onclick = async () => {
                if (!await confirmStudioAction(`Supprimer définitivement la version « ${point.task || "sans titre"} » ? Les fichiers actuels ne seront pas modifiés.`, { title: "Supprimer une version", confirmLabel: "Supprimer", danger: true })) return;
                remove.disabled = true;
                try { await api.checkpoints("remove", point.id); studioFeedback("Version supprimée."); await refreshStudioActivity(); }
                catch (error) { studioFeedback(error.message); }
                finally { remove.disabled = Boolean(ui.status.busy); }
            };
            row.append(label, time, restore, remove); pointsHost.appendChild(row);
        }
    } catch (error) { studioFeedback(error.message); }
}
function renderFavoritePrompts() {
    const list = $("favorite-list"); list.replaceChildren();
    for (const [index, favorite] of [...favoritePrompts, ...starterFavorites].entries()) {
        const row = document.createElement("div"); row.className = "favorite-row";
        const use = document.createElement("button"); use.type = "button"; use.textContent = favorite.title; use.title = favorite.prompt;
        use.onclick = () => { input.value = favorite.prompt; saveStudioDraft(); autosizeInput(); setAgentTab("conversation"); $("agent-favorites").classList.add("hidden"); input.focus(); };
        row.appendChild(use);
        if (index < favoritePrompts.length) {
            const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", `Retirer ${favorite.title}`);
            remove.onclick = () => { favoritePrompts.splice(index, 1); writeStudioStorage("frst.prompt-favorites", favoritePrompts); renderFavoritePrompts(); }; row.appendChild(remove);
        }
        list.appendChild(row);
    }
}

for (const button of document.querySelectorAll("[data-agent-tab]")) {
    button.onclick = () => setAgentTab(button.dataset.agentTab);
    button.onkeydown = event => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...document.querySelectorAll("[data-agent-tab]")];
        const next = tabs[(tabs.indexOf(button) + (event.key === "ArrowLeft" ? tabs.length - 1 : 1)) % tabs.length];
        setAgentTab(next.dataset.agentTab); next.focus();
    };
}
for (const button of document.querySelectorAll("[data-starter]")) button.onclick = () => { input.value = button.dataset.starter; autosizeInput(); saveStudioDraft(); input.focus(); };
$("agent-access").onclick = () => showSideView("settings");
function setAgentFocus(active){
    $("app").classList.toggle("focus-agent",active);
    const button=$("agent-focus"),label=active?"Quitter le plein écran du chat":"Agrandir le chat";
    button.setAttribute("aria-pressed",String(active));button.setAttribute("aria-label",label);button.title=label;
    button.textContent=active?"⤡":"⤢";
}
$("agent-focus").onclick = () => setAgentFocus(!$("app").classList.contains("focus-agent"));
setAgentFocus(false);
$("activity-refresh").onclick = refreshStudioActivity;
// Interrupteur des sauvegardes automatiques (réglage checkpointBackupsEnabled).
// Jamais choisi (undefined) = activé, comme côté agent (!== false).
const backupsToggle = $("backups-enabled");
function renderBackupsToggle(enabled) {
    backupsToggle.checked = enabled;
    $("backups-enabled-label").textContent = enabled ? "Activées" : "Désactivées";
}
async function loadBackupsToggle() {
    try { renderBackupsToggle(await api.checkpointPreference("get") !== false); }
    catch (error) { studioFeedback(error.message); }
}
backupsToggle.onchange = async () => {
    const wanted = backupsToggle.checked;
    if (wanted && !await confirmStudioAction("Les sauvegardes automatiques consomment énormément de stockage : l’IDE copie les fichiers du projet avant chaque demande modifiable de l’agent. Sur un projet moyen ou grand, ces copies peuvent occuper plusieurs gigaoctets. Activer quand même ?", { title: "Activer les sauvegardes automatiques ?", confirmLabel: "Activer quand même" })) {
        renderBackupsToggle(false);
        return;
    }
    backupsToggle.disabled = true;
    try {
        renderBackupsToggle(await api.checkpointPreference("set", wanted));
        studioFeedback(wanted ? "Sauvegardes automatiques activées. Surveille l’espace disque." : "Sauvegardes automatiques désactivées : aucune nouvelle version ne sera créée avant les demandes.");
    } catch (error) {
        renderBackupsToggle(!wanted);
        studioFeedback(error.message);
    } finally {
        backupsToggle.disabled = false;
    }
};
loadBackupsToggle();
$("backups-refresh").onclick = () => { loadBackupsToggle(); refreshStudioActivity(); };
$("favorite-open").onclick = () => { renderFavoritePrompts(); $("agent-favorites").classList.toggle("hidden"); };
$("favorite-close").onclick = () => $("agent-favorites").classList.add("hidden");
$("draft-save-favorite").onclick = () => {
    const prompt = input.value.trim();
    if (!prompt) { studioFeedback("Écris un prompt avant de l’enregistrer."); return; }
    if (favoritePrompts.length >= 30) { studioFeedback("Tu as déjà 30 favoris. Retire un favori pour en ajouter un."); return; }
    favoritePrompts.unshift({ title: prompt.replace(/\s+/g, " ").slice(0, 55), prompt: prompt.slice(0, 30000) });
    writeStudioStorage("frst.prompt-favorites", favoritePrompts); studioFeedback("Prompt enregistré en favori.");
};
$("conversation-export").onclick = () => api.exportConversation(exportStudioMarkdown()).then(result => studioFeedback(result.canceled ? "Export annulé." : "Conversation exportée.")).catch(error => studioFeedback(error.message));
input.addEventListener("input", saveStudioDraft);
window.addEventListener("beforeunload", saveStudioDraft);
transcript.addEventListener("click", event => {
    const link = event.target.closest("a[data-web-url]");
    if (link) { event.preventDefault(); api.openExternal(link.dataset.webUrl).catch(error => studioFeedback(error.message)); }
});
setInterval(() => { if ((studioTab === "activity" || studioTab === "backups") && !document.hidden) refreshStudioActivity(); }, 3000);
setAgentTab("conversation");
