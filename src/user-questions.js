"use strict";

function normalizeQuestion(args) {
    if (!args || typeof args.question !== "string" || !args.question.trim() || args.question.length > 2000) throw new Error("question doit contenir entre 1 et 2 000 caractères.");
    const allowMultiple = args.multiple === true;
    const placeholder = typeof args.placeholder === "string" && args.placeholder.length <= 200 ? args.placeholder : "";
    // Models sometimes emit a partial or malformed QCM. Keep the question
    // usable by falling back to free text instead of suspending the task.
    const candidates = Array.isArray(args.options) ? args.options : [];
    const options = candidates.slice(0, 8).flatMap((value, index) => {
        const option = typeof value === "string" ? { label: value } : value;
        if (!option || typeof option.label !== "string" || !option.label.trim() || option.label.length > 200) return [];
        const description = typeof option.description === "string" && option.description.length <= 500 ? option.description : "";
        return [{ id: String(index + 1), label: option.label.trim(), description, recommended: option.recommended === true }];
    });
    const uniqueOptions = options.filter((option, index) => options.findIndex(item => item.label.toLocaleLowerCase() === option.label.toLocaleLowerCase()) === index);
    const usableOptions = uniqueOptions.length >= 2 ? uniqueOptions : [];
    return { question: args.question.trim(), options: usableOptions, multiple: usableOptions.length > 0 && allowMultiple, placeholder: placeholder || (usableOptions.length ? "Autre réponse ou précision…" : "Écris ta réponse…") };
}

function normalizeAnswer(question, value) {
    if (value === null) return { interrupted: true, skipped: false, selected: [], text: "", answer: null };
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse interactive invalide.");
    if (value.skipped === true) return { interrupted: false, skipped: true, selected: [], text: "", answer: null };
    const selected = value.selected ?? [], text = value.text ?? "";
    if (!Array.isArray(selected) || selected.some(id => typeof id !== "string") || new Set(selected).size !== selected.length) throw new Error("Sélection invalide.");
    if (!question.multiple && selected.length > 1) throw new Error("Choisis une seule réponse.");
    if (typeof text !== "string" || text.length > 4000) throw new Error("La réponse libre est limitée à 4 000 caractères.");
    const labels = selected.map(id => {
        const option = question.options.find(item => item.id === id);
        if (!option) throw new Error("Ce choix ne fait pas partie de la question.");
        return option.label;
    });
    if (!labels.length && !text.trim()) throw new Error("Choisis une réponse, écris un texte ou utilise Passer.");
    return { interrupted: false, skipped: false, selected: labels, text: text.trim(), answer: [...labels, text.trim()].filter(Boolean).join("\n") };
}

module.exports = { normalizeQuestion, normalizeAnswer };
