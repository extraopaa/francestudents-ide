/* Triggered only by the agent's ask_user tool; never inferred from question marks. */
function renderAgentQuestion(prompt, zone) {
    const card = centerNode("section", "fs-agent-question");
    card.setAttribute("aria-labelledby", `agent-question-${prompt.id}`);
    const header = centerNode("div", "fs-agent-question-header");
    header.append(centerNode("span", "fs-surface-badge", "Question de l’agent"), centerNode("span", "muted", "En attente de ta réponse"));
    const heading = centerNode("h3", "", formatAgentQuestion(prompt.question)); heading.id = `agent-question-${prompt.id}`;
    card.append(header, heading);
    const choices = centerNode("fieldset", "fs-agent-choices");
    const legend = centerNode("legend", "", prompt.multiple ? "Tu peux sélectionner plusieurs réponses." : "Choisis une réponse ou écris la tienne.");
    choices.append(legend);
    const inputs = [];
    for (const option of prompt.options || []) {
        const row = centerNode("label", "fs-agent-choice"), field = document.createElement("input");
        field.type = prompt.multiple ? "checkbox" : "radio"; field.name = `agent-question-${prompt.id}`; field.value = option.id;
        const copy = centerNode("span", "fs-agent-choice-copy"), title = centerNode("strong", "", option.label);
        copy.append(title);
        if (option.recommended) title.append(centerNode("span", "fs-surface-badge", "Conseillé"));
        if (option.description) copy.append(centerNode("small", "", option.description));
        row.append(field, copy); choices.append(row); inputs.push(field);
    }
    if (inputs.length) {
        if (!prompt.multiple) {
            const other = centerNode("label", "fs-agent-choice"), radio = document.createElement("input");
            radio.type = "radio"; radio.name = `agent-question-${prompt.id}`; radio.value = "";
            other.append(radio, centerNode("strong", "", "Autre réponse")); choices.append(other); inputs.push(radio);
        }
        card.append(choices);
    }
    const label = centerNode("label", "fs-agent-answer-label", inputs.length ? "Précision ou autre réponse" : "Ta réponse");
    const text = document.createElement("textarea"); text.rows = 2; text.maxLength = 4000; text.placeholder = prompt.placeholder || "Écris ta réponse…";
    text.id = `agent-answer-${prompt.id}`; label.htmlFor = text.id; card.append(label, text);
    const error = centerNode("p", "fs-agent-question-error"); error.setAttribute("role", "alert");
    const footer = centerNode("div", "buttons"), skip = centerNode("button", "", "Passer"), submit = centerNode("button", "primary", "Répondre");
    skip.type = submit.type = "button"; skip.dataset.questionAction = "skip"; submit.dataset.questionAction = "answer";
    let sending = false;
    const refresh = () => { submit.disabled = sending || (!text.value.trim() && !inputs.some(field => field.checked && field.value)); };
    async function answer(skipped) {
        if (sending || (!skipped && submit.disabled)) return;
        sending = true; error.textContent = ""; skip.disabled = true; text.disabled = true;
        inputs.forEach(field => { field.disabled = true; }); refresh();
        try {
            await api.resolvePrompt(prompt.id, skipped ? { skipped: true } : { selected: inputs.filter(field => field.checked && field.value).map(field => field.value), text: text.value });
        } catch (failure) {
            sending = false; error.textContent = failure.message; skip.disabled = false; text.disabled = false;
            inputs.forEach(field => { field.disabled = false; }); refresh();
        }
    }
    inputs.forEach(field => field.addEventListener("change", refresh)); text.addEventListener("input", refresh);
    text.addEventListener("keydown", event => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); answer(false); } });
    submit.onclick = () => answer(false); skip.onclick = () => answer(true);
    footer.append(skip, submit); card.append(error, footer); zone.append(card); refresh();
    setTimeout(() => { if (card.isConnected) (inputs[0] || text).focus({ preventScroll: true }); }, 0);
}

// Keep instructions and shell commands readable when a model sends them in a
// single paragraph. Newlines supplied by the model are always preserved.
function formatAgentQuestion(value) {
    const text = String(value || "").replace(/\r\n?/g, "\n").trim();
    if (!text) return "";
    const command = /\s+(?=(?:npm|npx|node|python(?:3)?|pip(?:3)?|git|curl|wget|docker|dotnet|cargo|go|powershell|pwsh|bash|cmd|rm|mkdir|cat|ls|find|echo)(?:\s|$))/gi;
    return text.replace(command, "\n").replace(/\s*(?:&&|;)+\s*/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
