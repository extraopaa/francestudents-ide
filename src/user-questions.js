"use strict";

function normalizeQuestion(args) {
    if (!args || typeof args.question !== "string" || !args.question.trim() || args.question.length > 2000) throw new Error("question doit contenir entre 1 et 2 000 caractères.");
    if (args.options !== undefined && (!Array.isArray(args.options) || args.options.length > 8 || args.options.length === 1)) throw new Error("options doit contenir de 2 à 8 choix, ou être absent pour une réponse libre.");
    if (args.multiple !== undefined && typeof args.multiple !== "boolean") throw new Error("multiple doit être un booléen.");
    if (args.placeholder !== undefined && (typeof args.placeholder !== "string" || args.placeholder.length > 200)) throw new Error("placeholder doit être un texte court.");
    const options = (args.options || []).map((value, index) => {
        const option = typeof value === "string" ? { label: value } : value;
        if (!option || typeof option.label !== "string" || !option.label.trim() || option.label.length > 200) throw new Error("Chaque choix doit avoir un libellé court.");
        if (option.description !== undefined && (typeof option.description !== "string" || option.description.length > 500)) throw new Error("Description de choix trop longue ou invalide.");
        return { id: String(index + 1), label: option.label.trim(), description: option.description || "", recommended: option.recommended === true };
    });
    if (new Set(options.map(option => option.label.toLowerCase())).size !== options.length) throw new Error("Les choix doivent être différents.");
    return { question: args.question.trim(), options, multiple: options.length > 0 && args.multiple === true, placeholder: args.placeholder || (options.length ? "Autre réponse ou précision…" : "Écris ta réponse…") };
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
