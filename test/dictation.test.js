"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createDictation } = require("../desktop/dictation");
const { createLocalSpeechEngine, MODEL, REVISION } = require("../desktop/local-speech-engine");

class FakeWorker extends EventEmitter {
    constructor(options) { super(); this.options=options;this.calls=[];this.terminated=false; }
    postMessage(message,transfer=[]) {
        this.calls.push({message,transfer});
        queueMicrotask(()=>this.emit("message",{id:message.id,value:message.action==="prepare"?{ready:true,local:true}:"Bonjour"}));
    }
    terminate() { this.terminated=true;return Promise.resolve(0); }
}

test("dictation prepares locally and sends PCM only to its worker",async()=>{
    let worker;
    const dictation=createDictation({createWorker:options=>(worker=new FakeWorker(options)),cacheDir:()=>"local-cache"});
    try{
        await assert.rejects(dictation.dictate("transcribe",new Int16Array(1600)),/Pr[ée]pare/);
        await dictation.dictate("prepare");
        assert.equal(worker.options.workerData.cacheDir,"local-cache");
        assert.equal(worker.calls[0].message.action,"prepare");
        assert.equal(await dictation.dictate("transcribe",new Int16Array(1600)),"Bonjour");
        assert.equal(worker.calls[1].message.action,"transcribe");
        assert.equal(worker.calls[1].transfer.length,1);
        assert.ok(worker.calls[1].message.pcm instanceof ArrayBuffer);
    }finally{await dictation.dictate("cancel");}
});

test("local model setup pins Whisper and blocks network during inference",async()=>{
    const env={};let opts;let received;
    const pipeline=async(task,model,options)=>{opts={task,model,options};return async(samples)=>{received=samples;return {text:" Bonjour "};};};
    const engine=createLocalSpeechEngine({pipeline,env,cacheDir:"cache"});
    assert.equal((await engine.prepare()).local,true);
    assert.equal(opts.model,MODEL);assert.equal(opts.options.revision,REVISION);assert.equal(opts.options.device,"cpu");
    assert.equal(env.allowLocalModels,true);assert.equal(env.allowRemoteModels,false);
    assert.equal(env.remotePathTemplate,`{model}/resolve/${REVISION}/`);
    const pcm=new Int16Array(1600).fill(1200);
    assert.equal(await engine.transcribe(pcm),"Bonjour");
    assert.ok(received.every(value=>value===0),"audio samples are cleared after recognition");
    await assert.rejects(engine.modelFetch("https://huggingface.co/onnx-community/whisper-base/resolve/main/config.json"),/R[ée]seau d[ée]sactiv[ée]/);
});

test("dictation refuses malformed audio before starting a worker",async()=>{
    let starts=0;const dictation=createDictation({createWorker:()=>{starts++;return new FakeWorker();}});
    await assert.rejects(dictation.dictate("transcribe","not audio"),/120 secondes/);
    await assert.rejects(dictation.dictate("transcribe",new Int16Array(16000*120+1)),/120 secondes/);
    assert.equal(starts,0);
});
