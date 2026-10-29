/* Pending prompts live directly above the composer. */
let queueSnapshot = { tasks: [], enabled: false };
let inlineEditingId = null;
let pendingRenderSignature = null;
let draggedPendingId = null;
function clearPendingDropMarkers() {
    document.querySelectorAll(".pending-drop-before, .pending-drop-after, .pending-dragging").forEach(row => row.classList.remove("pending-drop-before", "pending-drop-after", "pending-dragging"));
}
async function editQueuedPrompt(task,attach=false){
    try{
        const result=await api.taskQueue("attachments",{id:task.id});
        inlineEditingId=task.id;input.value=task.prompt;pendingAttachments=result.attachments||[];renderAttachments();autosizeInput();saveStudioDraft();input.focus();
        studioFeedback("Modifie le prompt ou ses fichiers · Entrée pour enregistrer · Échap pour annuler");
        if(attach)$("attach-input").click();
    }catch(error){studioFeedback(error.message);}
}
function renderTaskQueue(snapshot) {
    if (!snapshot) return;
    queueSnapshot = snapshot;
    renderInlinePending(snapshot);
}
async function queueAction(action, payload = {}) {
    try {
        renderTaskQueue(await api.taskQueue(action, payload));
        return true;
    } catch (error) {
        studioFeedback(error.message);
        return false;
    }
}
function refreshTaskQueue() {
    inlineEditingId = null;
    return api.taskQueue("list").then(renderTaskQueue).catch(error => studioFeedback(error.message));
}

function renderInlinePending(snapshot) {
    const host = $("pending-prompts");
    if (!host) return;
    const waiting = (snapshot?.tasks || []).filter(task => ["pending", "steering"].includes(task.status));
    const signature = JSON.stringify([waiting, snapshot.enabled, Boolean(ui.status.canSteer)]);
    if (signature === pendingRenderSignature) return;
    pendingRenderSignature = signature;
    const openMenus = new Set([...host.querySelectorAll(".pending-menu[open]")].map(menu => menu.dataset.taskId));
    host.replaceChildren();
    host.classList.toggle("hidden", !waiting.length);
    if (waiting.length && !snapshot.enabled) {
        const paused = document.createElement("div"); paused.className = "pending-paused";
        const label = document.createElement("span"); label.textContent = `En pause · ${waiting.length} demande(s) en attente`;
        const resume = document.createElement("button"); resume.type = "button"; resume.textContent = "Reprendre"; resume.onclick = () => queueAction("start");
        paused.append(label, resume); host.appendChild(paused);
    }
    for (const task of waiting) {
        const row = document.createElement("div"); row.className = "pending-prompt";
        const icon = document.createElement("span"); icon.className = "pending-icon"; icon.textContent = "↳";
        if (task.status === "pending") {
            const handle = document.createElement("span"); handle.className = "pending-drag-handle";
            handle.textContent = "⠿"; handle.draggable = true;
            handle.title = "Glisser pour réorganiser ; utiliser le menu pour monter ou descendre au clavier";
            handle.setAttribute("aria-hidden", "true");
            handle.addEventListener("dragstart", event => {
                draggedPendingId = task.id;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", task.id);
                row.classList.add("pending-dragging");
            });
            handle.addEventListener("dragend", () => { draggedPendingId = null; clearPendingDropMarkers(); });
            row.addEventListener("dragover", event => {
                if (!draggedPendingId || draggedPendingId === task.id) return;
                event.preventDefault(); event.dataTransfer.dropEffect = "move";
                host.querySelectorAll(".pending-drop-before, .pending-drop-after").forEach(item => item.classList.remove("pending-drop-before", "pending-drop-after"));
                const before = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
                row.classList.add(before ? "pending-drop-before" : "pending-drop-after");
            });
            row.addEventListener("dragleave", event => {
                if (!row.contains(event.relatedTarget)) row.classList.remove("pending-drop-before", "pending-drop-after");
            });
            row.addEventListener("drop", event => {
                if (!draggedPendingId || draggedPendingId === task.id) return;
                event.preventDefault();
                const id = draggedPendingId;
                const position = event.clientY < row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 ? "before" : "after";
                draggedPendingId = null; clearPendingDropMarkers();
                queueAction("move", { id, targetId: task.id, position });
            });
            row.appendChild(handle);
        }
        const text = document.createElement("span"); text.className = "pending-text"; text.textContent = task.prompt; text.title = task.prompt;
        if(task.attachments?.length){const files=document.createElement("small");files.className="pending-attachments";files.textContent="📎 "+task.attachments.map(file=>file.name).join(", ");files.title=files.textContent;text.append(files);}
        const steer = document.createElement("button"); steer.type = "button"; steer.className = "pending-steer"; steer.textContent = task.status === "steering" ? "Transmise…" : "Orienter";
        steer.title = "Transmettre cette consigne à l’agent en cours dès sa prochaine étape";
        steer.disabled = !ui.status.canSteer || task.status !== "pending" || task.mode === "plan";
        if(task.attachments?.length)steer.title="Transmettre cette consigne et ses fichiers à la prochaine étape de l’agent.";
        steer.onclick = () => queueAction("steer", { id: task.id });
        const remove = document.createElement("button"); remove.type = "button"; remove.className = "pending-remove"; remove.title = "Supprimer ce prompt en attente"; remove.setAttribute("aria-label", `Supprimer : ${task.prompt.slice(0, 50)}`);
        remove.innerHTML = '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3M10 10v7M14 10v7"/></svg>';
        remove.onclick = () => queueAction("remove", { id: task.id });
        const menu = document.createElement("details"); menu.className = "pending-menu";
        menu.dataset.taskId = task.id; menu.open = openMenus.has(String(task.id));
        const summary = document.createElement("summary"); summary.textContent = "⋯"; summary.setAttribute("aria-label", "Actions sur le prompt");
        const actions = document.createElement("div"); actions.className = "pending-menu-items";
        const action = (label, callback) => { const button = document.createElement("button"); button.type = "button"; button.textContent = label; button.onclick = () => { menu.open = false; callback(); }; actions.appendChild(button); };
        if (task.status === "pending") {
            action("Modifier", () => editQueuedPrompt(task));
            action("Joindre un fichier", () => editQueuedPrompt(task,true));
            action("Monter", () => queueAction("move", { id: task.id, direction: "up" }));
            action("Descendre", () => queueAction("move", { id: task.id, direction: "down" }));
        }
        menu.append(summary, actions); row.append(icon, text, steer, remove, menu); host.appendChild(row);
    }
}

