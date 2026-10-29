"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-model-handoff-"));
process.env.FS_DATA_DIR = dataDir;
const { state, changeModel, resetConversation, activateConversation, record } = require("../src/state");
const { requestModel } = require("../src/api/api");
const { auth } = require("../src/api/auth");
const providers = require("../src/custom-providers");
const { createDesktopBackend } = require("../desktop/backend");
const agents = require("../src/api/agents");

function setup(mode = "chat") {
    resetConversation();
    state.mode = mode;
    state.workspace = null;
    state.motionDesign = false;
    state.model = 1;
    state.chatIds[mode] = "ancien";
    state.conversationSettings[mode] = { model: 1 };
    activateConversation(mode);
    state.history = [{ role: "user", content: "Mon projet est bleu" }, { role: "assistant", content: "Je retiens le bleu" }];
    state.pendingImages = [];
    state.pendingFiles = [];
    state.ecoMode = false;
    auth.accessToken = "test-token";
    auth.expiresAt = Date.now() + 300000;
    requestModel.compactor = new (require("../src/agent/auto-compact").AutoCompact)();
}
function stream(id, answer) {
    return new Response(`event: response.output_text.delta\ndata: ${JSON.stringify({ chat_id: id, delta: answer })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
}
test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test("le nouveau modèle reçoit les échanges dans un nouveau fil", async () => {
    setup();
    const original = global.fetch, bodies = [];
    global.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return stream("nouveau", "continué"); };
    try {
        assert.equal(changeModel(2), true);
        assert.equal(state.chatId, "ancien");
        activateConversation("chat");
        assert.equal(state.model, 2);
        assert.equal(await requestModel("Continue"), "continué");
        assert.equal(bodies.length, 1);
        assert.equal(bodies[0].agentId, 2);
        assert.equal(bodies[0].chatId, null);
        assert.match(bodies[0].initialContent, /Mon projet est bleu/);
        assert.match(bodies[0].initialContent, /Continue/);
        assert.equal(state.chatId, "nouveau");
        assert.equal(state.modelHandoffs.chat, null);
    } finally { global.fetch = original; resetConversation(); }
});

test("un échec préserve l'ancien fil et permet de réessayer", async () => {
    setup();
    const original = global.fetch;
    global.fetch = async () => new Response("refus", { status: 400 });
    try {
        changeModel(2);
        await assert.rejects(requestModel("Continue"), /HTTP 400/);
        assert.equal(state.chatId, "ancien");
        assert.equal(state.chatIds.chat, "ancien");
        assert.equal(state.modelHandoffs.chat.history[0].content, "Mon projet est bleu");
    } finally { global.fetch = original; resetConversation(); }
});

test("une conversation sans historique disponible ne perd pas son modèle", () => {
    setup(); state.history = [];
    try {
        assert.throws(() => changeModel(2), /Historique.*indisponible/);
        assert.equal(state.model, 1);
        assert.equal(state.chatId, "ancien");
    } finally { resetConversation(); }
});

test("le transfert ne fuit pas vers un autre mode ou espace", async () => {
    setup(); changeModel(2);
    try {
        await assert.rejects(requestModel("Continue", { conversationMode: "agent" }), /mode chat/);
        state.workspace = "autre-projet";
        await assert.rejects(requestModel("Continue"), /contexte a changé/);
        assert.equal(state.chatId, "ancien");
    } finally { state.workspace = null; resetConversation(); }
});

test("le fournisseur personnalisé reçoit l'historique à chaque tour et a un journal local", async () => {
    setup();
    const originalFetch = global.fetch, originalGet = providers.get, bodies = [];
    providers.get = () => ({ provider: "openai", model: "modele-test", apiKey: "fake" });
    global.fetch = async (_url, options) => { bodies.push(JSON.parse(options.body)); return new Response(JSON.stringify({ choices: [{ message: { content: "réponse" } }] })); };
    try {
        changeModel("custom:test");
        assert.equal(await requestModel("Continue"), "réponse");
        assert.match(state.chatId, /^local-custom:/);
        const localId = state.chatId;
        record("user", "Continue"); record("assistant", "réponse");
        assert.equal(await requestModel("Encore"), "réponse");
        assert.equal(state.chatId, localId);
        assert.match(bodies[0].messages[0].content, /Mon projet est bleu/);
        assert.match(bodies[1].messages[0].content, /Mon projet est bleu/);
        assert.match(bodies[1].messages[0].content, /Continue/);
    } finally { global.fetch = originalFetch; providers.get = originalGet; resetConversation(); }
});

test("le sélecteur bureau conserve la conversation", async () => {
    setup("agent");
    const oldList = agents.listAgents;
    agents.listAgents = async () => ({ agents: [{ id: 2, name: "Test" }] });
    try {
        const backend = createDesktopBackend(() => {});
        await backend.setModel(2);
        assert.equal(state.chatId, "ancien");
        assert.equal(state.history.length, 2);
        assert.equal(state.modelHandoffs.agent.id, "ancien");
    } finally { agents.listAgents = oldList; resetConversation(); }
});
