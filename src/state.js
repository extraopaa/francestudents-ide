"use strict";

const { CONFIG } = require("./config");
const settings = require("./settings");

const state = {
    chatId: null,
    chatIds: { chat: null, agent: null },
    conversationSettings: { chat: null, agent: null },
    modelHandoffs: { chat: null, agent: null },
    model: CONFIG.defaultAgentId,
    webSearch: false,
    ecoMode: settings.load().ecoMode === true,
    automaticWeb: settings.load().automaticWeb !== false,
    agentPlan: [],
    private: true,
    incognito: false,
    workspace: null,
    frProject: null,     // projet FranceStudent { id, name } rattaché aux nouvelles conversations
    history: [],
    historyMode: null,
    mode: "auto",        // auto | agent | chat
    autoApprove: settings.autoApproveAlways(),  // true = plus de confirmation (session, ou toujours si mémorisé)
    autoApproveCommands: settings.autoApproveCommandsAlways(),  // true = run_command sans question (deny toujours bloqué)
    fullAccess: settings.load().fullAccessAlways === true,
    activeFile: null,    // fichier actif dans l'éditeur de l'application de bureau
    openFiles: [],       // onglets ouverts dans l'éditeur de l'application de bureau
    pendingImages: [],   // images (data URL) jointes au prochain message, consommées par l'API
    pendingFiles: []     // fichiers (PDF, Office, etc.) { name, dataUrl } ou ID Files v2, consommés par l'API
};

function activateConversation(mode) {
    const key = mode === "agent" ? "agent" : "chat";
    state.chatId = state.chatIds[key];
    state.historyMode = key;

    const settings = state.conversationSettings[key];
    if (settings) {
        for (const name of ["model", "webSearch", "private", "incognito"]) {
            if (settings[name] !== undefined) state[name] = settings[name];
        }
    }

    return key;
}

// Prépare le transfert sans effacer le fil : le changement de conversation serveur
// n'aura lieu qu'au prochain envoi, après ouverture du journal visible.
function changeModel(model) {
    if (model === state.model) return false;
    const mode = state.chatId && state.chatIds.agent === state.chatId ? "agent"
        : state.chatId && state.chatIds.chat === state.chatId ? "chat"
        : state.historyMode || (state.mode === "chat" ? "chat" : "agent");
    const id = state.chatIds[mode];
    const previous = state.modelHandoffs[mode];
    const history = previous ? previous.history : state.history.filter(item =>
        ["user", "assistant"].includes(item.role) && typeof item.content === "string"
    ).map(item => ({ role: item.role, content: item.content }));
    if (id && !history.length) {
        throw new Error("Historique de la conversation indisponible : rouvre-la avec son historique avant de changer de modèle.");
    }
    if (id || history.length) {
        state.modelHandoffs[mode] = previous || { id, history, workspace: state.workspace, motionDesign: !!state.motionDesign };
    }
    state.model = model;
    if (state.conversationSettings[mode]) state.conversationSettings[mode] = { ...state.conversationSettings[mode], model };
    return Boolean(id || history.length);
}

function setConversation(mode, id, settings = null) {
    const key = mode === "agent" ? "agent" : "chat";
    state.chatIds[key] = id || null;
    state.modelHandoffs[key] = null;
    state.conversationSettings[key] = settings ? { ...settings } : null;
    activateConversation(key);
}

function resetConversation(mode = null) {
    if (mode) {
        const key = mode === "agent" ? "agent" : "chat";
        state.chatIds[key] = null;
        state.modelHandoffs[key] = null;
        state.conversationSettings[key] = null;
        activateConversation(key);
    } else {
        state.chatIds = { chat: null, agent: null };
        state.modelHandoffs = { chat: null, agent: null };
        state.conversationSettings = { chat: null, agent: null };
        state.chatId = null;
    }

    state.history = [];
    state.historyMode = null;
}

function record(role, content) {
    state.history.push({ role, content });

    if (state.history.length > 30) {
        state.history = state.history.slice(-30);
    }
}

module.exports = {
    state,
    changeModel,
    activateConversation,
    setConversation,
    resetConversation,
    record
};
