"use strict";
let key = "";
try { key = sessionStorage.getItem("ide-link-key") || ""; } catch { /* Stockage facultatif. */ }
history.replaceState(null, "", location.pathname);
const status = document.getElementById("status"), messages = document.getElementById("messages"), form = document.getElementById("form"), prompt = document.getElementById("prompt");
const chatScroll = document.querySelector(".chat-main");
let chatFollowing = true, chatScrollFrame = null;
function followChatBottom() {
    if (!chatFollowing) return;
    chatScroll.scrollTop = chatScroll.scrollHeight;
    if (chatScrollFrame !== null) return;
    chatScrollFrame = requestAnimationFrame(() => {
        chatScrollFrame = null;
        if (chatFollowing) chatScroll.scrollTop = chatScroll.scrollHeight;
    });
}
chatScroll.addEventListener("scroll", () => {
    if (chatScrollFrame !== null || !chatScroll.clientHeight) return;
    chatFollowing = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight <= 24;
}, { passive: true });
chatScroll.addEventListener("wheel", event => {
    if (event.deltaY < 0 && chatScroll.scrollHeight > chatScroll.clientHeight) chatFollowing = false;
}, { passive: true });
let chatTouchY = null;
chatScroll.addEventListener("touchstart", event => { chatTouchY = event.touches[0]?.clientY ?? null; }, { passive: true });
chatScroll.addEventListener("touchmove", event => {
    const y = event.touches[0]?.clientY;
    if (chatTouchY !== null && y > chatTouchY && chatScroll.scrollHeight > chatScroll.clientHeight) chatFollowing = false;
    chatTouchY = y ?? null;
}, { passive: true });
const chatResizeObserver = new ResizeObserver(() => followChatBottom());
chatResizeObserver.observe(chatScroll);
chatResizeObserver.observe(messages);
chatResizeObserver.observe(document.getElementById("interactive-prompts"));
async function call(route, options = {}) {
    const response = await fetch(route, { ...options, cache: "no-store", headers: { "Authorization": `Bearer ${key}`, ...(options.headers || {}) } });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || "Connexion impossible."); error.status = response.status; throw error; }
    return data;
}
const pairForm = document.getElementById("pair-form"), pairPin = document.getElementById("pair-pin");
pairForm.hidden = Boolean(key);
form.hidden = !key;
pairForm.addEventListener("submit", async event => {
    event.preventDefault();
    const button = pairForm.querySelector('button[type="submit"]'); button.disabled = true;
    try {
        const result = await call("/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: pairPin.value }) });
        key = result.token;
        try { sessionStorage.setItem("ide-link-key", key); } catch { /* Stockage facultatif. */ }
        pairPin.value = ""; pairForm.hidden = true; form.hidden = false; await refresh();
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
});
async function controlQueue(action, id, extra = {}) {
    try {
        await call("/api/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, ...extra }) });
        await refresh();
        return true;
    } catch (error) { status.textContent = error.message; return false; }
}
document.getElementById("stop-task").addEventListener("click", () => controlQueue("interrupt"));
const queued = document.getElementById("queued-prompts");
let queueSignature = "", editingQueueId = null;
function renderQueue(queue) {
    const waiting = (queue?.tasks || []).filter(task => task.status === "pending" || task.status === "steering");
    const signature = JSON.stringify([waiting, queue?.enabled, queue?.canSteer]);
    if (signature === queueSignature) return;
    queueSignature = signature;
    const openMenus = new Set([...queued.querySelectorAll('details[open]')].map(el => el.dataset.id));
    const editor = queued.querySelector('.queue-editor');
    const draft = editor?.value;
    queued.replaceChildren(); queued.hidden = !waiting.length;
    if (editingQueueId && !waiting.some(task => task.id === editingQueueId && task.status === 'pending')) editingQueueId = null;
    if (waiting.length && !queue.enabled) {
        const paused = document.createElement('div'), label = document.createElement('span'), resume = document.createElement('button');
        paused.className = 'queue-paused'; label.textContent = `En pause · ${waiting.length} demande(s) en attente`;
        resume.type = 'button'; resume.textContent = 'Reprendre'; resume.onclick = () => controlQueue('start');
        paused.append(label, resume); queued.append(paused);
    }
    for (const task of waiting) {
        const row = document.createElement('div'); row.className = 'queue-row'; row.dataset.id = task.id;
        const icon = document.createElement('span'); icon.className = 'queue-icon'; icon.textContent = '↳';
        const body = document.createElement('div'); body.className = 'queue-body';
        if (editingQueueId === task.id) {
            const edit = document.createElement('textarea'); edit.className = 'queue-editor'; edit.maxLength = 30000; edit.setAttribute('aria-label', 'Modifier la demande en attente'); edit.value = draft ?? task.prompt;
            const save = document.createElement('button'), cancel = document.createElement('button');
            save.type = cancel.type = 'button'; save.textContent = 'Enregistrer'; cancel.textContent = 'Annuler';
            save.onclick = async () => { if (!edit.value.trim()) { status.textContent = 'La demande ne peut pas être vide.'; return; } save.disabled = true; if (await controlQueue('edit', task.id, { prompt: edit.value })) { editingQueueId = null; queueSignature = ''; await refresh(); } else save.disabled = false; };
            cancel.onclick = () => { editingQueueId = null; queueSignature = ''; renderQueue(queue); };
            body.append(edit, save, cancel);
        } else {
            const text = document.createElement('span'); text.className = 'queue-text'; text.textContent = task.prompt; text.title = task.prompt; body.append(text);
            if (task.attachments?.length) { const files = document.createElement('small'); files.className = 'queue-files'; files.textContent = `📎 ${task.attachments.map(file => file.name).join(', ')}`; body.append(files); }
        }
        const steer = document.createElement('button'); steer.type = 'button'; steer.textContent = task.status === 'steering' ? 'Transmise…' : 'Orienter'; steer.disabled = !queue.canSteer || task.status !== 'pending' || task.mode === 'plan'; steer.title = 'Transmettre cette consigne à l’agent en cours'; steer.onclick = () => controlQueue('steer', task.id);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'queue-remove'; remove.textContent = '🗑'; remove.setAttribute('aria-label', `Supprimer : ${task.prompt.slice(0, 50)}`); remove.onclick = () => controlQueue('remove', task.id);
        const menu = document.createElement('details'), summary = document.createElement('summary'), actions = document.createElement('div');
        menu.className = 'queue-menu'; menu.dataset.id = task.id; menu.open = openMenus.has(String(task.id)); summary.textContent = '⋯'; summary.setAttribute('aria-label', 'Actions sur le prompt'); actions.className = 'queue-menu-items';
        const action = (label, callback) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.onclick = () => { menu.open = false; callback(); }; actions.append(button); };
        if (task.status === 'pending') {
            action('Modifier', () => { editingQueueId = task.id; queueSignature = ''; renderQueue(queue); queued.querySelector('.queue-editor')?.focus(); });
            const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.multiple = true; fileInput.className = 'visually-hidden'; fileInput.setAttribute('aria-label', 'Fichiers pour la demande en attente');
            fileInput.addEventListener('change', async () => {
                if (!fileInput.files.length) return;
                try { const attachments = await prepareAttachments(fileInput); await controlQueue('attach', task.id, { attachments }); }
                catch (error) { status.textContent = error.message; }
                finally { fileInput.value = ''; }
            });
            row.append(fileInput);
            action('Joindre un fichier', () => fileInput.click());
            action('Monter', () => controlQueue('move', task.id, { direction: 'up' }));
            action('Descendre', () => controlQueue('move', task.id, { direction: 'down' }));
        }
        menu.append(summary, actions); row.append(icon, body, steer, remove, menu); queued.append(row);
    }
}
const interactive = document.getElementById("interactive-prompts");
let pendingSignature = "";
function renderPending(items) {
    const signature = JSON.stringify(items);
    if (signature === pendingSignature) return;
    pendingSignature = signature; interactive.replaceChildren();
    for (const item of items) {
        const box = document.createElement("form"), title = document.createElement("h2"), question = document.createElement("p");
        title.textContent = item.kind === "confirm" || item.kind === "command" ? "Confirmation requise" : "Question de l’agent";
        question.textContent = item.question; box.append(title, question);
        if (item.prefix) { const prefix = document.createElement("pre"); prefix.textContent = item.prefix; box.append(prefix); }
        async function respond(answer) {
            for (const button of box.querySelectorAll("button")) button.disabled = true;
            try { await call("/api/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, answer }) }); await refresh(); }
            catch (error) { status.textContent = error.message; for (const button of box.querySelectorAll("button")) button.disabled = false; }
        }
        const button = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.addEventListener("click", fn); box.append(b); };
        if (item.kind === "confirm" || item.kind === "command") {
            button("Autoriser", () => respond("o")); button("Refuser", () => respond("n"));
        } else {
            for (const option of item.options || []) {
                const label = document.createElement("label"), input = document.createElement("input"), text = document.createElement("span");
                input.type = item.multiple ? "checkbox" : "radio"; input.name = `option-${item.id}`; input.value = option.id;
                text.textContent = option.label + (option.description ? ` — ${option.description}` : ""); label.append(input, text); box.append(label, document.createElement("br"));
            }
            const input = document.createElement("textarea"); input.maxLength = 4000; input.placeholder = item.placeholder || "Écris ta réponse…"; box.append(input);
            button("Répondre", () => respond(item.kind === "question" ? { selected: [...box.querySelectorAll('input:checked')].map(el => el.value), text: input.value } : input.value));
            if (item.kind === "question") button("Passer", () => respond({ skipped: true }));
        }
        box.addEventListener("submit", event => event.preventDefault()); interactive.append(box);
    }
}
function renderWorkPlan(plan) {
    const host = document.getElementById("agent-live-plan");
    const steps = (Array.isArray(plan?.steps) ? plan.steps : []).filter(item => item && typeof item.step === "string" && item.step.trim());
    const status = plan?.status || "idle";
    const signature = JSON.stringify({ steps, status });
    if (host.dataset.signature === signature) return;
    host.dataset.signature = signature;
    if (!steps.length) { host.replaceChildren(); host.hidden = true; return; }
    const previous = host.querySelector("details"), wasFocused = previous?.querySelector("summary") === document.activeElement;
    const previousScroll = host.querySelector("ol")?.scrollTop || 0;
    const detail = document.createElement("details"); detail.open = previous ? previous.open : status !== "history";
    const done = steps.filter(step => step.status === "completed").length, complete = done === steps.length;
    const label = complete ? "Terminé" : status === "interrupted" ? "Interrompu" : ["done", "failed"].includes(status) ? "À poursuivre" : status === "history" ? "Historique" : "En cours";
    host.dataset.state = complete ? "completed" : status;
    const summary = document.createElement("summary"), heading = document.createElement("span"); heading.className = "work-plan-heading";
    const title = document.createElement("strong"); title.textContent = "Plan de travail";
    const count = document.createElement("span"); count.className = "work-plan-count"; count.textContent = `${done}/${steps.length}`;
    const state = document.createElement("span"); state.className = "work-plan-state"; state.textContent = label;
    const chevron = document.createElement("span"); chevron.className = "work-plan-chevron"; chevron.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
    heading.append(title, count, state, chevron);
    const progress = document.createElement("progress"); progress.max = steps.length; progress.value = done;
    progress.setAttribute("aria-label", `${done} étape${done > 1 ? "s" : ""} terminée${done > 1 ? "s" : ""} sur ${steps.length}`);
    summary.append(heading, progress);
    const list = document.createElement("ol"); list.className = "work-plan-steps";
    steps.forEach((step, index) => {
        const row = document.createElement("li"); row.dataset.status = step.status;
        if (step.status === "in_progress") row.setAttribute("aria-current", "step");
        const marker = document.createElement("span"); marker.className = "work-plan-marker"; marker.setAttribute("aria-hidden", "true");
        if (step.status === "completed") marker.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg>'; else marker.textContent = String(index + 1);
        const accessibleStatus = document.createElement("span"); accessibleStatus.className = "work-plan-sr-status"; accessibleStatus.textContent = step.status === "completed" ? "Terminée : " : step.status === "in_progress" ? "En cours : " : "À venir : ";
        const text = document.createElement("span"); text.className = "work-plan-step-text"; text.textContent = step.step;
        row.append(marker, accessibleStatus, text); list.append(row);
    });
    detail.append(summary, list); host.replaceChildren(detail); host.hidden = false;
    list.scrollTop = previousScroll; if (wasFocused) summary.focus();
}
let last = "";
async function refresh() {
    if (!key) { if (!pairPin.value) status.textContent = "Entre le code PIN affiché sur l’ordinateur pour te connecter."; return; }
    try {
        const data = await call("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        status.textContent = "Connecté · Conversation du PC";
        renderPending(data.pending || []);
        renderQueue(data.queue || { tasks: [] });
        renderWorkPlan(data.plan);
        const signature = JSON.stringify([data.history, data.live]);
        if (signature === last) return;
        last = signature;
        const openGroups = [...messages.querySelectorAll('.tool-group details')].map(details => details.open);
        const previousChatScroll = chatScroll.scrollTop;
        messages.replaceChildren();
        const quietTools = new Set(['read_file', 'search_files', 'list_directory']);
        let group = null, groupIndex = 0;
        for (const item of [...data.history, ...(data.live ? [{ type: 'assistant', text: data.live }] : [])]) {
            const element = document.createElement('div');
            element.className = `entry ${item.type}`;
            if (item.type === 'tool') {
                const dot = document.createElement('span'), name = document.createElement('span'), arg = document.createElement('span');
                dot.className = 'tdot'; name.className = 'name'; arg.className = 'arg';
                name.textContent = toolLabel(item.name); arg.textContent = item.arg || ''; arg.title = item.arg || '';
                element.append(dot, name, arg);
                if (quietTools.has(item.name)) {
                    if (!group) {
                        const wrapper = document.createElement('div'), details = document.createElement('details'), summary = document.createElement('summary'), body = document.createElement('div');
                        wrapper.className = 'entry tool-group'; body.className = 'tool-group-body';
                        details.open = !!openGroups[groupIndex++]; details.append(summary, body); wrapper.append(details); messages.append(wrapper);
                        group = { summary, body, reads: 0, searches: 0, lists: 0, awaitingResult: false };
                    }
                    if (item.name === 'read_file') group.reads++;
                    else if (item.name === 'search_files') group.searches++;
                    else group.lists++;
                    const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;
                    const parts = [];
                    if (group.reads) parts.push(plural(group.reads, 'lecture'));
                    if (group.searches) parts.push(plural(group.searches, 'recherche'));
                    if (group.lists) parts.push(`${plural(group.lists, 'dossier')} listé${group.lists > 1 ? 's' : ''}`);
                    group.summary.textContent = parts.join(' · '); group.body.append(element); group.awaitingResult = true;
                    continue;
                }
            } else if (item.type === 'result' && group && group.awaitingResult) {
                element.textContent = `└ ${item.text || ''}`;
                if (item.tone === 'error' || item.tone === 'err') element.classList.add('error');
                group.body.append(element); group.awaitingResult = false; continue;
            } else if (item.type === 'assistant') {
                const content = document.createElement('div'); content.className = 'message-content';
                content.innerHTML = String(item.text || '').length > 64000 ? escapeHtml(item.text) : renderMarkdown(item.text || '');
                element.append(content);
            } else if (item.type === 'user') {
                const author = document.createElement('span'), content = document.createElement('div');
                author.className = 'message-author'; author.textContent = 'Vous';
                content.className = 'message-content'; content.textContent = item.text || ''; element.append(author, content);
            } else if (item.type === 'print') {
                const pre = document.createElement('pre'); pre.textContent = (item.lines || []).join('\n'); element.append(pre);
            } else {
                element.textContent = (item.type === 'result' ? '└ ' : '') + (item.text || '');
            }
            group = null;
            messages.append(element);
        }
        if (chatFollowing) followChatBottom();
        else chatScroll.scrollTop = previousChatScroll;
    } catch (error) {
        if (error.status === 401 || error.status === 429) {
            key = ""; renderWorkPlan(null); try { sessionStorage.removeItem("ide-link-key"); } catch { /* Stockage facultatif. */ }
            pairForm.hidden = false; form.hidden = true; messages.replaceChildren(); interactive.replaceChildren(); queued.replaceChildren(); queued.hidden = true; last = ""; pendingSignature = ""; queueSignature = ""; editingQueueId = null;
            status.textContent = "Session expirée : saisis le code PIN affiché sur l’ordinateur.";
        } else status.textContent = error.message;
    }
}
const attachmentInput = document.getElementById("attachments"), attachmentList = document.getElementById("attachment-list");
function showAttachments() {
    const files = [...attachmentInput.files];
    attachmentList.textContent = files.length ? `Pièces jointes : ${files.map(file => file.name).join(", ")}` : "";
}
attachmentInput.addEventListener("change", showAttachments);
async function prepareAttachments(input = attachmentInput) {
    const files = [...input.files];
    if (files.length > 4 || files.reduce((sum, file) => sum + file.size, 0) > 2 * 1024 * 1024) throw new Error("Choisis au maximum 4 fichiers et 2 Mo au total.");
    return Promise.all(files.map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Impossible de lire une pièce jointe."));
        reader.onload = () => {
            const mime = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(file.type) ? file.type : "application/octet-stream";
            const base64 = String(reader.result).split(",", 2)[1];
            if (!base64) return reject(new Error("Les fichiers vides ne sont pas pris en charge."));
            resolve({ name: file.name, kind: mime.startsWith("image/") ? "image" : "file", data: `data:${mime};base64,${base64}` });
        };
        reader.readAsDataURL(file);
    })));
}
form.addEventListener("submit", async event => {
    event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
    try { const attachments = await prepareAttachments(); await call("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.value, attachments }) }); prompt.value = ""; attachmentInput.value = ""; showAttachments(); await refresh(); }
    catch (error) { status.textContent = error.message; } finally { button.disabled = false; }
});
refresh(); setInterval(refresh, 2500);
