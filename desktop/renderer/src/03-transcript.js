/* ---------- Transcript ---------- */

const transcriptBottomButton = $("transcript-bottom");
let transcriptFollowing = true;
let transcriptScrollFrame = null;
const transcriptAtBottom = () => transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <= 24;
function updateTranscriptScrollControl() {
    transcriptBottomButton.hidden = transcriptFollowing;
}
function resetTranscriptFollow() {
    transcriptFollowing = true;
    updateTranscriptScrollControl();
}
transcript.addEventListener("scroll", () => {
    if (!transcript.clientHeight || transcriptScrollFrame !== null) return;
    transcriptFollowing = transcriptAtBottom();
    updateTranscriptScrollControl();
}, { passive: true });
transcript.addEventListener("wheel", event => {
    if (event.deltaY < 0 && transcript.scrollHeight > transcript.clientHeight) {
        transcriptFollowing = false;
        updateTranscriptScrollControl();
    }
}, { passive: true });
transcriptBottomButton.addEventListener("click", () => {
    resetTranscriptFollow();
    scrollDown();
});
function scrollDown() {
    if (ui.replayingConversation || !transcriptFollowing) return;
    transcript.scrollTop = transcript.scrollHeight;
    if (transcriptScrollFrame !== null) return;
    transcriptScrollFrame = requestAnimationFrame(() => {
        transcriptScrollFrame = null;
        if (!ui.replayingConversation && transcriptFollowing) transcript.scrollTop = transcript.scrollHeight;
    });
}
// Messages, images and the available viewport can change size after rendering.
// Keep following only while the user has not chosen to read further up.
const transcriptResizeObserver = new ResizeObserver(() => scrollDown());
transcriptResizeObserver.observe(transcript);
for (const child of transcript.children) transcriptResizeObserver.observe(child);
new MutationObserver(records => {
    for (const record of records) {
        for (const node of record.removedNodes) if (node.nodeType === Node.ELEMENT_NODE) transcriptResizeObserver.unobserve(node);
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE) transcriptResizeObserver.observe(node);
    }
    scrollDown();
}).observe(transcript, { childList: true });

const QUIET_TOOLS = new Set(["read_file", "search_files", "list_directory"]);
let toolGroup = null;
let livePaintTimer = null;

function renderAssistantText(text) {
    const value = String(text ?? "");
    // Large replies remain complete, but avoid expensive Markdown highlighting.
    return value.length > 64000 ? `<div class="fs-long-message">${escapeHtml(value)}</div>` : renderMarkdown(value);
}

function toolRowHtml(e) {
    return `<span class="tdot"></span><span class="name">${escapeHtml(toolLabel(e.name))}</span><span class="arg" title="${escapeHtml(e.arg || "")}">${escapeHtml(e.arg || "")}</span>`;
}

function plural(n, word) {
    return `${n} ${word}${n > 1 ? "s" : ""}`;
}

/** Lectures, recherches et listes successives : une seule ligne repliable. */
function addQuietTool(e) {
    if (!toolGroup) {
        const el = addEntry("tool-group", "<details><summary></summary><div class=\"tool-group-body\"></div></details>");
        toolGroup = { el, summary: el.querySelector("summary"), body: el.querySelector(".tool-group-body"), reads: 0, searches: 0, lists: 0, awaitingResult: false };
    }
    const g = toolGroup;
    if (e.name === "read_file") g.reads++;
    else if (e.name === "search_files") g.searches++;
    else g.lists++;
    const parts = [];
    if (g.reads) parts.push(plural(g.reads, "lecture"));
    if (g.searches) parts.push(plural(g.searches, "recherche"));
    if (g.lists) parts.push(`${plural(g.lists, "dossier")} listé${g.lists > 1 ? "s" : ""}`);
    g.summary.textContent = parts.join(" · ");
    const row = document.createElement("div");
    row.className = "entry tool";
    row.innerHTML = toolRowHtml(e);
    g.body.appendChild(row);
    g.awaitingResult = true;
    scrollDown();
    return row;
}

function addEntry(cls, html) {
    toolGroup = null;
    const div = document.createElement("div");
    div.className = `entry ${cls}`;
    div.innerHTML = html;
    transcript.appendChild(div);
    scrollDown();
    return div;
}

function appendOutput(text) {
    output.textContent += `${text}\n`;
    if (output.textContent.length > 200000) output.textContent = output.textContent.slice(-150000);
    output.scrollTop = output.scrollHeight;
}

let requestFileChanges = new Map();
let requestDiffPreviews = new Map();

function resetRequestFileChanges() {
    requestFileChanges = new Map();
    requestDiffPreviews = new Map();
}

function recordRequestFileChange(e) {
    if (!e.path) return;
    const item = requestFileChanges.get(e.path) || { path: e.path, added: 0, removed: 0, unknown: false, diffs: [] };
    if (Number.isFinite(e.added) && Number.isFinite(e.removed)) {
        item.added += e.added;
        item.removed += e.removed;
        const preview = requestDiffPreviews.get(e.path);
        if (preview) item.diffs.push(preview);
    } else item.unknown = true;
    requestDiffPreviews.delete(e.path);
    requestFileChanges.set(e.path, item);
}

function appendRequestFileSummary(message) {
    const files = [...requestFileChanges.values()];
    if (!files.length) return;
    resetRequestFileChanges();
    const card = document.createElement("section");
    card.className = "request-file-summary";
    card.setAttribute("aria-label", "Fichiers modifiés pendant cette demande");
    const head = document.createElement("div");
    head.className = "request-file-head";
    const title = document.createElement("strong");
    title.textContent = `${files.length} fichier${files.length > 1 ? "s" : ""} modifié${files.length > 1 ? "s" : ""}`;
    head.append(title);
    const undo = document.createElement("button");
    undo.type = "button";
    undo.textContent = "Gérer les annulations";
    undo.title = "Ouvrir le panneau des modifications et des annulations";
    undo.onclick = () => selectPanel("changes");
    head.appendChild(undo);
    const diffs = document.createElement("div");
    diffs.className = "request-file-diffs";
    diffs.hidden = true;
    for (const file of files) for (const diff of file.diffs) diffs.appendChild(buildDiffCard(diff));
    if (diffs.childNodes.length) {
        const view = document.createElement("button");
        view.type = "button";
        view.textContent = "Voir les modifications";
        view.setAttribute("aria-expanded", "false");
        view.onclick = () => {
            diffs.hidden = !diffs.hidden;
            view.setAttribute("aria-expanded", String(!diffs.hidden));
            view.textContent = diffs.hidden ? "Voir les modifications" : "Masquer les modifications";
        };
        head.appendChild(view);
    }
    card.appendChild(head);
    const totals = document.createElement("div");
    totals.className = "request-file-totals";
    totals.title = "Total cumulé des opérations dont le nombre de lignes est disponible";
    const addedTotal = document.createElement("span");
    addedTotal.className = "request-file-added";
    addedTotal.textContent = `+${files.reduce((n, file) => n + file.added, 0)}`;
    const removedTotal = document.createElement("span");
    removedTotal.className = "request-file-removed";
    removedTotal.textContent = ` −${files.reduce((n, file) => n + file.removed, 0)}`;
    totals.append(addedTotal, removedTotal);
    if (files.some(file => file.unknown)) totals.append(document.createTextNode(" · statistiques partielles"));
    card.appendChild(totals);
    const list = document.createElement("div");
    list.className = "request-file-list";
    const extra = document.createElement("div");
    extra.hidden = true;
    files.forEach((file, index) => {
        const row = document.createElement("div");
        row.className = "request-file-row";
        const name = document.createElement("span");
        name.textContent = file.path;
        name.title = file.path;
        const stats = document.createElement("span");
        if (file.unknown) stats.textContent = "Statistiques partielles";
        else {
            const added = document.createElement("span");
            added.className = "request-file-added";
            added.textContent = `+${file.added}`;
            const removed = document.createElement("span");
            removed.className = "request-file-removed";
            removed.textContent = ` −${file.removed}`;
            stats.append(added, removed);
        }
        row.append(name, stats);
        (index < 3 ? list : extra).appendChild(row);
    });
    card.appendChild(list);
    if (files.length > 3) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "request-file-more";
        more.textContent = `Afficher ${files.length - 3} fichier(s) de plus`;
        more.setAttribute("aria-expanded", "false");
        more.onclick = () => {
            extra.hidden = !extra.hidden;
            more.setAttribute("aria-expanded", String(!extra.hidden));
            more.textContent = extra.hidden ? `Afficher ${files.length - 3} fichier(s) de plus` : "Afficher moins";
        };
        card.append(extra, more);
    }
    card.appendChild(diffs);
    message.appendChild(card);
    scrollDown();
}

function renderEntry(e) {
    recordStudioEntry(e);
    if(["info","warn","error"].includes(e.type)){
        const budget=parseBudgetNotice(e.text);
        if(budget){
            if(e.type==="error")$("agent-starter").classList.add("hidden");
            return renderBudgetEntry(budget,e.text,{projectSummary:/Résumé IA indisponible/i.test(String(e.text||""))});
        }
    }
    const sessionPrivacyNotice = e.type === "warn" && /^Le contenu du projet \(fichiers, RESUME\.md\) est envoyé à ton fournisseur API\./.test(String(e.text || ""));
    if (sessionPrivacyNotice || e.type === "info" && /^(?:Connecté \(le token|Projet : |Projet FranceStudent : |Projet existant : |Mémoire : |Résumé du projet |Index local du projet |R[ÉE]SUM[ÉE]\.md |Nouveau projet enregistré)/.test(String(e.text || ""))) {
        let group = transcript.querySelector(".session-notices");
        if (!group) group = addEntry("session-notices", "<details><summary>Informations de session</summary><div class=\"chat-session-lines\"></div></details>");
        const line = document.createElement("div"); line.className = "chat-session-line"; line.textContent = e.text;
        if (sessionPrivacyNotice) { line.classList.add("session-privacy-line"); group.querySelector("summary").textContent = "Session et données transmises"; }
        group.querySelector(".chat-session-lines").append(line);
        return group;
    }
    switch (e.type) {
        case "welcome":
            return null;
        case "user":
            resetRequestFileChanges();
            $("agent-starter").classList.add("hidden");
            return addEntry("user", `<div class="message-content">${escapeHtml(e.text)}</div>`);
        case "assistant": {
            $("agent-starter").classList.add("hidden");
            const message = addEntry("assistant", `<div class="message-content">${renderAssistantText(e.text)}</div>`);
            const actions = document.createElement("div");
            actions.className = "message-actions";
            const copy = document.createElement("button");
            copy.type = "button"; copy.textContent = "Copier";
            copy.onclick = () => api.copyText(e.text).then(() => { copy.textContent = "Copié ✓"; }).catch(error => studioFeedback(error.message));
            actions.appendChild(copy); message.appendChild(actions);
            attachServerControls(message, e.text);
            appendRequestFileSummary(message);
            return message;
        }
        case "reason": {
            const el = addEntry("reason collapsed", `<span class="reason-mark">✻</span><span class="reason-text">${inline(e.text)}</span>`);
            el.title = "Cliquer pour déplier ou replier la réflexion";
            el.onclick = () => {
                if (!String(window.getSelection())) el.classList.toggle("collapsed");
            };
            return el;
        }
        case "info":
        case "warn":
        case "error": {
            if (e.type === "error") {
                $("agent-starter").classList.add("hidden");
                const context=parseContextLimitNotice(e.text);
                if(context)return renderContextLimitEntry(context,e.text);
                const apiError=parseApiErrorNotice(e.text);
                if(apiError)return renderApiErrorEntry(apiError,e.text);
            }
            return addEntry(e.type, escapeHtml(e.text));
        }
        case "print":
            return addEntry("print", `<pre>${escapeHtml((e.lines || []).join("\n"))}</pre>`);
        case "plan":
            renderWorkPlan(Array.isArray(e.steps) ? e.steps : workPlanItems(e.items), { status: e.replayed ? "history" : "running" });
            return null;
        case "tool":
            if (e.name === "run_command") appendOutput(`$ ${e.arg}`);
            if (QUIET_TOOLS.has(e.name)) return addQuietTool(e);
            return addEntry("tool", toolRowHtml(e));
        case "result": {
            if (toolGroup && toolGroup.awaitingResult) {
                const row = document.createElement("div");
                row.className = `entry result ${e.tone || ""}`;
                row.textContent = `└ ${e.text}`;
                toolGroup.body.appendChild(row);
                toolGroup.awaitingResult = false;
                if (e.tone === "error" || e.tone === "err") toolGroup.el.classList.add("has-error");
                scrollDown();
                return row;
            }
            return addEntry(`result ${e.tone || ""}`, `└ ${escapeHtml(e.text)}`);
        }
        case "fileChange":
            recordRequestFileChange(e);
            if (e.path) recordChange(e.path, e.added, e.removed);
            return null;
        case "diff": {
            if (e.path) requestDiffPreviews.set(e.path, e);
            const el = addEntry("diff-entry", "");
            el.appendChild(buildDiffCard(e));
            return el;
        }
        default:
            return addEntry("info", escapeHtml(JSON.stringify(e)));
    }
}

function liveStart() {
    liveEnd();
    ui.liveText = "";
    ui.live = addEntry("assistant", "");
}

function paintLiveMessage() {
    livePaintTimer = null;
    if (!ui.live?.isConnected) return;
    ui.live.innerHTML = renderAssistantText(ui.liveText);
    scrollDown();
}

function liveAppend(text) {
    if (!ui.live) liveStart();
    ui.liveText += text;
    if (livePaintTimer === null) livePaintTimer = setTimeout(paintLiveMessage, 80);
}

function liveEnd() {
    if (livePaintTimer !== null) clearTimeout(livePaintTimer);
    paintLiveMessage();
    if (ui.live?.isConnected && ui.liveText) {
        attachServerControls(ui.live, ui.liveText);
        appendRequestFileSummary(ui.live);
    }
    ui.live = null;
    ui.liveText = "";
}

function setSpinner(data) {
    if (data.stop) {
        if (ui.spinnerId === data.id) {
            $("spinner").classList.add("hidden");
            ui.spinnerId = null;
            ui.spinnerStart = 0;
            if (ui.spinnerTimer) clearInterval(ui.spinnerTimer);
            ui.spinnerTimer = null;
        }
        return;
    }
    if (ui.spinnerId !== data.id || !ui.spinnerStart) ui.spinnerStart = Date.now();
    ui.spinnerId = data.id;
    ui.spinnerLabel = data.label || "";
    const paint = () => {
        const secs = Math.floor((Date.now() - ui.spinnerStart) / 1000);
        const elapsed = secs >= 60 ? `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, "0")} s` : `${secs} s`;
        $("spinner-label").textContent = ui.spinnerLabel ? `${ui.spinnerLabel} · ${elapsed}` : elapsed;
    };
    paint();
    if (!ui.spinnerTimer) ui.spinnerTimer = setInterval(() => { if (ui.spinnerId) paint(); }, 1000);
    $("spinner").classList.remove("hidden");
}

