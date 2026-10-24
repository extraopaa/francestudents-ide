"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { normalizeQuestion, normalizeAnswer } = require("../src/user-questions");
const { createDesktopBackend } = require("../desktop/backend");
const { state } = require("../src/state");
const { parseAgentResponse } = require("../src/agent/agent");

test("questions accept single/multiple choices or free text, reject invalid selections and keep skip distinct from interruption", () => {
    const question = normalizeQuestion({ question: "Quel style ?", options: ["Sobre", { label: "Dynamique", description: "Plus de mouvement" }] });
    assert.deepEqual(normalizeAnswer(question, { selected: ["2"] }).selected, ["Dynamique"]);
    assert.equal(normalizeAnswer(question, { text: "Mon propre style" }).text, "Mon propre style");
    assert.throws(() => normalizeAnswer(question, { selected: ["1", "2"] }));
    assert.throws(() => normalizeAnswer(question, { selected: ["unknown"] }));
    assert.throws(() => normalizeAnswer(question, {}));
    assert.throws(() => normalizeQuestion({ question: "?", options: ["Identique", "Identique"] }));
    assert.equal(normalizeAnswer(question, { skipped: true, text: "must not be submitted" }).answer, null);
    assert.equal(normalizeAnswer(question, null).interrupted, true);
    const multi = normalizeQuestion({ question: "Quels formats ?", options: ["Portrait", "Paysage"], multiple: true });
    assert.equal(normalizeAnswer(multi, { selected: ["1", "2"] }).selected.length, 2);
});

test("Full access never answers an agent question; invalid replies keep it pending and Stop releases it", async () => {
    const previous = state.fullAccess; state.fullAccess = true;
    const events = [], backend = createDesktopBackend((name, data) => events.push({ name, data }));
    try {
        const first = backend.askQuestion({ question: "Quelle couleur ?" });
        const prompt = events.find(event => event.name === "prompt").data;
        backend.approvePendingActions();
        assert.equal(events.some(event => event.name === "promptResolved"), false);
        assert.throws(() => backend.resolvePrompt(prompt.id, {}));
        backend.resolvePrompt(prompt.id, { text: "Bleu" });
        assert.equal((await first).text, "Bleu");
        assert.equal(backend.resolvePrompt(prompt.id, { text: "Duplicate" }), false);
        const skipped = backend.askQuestion({ question: "Une précision ?" });
        backend.resolvePrompt(events.filter(event => event.name === "prompt").at(-1).data.id, { skipped: true });
        assert.equal((await skipped).skipped, true);
        const stopped = backend.askQuestion({ question: "Une dernière ?" }); backend.interrupt();
        assert.equal((await stopped).interrupted, true);
    } finally { state.fullAccess = previous; }
});

test("question envelopes become a local ask_user action rather than a final answer or batch", () => {
    const action = parseAgentResponse(JSON.stringify({ type: "question", question: "Quel style ?", options: ["A", "B"], calls: [{ name: "read_file", args: { path: "unrelated" } }] }));
    assert.equal(action.name, "ask_user"); assert.equal(action.calls, undefined);
    assert.equal(action.args.question, "Quel style ?");
});
