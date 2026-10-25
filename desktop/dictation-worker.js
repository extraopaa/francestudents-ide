"use strict";
const {parentPort,workerData}=require("node:worker_threads");
const {mkdir}=require("node:fs/promises");
const {createLocalSpeechEngine}=require("./local-speech-engine");
let engine=null;
parentPort.on("message",async({id,action,pcm})=>{
    try{
        let value;
        if(action==="prepare"){
            await mkdir(workerData.cacheDir,{recursive:true});
            if(!engine){
                const {pipeline,env}=await import("@huggingface/transformers");
                engine=createLocalSpeechEngine({pipeline,env,cacheDir:workerData.cacheDir});
                globalThis.fetch=engine.modelFetch;
            }
            value=await engine.prepare();
        }else if(action==="transcribe"&&engine){
            value=await engine.transcribe(new Int16Array(pcm));
        }else throw new Error("Prépare d’abord le moteur local de dictée.");
        parentPort.postMessage({id,value});
    }catch(error){parentPort.postMessage({id,error:String(error.message).slice(0,600)});}
});
