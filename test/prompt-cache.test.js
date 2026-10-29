"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const cache=require("../src/agent/prompt-cache");
const {buildResumePrompt,buildFollowUpPrompt}=require("../src/agent/prompt");
const {state}=require("../src/state");
const {TOOLS}=require("../src/tools/registry");
const {MOTION_TOOLS}=require("../src/tools/motion-scope");
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

test("tool reminders reflect the registry and preserve the motion boundary",()=>{
    const previous=state.motionDesign;
    try {
        for(const motion of [false,true]) {
            state.motionDesign=motion;
            const expected=Object.keys(TOOLS).filter(name=>motion?MOTION_TOOLS.has(name):name!=="effectcraft");
            for(const prompt of [buildResumePrompt({task:"Continuer"}),buildFollowUpPrompt({turn:2,maxTurns:15})]) {
                const line=prompt.split("\n").find(value=>value.startsWith("OUTILS LOCAUX ENREGISTRÉS POUR CET ESPACE :"));
                assert.ok(line);
                const names=line.split(" : ")[1].split(". Leur présence")[0].split(", ");
                assert.deepEqual(names,expected);
                assert.match(line,/ne garantit pas leur exécution/);
                if(motion) assert.match(line,/lectures du projet code sont interdites/);
                else assert.match(line,/5 maximum/);
            }
        }
    } finally { state.motionDesign=previous; }
});
