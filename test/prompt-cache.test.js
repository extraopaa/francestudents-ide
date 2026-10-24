"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const cache=require("../src/agent/prompt-cache");
const {buildResumePrompt}=require("../src/agent/prompt");
test("bootstrap reuse is limited to the same conversation and configuration",()=>{
    const original=cache.fingerprint({model:"one",workspace:"a",fullAccess:false});
    cache.remember("quota-test",original);
    assert.equal(cache.has("quota-test",original),true);
    assert.equal(cache.has("new-conversation",original),false);
    for(const config of [{model:"two",workspace:"a",fullAccess:false},{model:"one",workspace:"b",fullAccess:false},{model:"one",workspace:"a",fullAccess:true}]){
        assert.equal(cache.has("quota-test",cache.fingerprint(config)),false);
    }
});
test("new task preserves the complete user request and current data without the tool catalogue",()=>{
    const task="Corrige ce fichier et préserve toutes mes consignes. ".repeat(150);
    const prompt=buildResumePrompt({task,activeFile:"src/app.js",observations:[{tool:"read_file",ok:true,result:{content:"current contents"}}]});
    assert.ok(prompt.includes(task));assert.match(prompt,/src\/app.js/);assert.match(prompt,/current contents/);
    assert.ok(!prompt.includes("OUTILS DISPONIBLES"));assert.match(prompt,/ask_user/);
});
