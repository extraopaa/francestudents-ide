/* Model selection and explicit, opt-in dictation. */
const composerTools = document.createElement("div");
composerTools.className = "chat-composer-tools";
const composerModelRow = document.createElement("div"), composerSettingsRow = document.createElement("div");
composerModelRow.className = "chat-model-row"; composerSettingsRow.className = "chat-settings-row";
composerTools.append(composerModelRow, composerSettingsRow);
function chatControlContent(button, icon, label) {
    button.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span class="chat-control-label"></span><svg class="chat-control-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>`;
    button.querySelector(".chat-control-label").textContent = label;
}
composerModelRow.append($("btn-model"));
const dictationButton = document.createElement("button");
dictationButton.type = "button"; dictationButton.id = "chat-dictation";
dictationButton.title = "Dicter un message · Bêta"; dictationButton.setAttribute("aria-label", dictationButton.title);
dictationButton.setAttribute("aria-pressed", "false");
dictationButton.innerHTML = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg><span class="dictation-beta" aria-hidden="true">β</span>';
composerModelRow.append(dictationButton);
$("composer").querySelector(".composer-actions").before(composerTools);
let composerContextKey = null;
function updateComposerContext(status) {
    const key = status.booted ? status.chatContextKey : null;
    if (key !== composerContextKey) {
        composerContextKey = key;
        cancelChatDictation();
    }
}

let chatDictation = null;
function cancelChatDictation() {
    if (!chatDictation) return;
    chatDictation.canceled = true;
    if (chatDictation.recorder?.state === "recording") chatDictation.recorder.stop();
    chatDictation.stream?.getTracks().forEach(track => track.stop());
    clearTimeout(chatDictation.timer);
    api.dictate("cancel").catch(() => {});
    chatDictation = null; paintDictation(false);
}
function paintDictation(recording, processing = false) {
    dictationButton.classList.toggle("recording", recording);
    dictationButton.setAttribute("aria-pressed", String(recording));
    dictationButton.title = recording ? "Terminer et transcrire la dictée" : processing ? "Annuler la transcription" : "Dicter un message · Bêta";
    dictationButton.setAttribute("aria-label", dictationButton.title);
}
async function startChatDictation() {
    if (!ui.status.booted) { openConnectionGuide(1); return; }
    let consent = false;
    try { consent = localStorage.getItem("frst.dictation.consent") === "yes"; } catch { /* Ask again without persistent storage. */ }
    if (!consent) {
        if (!await confirmStudioAction("Après ton clic, le micro enregistre jusqu’à 2 minutes. L’audio est envoyé à FranceStudent pour transcription et peut consommer le quota de transcription. Le texte reste un brouillon que tu peux modifier avant d’envoyer.", { title: "Dictée vocale · Bêta", confirmLabel: "Activer le micro", danger: false })) return;
        try { localStorage.setItem("frst.dictation.consent", "yes"); } catch { /* Consent applies to this recording. */ }
    }
    if (chatDictation) return;
    const session = { canceled: false, key: composerContextKey, chunks: [] };
    chatDictation = session;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        session.stream = stream;
        if (session.canceled) { stream.getTracks().forEach(track => track.stop()); return; }
        const recorder = new MediaRecorder(stream); session.recorder = recorder;
        recorder.ondataavailable = event => { if (event.data.size) session.chunks.push(event.data); };
        recorder.onstop = async () => {
            stream.getTracks().forEach(track => track.stop()); clearTimeout(session.timer);
            if (session.canceled) return;
            paintDictation(false, true); studioFeedback("Transcription en cours… Clique sur le micro pour annuler.");
            let audioContext;
            try {
                audioContext = new AudioContext();
                const decoded = await audioContext.decodeAudioData(await new Blob(session.chunks, { type: recorder.mimeType }).arrayBuffer());
                if (decoded.duration > 121) throw new Error("La dictée dépasse 2 minutes.");
                const offline = new OfflineAudioContext(1, Math.min(16000 * 120, Math.ceil(decoded.duration * 16000)), 16000);
                const source = offline.createBufferSource(); source.buffer = decoded; source.connect(offline.destination); source.start();
                const samples = (await offline.startRendering()).getChannelData(0), pcm = new Int16Array(samples.length);
                for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
                if (session.canceled) return;
                const text = await api.dictate("transcribe", pcm);
                if (session.canceled || session.key !== composerContextKey) return;
                if (text.trim()) { input.value += `${input.value && !/\s$/.test(input.value) ? " " : ""}${text}`; input.dispatchEvent(new Event("input", { bubbles: true })); input.focus(); }
                studioFeedback(text.trim() ? "Dictée ajoutée au brouillon. Tu peux la corriger avant d’envoyer." : "Aucune parole reconnue. Ton brouillon est conservé.");
            } catch (error) { if (!session.canceled) studioFeedback(error.message || "La transcription a échoué. Ton brouillon est conservé."); }
            finally { await audioContext?.close().catch(() => {}); if (chatDictation === session) { chatDictation = null; paintDictation(false); } }
        };
        recorder.onerror = () => { cancelChatDictation(); studioFeedback("L’enregistrement a échoué. Ton brouillon est conservé."); };
        recorder.start(1000); paintDictation(true); studioFeedback("Micro actif · parle, puis clique sur le micro pour transcrire (2 min maximum).");
        session.timer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 120000);
    } catch { cancelChatDictation(); studioFeedback("Micro indisponible ou autorisation refusée. Vérifie les réglages du système."); }
}
dictationButton.onclick = () => {
    if (chatDictation?.recorder?.state === "recording") chatDictation.recorder.stop();
    else if (chatDictation) { cancelChatDictation(); studioFeedback("Dictée annulée. Ton brouillon est conservé."); }
    else startChatDictation();
};
window.addEventListener("beforeunload", cancelChatDictation);
$("composer").addEventListener("submit", cancelChatDictation, true);
updateComposerContext(ui.status);
