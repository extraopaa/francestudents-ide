"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-local-protocol-"));
process.env.FS_DATA_DIR = dataDir;
const { createLocalToolCalls } = require("../src/api/local-tool-calls");
const { requestModel } = require("../src/api/api");
const { state, resetConversation } = require("../src/state");
const { auth } = require("../src/api/auth");
const { setUiBackend, UI_METHODS } = require("../src/ui-bridge");

function event(name, data) { return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`; }
function nativeCall(name, args, suffix = "") {
    return event("response.output_item.added", { item: { type: "function_call", id: "call-1", name, arguments: "" }, output_index: 0 }) +
        event("response.function_call_arguments.delta", { item_id: "call-1", delta: JSON.stringify(args).slice(0, 8) }) +
        event("response.function_call_arguments.delta", { item_id: "call-1", delta: JSON.stringify(args).slice(8) }) +
        event("response.function_call_arguments.done", { item_id: "call-1", arguments: JSON.stringify(args) }) + suffix;
}
function stream(body) { return new Response(body + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } }); }
function prepare() {
    auth.accessToken = "test-token";
    auth.expiresAt = Date.now() + 300000;
    state.pendingImages = [];
    state.pendingFiles = [];
    requestModel.compactor = new (require("../src/agent/auto-compact").AutoCompact)();
}
test.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

test("incomplete native tools fail once at the API layer instead of being billed as network retries",async()=>{
    prepare();state.chatIds.agent=null;const original=global.fetch;let calls=0;
    global.fetch=async()=>{calls++;return stream(event("response.output_item.added",{item:{type:"function_call",id:"incomplete",name:"write_file",arguments:'{"path":'},output_index:0}));};
    try{
        await assert.rejects(requestModel("Create file",{conversationMode:"agent"}),error=>error.status===400&&error.localToolProtocol===true);
        assert.equal(calls,1);
    }finally{global.fetch=original;}
});

test("OpenAI Responses and Chat Completions MCP calls map to the same permission-checked local action",()=>{
    const manager=require("../src/mcp/manager").manager,previous=manager.catalog;
    manager.catalog=()=>'- server "blender", tool "get_scene_info"';
    try{
        const responses=createLocalToolCalls();
        responses.receive("response.output_item.done",{item:{type:"function_call",id:"mcp-response",name:"mcp__blender__get_scene_info",arguments:'{"include_objects":true}'}});
        assert.deepEqual(responses.action().args,{server:"blender",tool:"get_scene_info",arguments:{include_objects:true}});
        const chat=createLocalToolCalls();
        chat.receive("message",{choices:[{index:0,delta:{tool_calls:[{index:0,id:"mcp-chat",function:{name:"get_scene_info",arguments:'{"include_'}}]}}]});
        assert.throws(()=>chat.action(),/incomplet/);
        chat.receive("message",{choices:[{index:0,delta:{tool_calls:[{index:0,function:{arguments:'objects":true}'}}]},finish_reason:"tool_calls"}]});
        assert.equal(chat.action().name,"mcp_call");assert.deepEqual(chat.action().args,responses.action().args);
        const ambiguous=createLocalToolCalls();manager.catalog=()=>'- server "one", tool "get_scene_info"\n- server "two", tool "get_scene_info"';
        ambiguous.receive("completed",{message:{tool_calls:[{id:"ambiguous",function:{name:"get_scene_info",arguments:"{}"}}]}});
        assert.equal(ambiguous.action(),null);
    }finally{manager.catalog=previous;}
});

test("native calls become validated local JSON, without execution at the API layer", async () => {
    prepare();
    const original = global.fetch;
    let count = 0;
    global.fetch = async () => {
        count++;
        return stream(nativeCall("run_command", { command: "node --version" },
            event("error", { message: "Unsupported tool ignored by the backend" })));
    };
    try {
        const action = JSON.parse(await requestModel("test", { conversationMode: "agent" }));
        assert.equal(action.type, "tool");
        assert.equal(action.name, "run_command");
        assert.deepEqual(action.args, { command: "node --version" });
        assert.equal(count, 1);
    } finally { global.fetch = original; }
});

test("final output items, duplicate done events and incomplete arguments", () => {
    const bridge = createLocalToolCalls();
    const item = { id: "x", type: "function_call", name: "functions.write_file", arguments: '{"path":"index.html","content":"<h1>Site</h1>"}' };
    bridge.receive("response.output_item.done", { item });
    bridge.receive("response.completed", { response: { output: [item] } });
    assert.equal(bridge.action().name, "write_file");
    const partial = createLocalToolCalls();
    partial.receive("response.output_item.added", { item: { ...item, arguments: '{"path":' } });
    assert.throws(() => partial.action(), /incomplet/);
    const invalid = createLocalToolCalls();
    invalid.receive("response.output_item.done", { item: { ...item, arguments: '{}' } });
    assert.throws(() => invalid.action(), /path/);
    const unknown = createLocalToolCalls();
    unknown.receive("response.output_item.done", { item: { ...item, name: "remote_unknown_tool" } });
    assert.equal(unknown.action(), null);
});

for (const recovery of ["native", "reported"]) test(`agent writes the site after ${recovery} unsupported-tool rejection`, async () => {
    prepare(); resetConversation();
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "frst-site-protocol-"));
    const original = global.fetch;
    const memory = require("../src/project/memory");
    const { runAgent } = require("../src/agent/agent");
    let calls = 0, confirmations = 0;
    const backend = Object.fromEntries(UI_METHODS.map(name => [name, () => {}]));
    backend.spinner = () => ({ stop() {} });
    backend.diff = () => ({ added: 1, removed: 0 });
    backend.confirm = async () => { confirmations++; return true; };
    setUiBackend(backend);
    state.workspace = workspace;
    await memory.open(workspace);
    const html = '<!doctype html><title>Site</title><h1>Bonjour</h1>';
    global.fetch = async () => {
        calls++;
        if (calls === 1 && recovery === "reported") {
            return stream(event("stream.open", { chat_id: "site-test" }) + event("response.output_text.delta", {
                delta: JSON.stringify({ type: "final", message: "Le backend a rejeté write_file : Unsupported tool ignored by the backend", completed: false })
            }));
        }
        if (calls === (recovery === "reported" ? 2 : 1)) {
            assert.equal(fs.existsSync(path.join(workspace, "index.html")), false);
            return stream(event("stream.open", { chat_id: "site-test" }) + nativeCall("write_file", { path: "index.html", content: html },
                event("response.output_text.delta", { delta: "Unsupported tool ignored by the backend. Aucun site créé." })));
        }
        assert.equal(fs.readFileSync(path.join(workspace, "index.html"), "utf8"), html);
        return stream(event("response.output_text.delta", { delta: JSON.stringify({ type: "final", message: "Site créé.", completed: true }) }));
    };
    try {
        const result = await runAgent("Crée un site dans index.html");
        assert.equal(result.completed, true);
        assert.equal(calls, recovery === "reported" ? 3 : 2);
        assert.equal(confirmations, 1);
    } finally {
        global.fetch = original;
        memory.close();
        state.workspace = null;
        setUiBackend(null);
        fs.rmSync(workspace, { recursive: true, force: true });
    }
});
