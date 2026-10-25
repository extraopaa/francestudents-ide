"use strict";

// Translate provider function-call events into the existing local agent protocol.
// This module never executes tools or bypasses the agent's permission checks.
function createLocalToolCalls() {
    const calls = new Map();
    const indices = new Map();
    const chatIndices=new Map();
    function item(data, done) {
        const value = data.item;
        if (value?.type !== "function_call") return;
        const key = value.id ?? value.call_id ?? `index:${data.output_index ?? calls.size}`;
        if (data.output_index !== undefined) indices.set(data.output_index, key);
        const previous = calls.get(key) || {};
        calls.set(key, { ...previous, name: value.name ?? previous.name,
            arguments: value.arguments ?? previous.arguments ?? "", done: done || previous.done });
    }
    function receive(name, data) {
        // FranceStudent may relay OpenAI Chat Completions instead of Responses events.
        for(const choice of Array.isArray(data.choices)?data.choices:[]){
            const toolCalls=choice.delta?.tool_calls??choice.message?.tool_calls;
            for(const [position,value] of (Array.isArray(toolCalls)?toolCalls:[]).entries()){
                const index=`${choice.index??0}:${value.index??position}`,key=chatIndices.get(index)||value.id||`chat:${index}`;
                chatIndices.set(index,key);const previous=calls.get(key)||{arguments:""};
                const fn=value.function||{};
                calls.set(key,{...previous,name:fn.name??previous.name,arguments:choice.message?fn.arguments??previous.arguments:previous.arguments+(fn.arguments||""),done:Boolean(choice.message)||previous.done});
            }
            if(choice.finish_reason==="tool_calls")for(const [index,key] of chatIndices)if(index.startsWith(`${choice.index??0}:`))calls.get(key).done=true;
        }
        for(const value of Array.isArray(data.message?.tool_calls)?data.message.tool_calls:[]){
            item({item:{type:"function_call",id:value.id,name:value.function?.name,arguments:value.function?.arguments}},true);
        }
        if (name === "response.output_item.added" || name === "response.output_item.done") {
            item(data, name.endsWith(".done"));
        } else if (name === "response.function_call_arguments.delta" || name === "response.function_call_arguments.done") {
            const key = data.item_id ?? indices.get(data.output_index);
            if (!key) return;
            const value = calls.get(key) || { arguments: "" };
            value.name = data.name ?? value.name;
            if (name.endsWith(".done")) {
                value.arguments = data.arguments ?? value.arguments;
                value.done = true;
            } else value.arguments += data.delta || "";
            calls.set(key, value);
        } else if (name === "response.completed") {
            for (const [index, value] of (data.response?.output || []).entries()) item({ item: value, output_index: index }, true);
        }
        if(calls.size>64||[...calls.values()].reduce((total,call)=>total+String(call.arguments||"").length,0)>4*1024*1024){
            throw Object.assign(new Error("Réponse d’outils trop volumineuse. Aucun outil local exécuté."),{status:400,localToolProtocol:true});
        }
    }
    function action() {
        // Lazy import avoids the registry -> subagent -> API dependency cycle.
        const { TOOLS, validateToolCall } = require("../tools/registry");
        for (const call of calls.values()) {
            const name = String(call.name || "").replace(/^functions\./, "");
            const mcp=!Object.hasOwn(TOOLS,name)?require("../agent/mcp-access").resolveNativeMcp(name,require("../mcp/manager").manager.catalog()):null;
            if (!Object.hasOwn(TOOLS, name)&&!mcp) continue;
            if (!call.done) throw Object.assign(new Error(`Appel local incomplet : ${name}. Aucun outil exécuté.`),{status:400,localToolProtocol:true});
            let args;
            try { args = JSON.parse(call.arguments); }
            catch (cause) { throw Object.assign(new Error(`Arguments JSON invalides pour l’outil local ${name}.`, { cause }),{status:400,localToolProtocol:true}); }
            const value = { type: "tool", name:mcp?"mcp_call":name, args:mcp?{server:mcp.server,tool:mcp.tool,arguments:args}:args, reason: `Exécuter localement l’outil ${name}.` };
            try{validateToolCall(value);}catch(error){error.status=400;error.localToolProtocol=true;throw error;}
            // One action per agent turn. Remaining calls must be requested again
            // after the agent has observed this action's real result.
            return value;
        }
        return null;
    }
    return { receive, action };
}

module.exports = { createLocalToolCalls };
