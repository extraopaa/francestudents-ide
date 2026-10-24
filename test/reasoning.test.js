"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { capabilities } = require("../src/api/reasoning");
test("reasoning: GPT 6.1 excludes unsupported none/minimal and service-unsupported max", () => {
    assert.deepEqual(capabilities({ model: "gpt-6.1-sol" }).levels, ["low", "medium", "high", "xhigh"]);
});
test("reasoning: verified GPT models permit none but not minimal or max", () => {
    for (const model of ["gpt-6-sol", "gpt-6-luna", "gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.6-terra"]) {
        assert.deepEqual(capabilities({ model }).levels, ["none", "low", "medium", "high", "xhigh"]);
    }
});
test("reasoning: unknown GPT and other providers do not acquire guessed support", () => {
    for (const model of ["gpt-4.1", "gpt-unknown", "claude-sonnet-5", "gemini-3.8-flash"]) assert.deepEqual(capabilities({ model }).levels, []);
});
test("reasoning: observed service IDs and model snapshots preserve capabilities", () => {
    assert.deepEqual(capabilities({ id: -1003 }).levels, ["low", "medium", "high", "xhigh"]);
    assert.deepEqual(capabilities({ model: "gpt-6.1-sol-2026-10-01" }).levels, ["low", "medium", "high", "xhigh"]);
    const first = capabilities({ model: "gpt-6-sol" }); first.levels.pop();
    assert.equal(capabilities({ model: "gpt-6-sol" }).levels.length, 5);
});
