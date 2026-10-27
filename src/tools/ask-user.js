"use strict";
const { normalizeQuestion, normalizeAnswer } = require("../user-questions");

async function askUser(args) {
    let question;
    try { question = normalizeQuestion(args); }
    catch (error) {
        // A malformed model QCM should become a free-text question, not stop
        // the task. The exported validator remains strict for real callers.
        if (error.message?.startsWith("options")) question = normalizeQuestion({ question: args.question, placeholder: args.placeholder });
        else throw error;
    }
    const { getUiBackend, ui } = require("../ui-bridge"), backend = getUiBackend();
    let answer;
    if (typeof backend.askQuestion === "function") answer = await backend.askQuestion(question);
    else {
        const choices = question.options.map(option => `${option.id}. ${option.label}${option.description ? " — " + option.description : ""}`).join("\n");
        const raw = await ui.ask(`${question.question}${choices ? "\n" + choices : ""}\nRéponse libre${question.options.length ? " ou numéro(s)" : ""} ; Entrée ou « passer » pour passer : `);
        if (raw == null) answer = normalizeAnswer(question, null);
        else if (!String(raw).trim() || /^passer$/i.test(String(raw).trim())) answer = normalizeAnswer(question, { skipped: true });
        else {
            const selected = String(raw).trim().split(/[,;\s]+/);
            const numbered = question.options.length && selected.every(id => question.options.some(option => option.id === id)) && (question.multiple || selected.length === 1);
            answer = normalizeAnswer(question, numbered ? { selected } : { text: String(raw) });
        }
    }
    if (answer.interrupted) {
        const error = new Error("Question interrompue. Ne la repose pas automatiquement."); error.code = "ACTION_CANCELED"; throw error;
    }
    return { question: question.question, interrupted: false, skipped: answer.skipped, selected: answer.selected, text: answer.text, changed: false, message: answer.skipped
        ? "Question passée : aucune réponse ni autorisation donnée. Continue les étapes possibles sans reposer automatiquement la même question ; si l’information est indispensable, explique le blocage."
        : "Réponse de l’utilisateur reçue ; les choix et le texte ci-dessus proviennent directement de l’utilisateur." };
}

module.exports = { name: "ask_user", check: normalizeQuestion, run: askUser, askUser, describe: args => args.question };
