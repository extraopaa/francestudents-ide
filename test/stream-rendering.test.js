"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
function renderer() {
    const nodes = [], timers = new Map(); let next = 0, markdownCalls = 0;
    const ui = { live: null, liveText: "", replayingConversation: false };
    const context = vm.createContext({ ui, document: { createElement: () => ({ innerHTML: "", isConnected: true }) },
        transcript: { appendChild: node => nodes.push(node), scrollHeight: 0 },
        renderMarkdown: text => { markdownCalls++; return `<p>${text}</p>`; },
        escapeHtml: text => text.replaceAll("<", "&lt;").replaceAll(">", "&gt;"), attachServerControls: () => {},
        setTimeout: callback => { timers.set(++next, callback); return next; }, clearTimeout: id => timers.delete(id) });
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../desktop/renderer/src/03-transcript.js"), "utf8"), context);
    return { context, nodes, timers, ui, markdownCalls: () => markdownCalls };
}
test("stream fragments share one scheduled render and final text is flushed completely", () => {
    const r = renderer(); vm.runInContext('liveStart();for(let i=0;i<1000;i++)liveAppend("fragment ");', r.context);
    assert.equal(r.markdownCalls(), 0); assert.equal(r.timers.size, 1);
    vm.runInContext("liveEnd()", r.context);
    assert.equal(r.markdownCalls(), 1); assert.equal(r.timers.size, 0);
    assert.equal(r.nodes[0].innerHTML, `<p>${"fragment ".repeat(1000)}</p>`);
});
test("large messages keep all text without Markdown work, and detached conversations cannot be repainted", () => {
    const r = renderer(); vm.runInContext('liveAppend("<script>".repeat(10000));liveEnd();', r.context);
    assert.equal(r.markdownCalls(), 0); assert.ok(r.nodes[0].innerHTML.includes("&lt;script&gt;".repeat(10000)));
    vm.runInContext('liveAppend("old conversation");', r.context); r.ui.live.isConnected = false;
    vm.runInContext('liveEnd();liveAppend("new conversation");liveEnd();', r.context);
    assert.equal(r.timers.size, 0); assert.doesNotMatch(r.nodes.at(-1).innerHTML, /old conversation/);
});
