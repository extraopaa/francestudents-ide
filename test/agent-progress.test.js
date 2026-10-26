"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { state } = require("../src/state");
const { setUiBackend } = require("../src/ui-bridge");
const { createDesktopBackend } = require("../desktop/backend");
const { updatePlan, check } = require("../src/tools/update-plan");
const { createJobManager } = require("../src/tools/command/jobs");

test("plan : statuts validés, copie du plan et progression transmise au bureau", () => {
    const previous = state.agentPlan;
    const events = [];
    const backend = createDesktopBackend((...args) => events.push(args));
    setUiBackend(backend);
    try {
        assert.throws(() => check({ steps: [{ step: "a", status: "in_progress" }, { step: "b", status: "in_progress" }] }));
        assert.throws(() => check({ steps: [{ step: "a", status: "invented" }] }));
        backend.startRun("Tâche test");
        const args = { steps: [{ step: "Explorer", status: "completed" }, { step: "Vérifier", status: "in_progress" }] };
        const result = updatePlan(args);
        args.steps[0].step = "modifié";
        assert.equal(state.agentPlan[0].step, "Explorer");
        assert.equal(result.changed, false);
        assert.equal(backend.activity().steps[1].status, "in_progress");
        assert.ok(events.some(([name]) => name === "agentActivity"));
    } finally { state.agentPlan = previous; setUiBackend(null); }
});
test("plan : normalise les étapes chaînes et les statuts omis", () => {
    const previous = state.agentPlan;
    const backend = createDesktopBackend(() => {});
    setUiBackend(backend);
    try {
        const args = { steps: ["Explorer", { step: "Corriger" }] };
        check(args);
        assert.deepEqual(args.steps, [
            { step: "Explorer", status: "pending" },
            { step: "Corriger", status: "pending" }
        ]);
        const oversized = { steps: Array.from({ length: 15 }, (_, index) => `Étape ${index + 1}`) };
        check(oversized);
        assert.equal(oversized.steps.length, 12);
        const empty = { steps: [] };
        check(empty);
        assert.deepEqual(empty.steps, []);
        backend.startRun("Test plan");
        const result = updatePlan({ steps: ["Explorer"] });
        assert.equal(result.steps[0].step, "Explorer");
    } finally { state.agentPlan = previous; setUiBackend(null); }
});
test("activité : outils, erreurs, sources consultées et instantanés indépendants", () => {
    const backend = createDesktopBackend(() => {});
    backend.startRun("Test");
    backend.tool("run_command", "npm test");
    backend.result("code 1", { tone: "error", sources: [{ url: "https://example.org", title: "Doc", consulted: false }] });
    backend.tool("web_fetch", "https://example.org");
    backend.result("page lue", { sources: [{ url: "https://example.org", title: "Doc", consulted: true }, { url: "javascript:bad", title: "Refusée" }] });
    backend.endRun({ ok: true });
    const result = backend.activity();
    assert.equal(result.commands, 1);
    assert.equal(result.actions[0].status, "failed");
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].consulted, true);
    assert.equal(result.status, "done");
    result.actions.length = 0;
    assert.equal(backend.activity().actions.length, 2);
});
test("commandes : lire la sortie dans l’interface ne consomme pas celle de l’agent", async () => {
    const manager = createJobManager();
    const job = manager.start({ command: "test", launch: ({ onLine }) => { onLine("SORTIE_PRESERVEE"); return Promise.resolve({ exit_code: 0 }); } });
    await new Promise(resolve => setImmediate(resolve));
    assert.match(manager.peek(job.id).output, /SORTIE_PRESERVEE/);
    assert.match(manager.peek(job.id).output, /SORTIE_PRESERVEE/);
    assert.match(manager.output(job.id).output, /SORTIE_PRESERVEE/);
    assert.equal(manager.output(job.id).output, "");
});
