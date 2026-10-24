"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { state } = require("../src/state");
const { buildAgentPrompt, buildFollowUpPrompt } = require("../src/agent/prompt");

test("stateful follow-ups stay compact while fresh prompts retain motion tools, permissions and plan labels", () => {
    const previous = { motion: state.motionDesign, full: state.fullAccess };
    const plan = [{ step: "Inspecter la composition", status: "completed" }, { step: "Contrôler le rendu", status: "in_progress" }];
    try {
        for (const motion of [false, true]) for (const full of [false, true]) {
            state.motionDesign = motion; state.fullAccess = full;
            const next = buildFollowUpPrompt({ turn: 3, plan, lastObservation: { tool: "read_file", ok: true, result: { content: "fichier court" } } });
            assert.ok(next.length < 1700, `unnecessary follow-up overhead: ${next.length}`);
            assert.match(next, /plan_progress/);
            assert.match(next, /completed/);
            assert.doesNotMatch(next, /Inspecter la composition/);
            assert.doesNotMatch(next, /OUTILS MOTION DESIGN/);
            const fresh = buildAgentPrompt({ workspace: null, task: "Continuer", history: [], observations: [], plan });
            assert.match(fresh, /Inspecter la composition/);
            if (motion) assert.match(fresh, /OUTILS MOTION DESIGN/);
            if (full) assert.match(fresh, /MODE FULL ACCÈS/);
        }
    } finally { state.motionDesign = previous.motion; state.fullAccess = previous.full; }
});

test("large logs keep their beginning, final errors and execution metadata without mutating stored results", () => {
    const previous = state.ecoMode; state.ecoMode = false;
    try {
        const output = "START_LOG\n" + "diagnostic\n".repeat(4000) + "\nFINAL_FAILURE";
        const observation = { tool: "run_command", ok: true, result: { output, exit_code: 1, timed_out: true, truncated: false } };
        const prompt = buildFollowUpPrompt({ turn: 2, lastObservation: observation });
        const delivered = JSON.parse(prompt.split("\n").find(line => line.startsWith('{"tool":')));
        assert.ok(prompt.length < 8000);
        assert.match(delivered.result.output, /^START_LOG/);
        assert.match(delivered.result.output, /FINAL_FAILURE$/);
        assert.equal(delivered.result.exit_code, 1);
        assert.equal(delivered.result.timed_out, true);
        assert.equal(delivered.result.truncated_in_prompt, true);
        assert.equal(observation.result.output, output);
        state.ecoMode = true;
        assert.ok(buildFollowUpPrompt({ turn: 2, lastObservation: observation }).length < prompt.length);
    } finally { state.ecoMode = previous; }
});

test("the five-request checkpoint survives context restart and is absent without a plan", () => {
    const plan = [{ step: "Vérifier", status: "in_progress" }];
    const context = { workspace: null, task: "Continuer", history: [], observations: [], plan, turn: 4, requestNumber: 5 };
    assert.match(buildAgentPrompt(context), /POINT PLAN/);
    assert.match(buildFollowUpPrompt(context), /POINT PLAN/);
    assert.doesNotMatch(buildFollowUpPrompt({ ...context, requestNumber: 6 }), /POINT PLAN/);
    assert.doesNotMatch(buildFollowUpPrompt({ ...context, plan: [] }), /POINT PLAN/);
});
