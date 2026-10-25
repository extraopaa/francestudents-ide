"use strict";
const { Worker } = require("node:worker_threads");
const path = require("node:path");

// A single reusable local CPU worker, never an API transcription job.
function createDictation({ createWorker = options => new Worker(path.join(__dirname,"dictation-worker.js"),options),
    cacheDir = () => path.join(require("../src/config").CONFIG.dataDir,"speech-models"),
    prepareTimeout = 10*60*1000, transcribeTimeout = 5*60*1000, idleTimeout = 3*60*1000 } = {}) {
    let worker=null, pending=null, ready=false, nextId=0, idle=null;
    function stop(message="Dictée annulée.") {
        clearTimeout(idle);idle=null;ready=false;
        const old=worker;worker=null;
        if(pending){clearTimeout(pending.timer);pending.reject(new Error(message));pending=null;}
        if(old)Promise.resolve(old.terminate()).catch(()=>{});
    }
    function getWorker(){
        if(worker)return worker;
        const current=createWorker({workerData:{cacheDir:cacheDir()},env:{...process.env,HF_TOKEN:"",HUGGING_FACE_HUB_TOKEN:"",HF_HUB_DISABLE_TELEMETRY:"1",DO_NOT_TRACK:"1"}});
        worker=current;
        current.on("message",message=>{
            if(worker!==current||message?.id!==pending?.id)return;
            const request=pending;pending=null;clearTimeout(request.timer);
            if(message.error){stop("Le moteur de dictée locale a échoué.");request.reject(new Error(String(message.error).slice(0,600)));return;}
            if(request.action==="prepare")ready=true;
            current.unref?.();
            idle=setTimeout(()=>stop(),idleTimeout);idle.unref?.();
            request.resolve(message.value);
        });
        current.on("error",error=>{if(worker===current)stop(`Dictée locale indisponible : ${String(error.message).slice(0,300)}. Aucun audio n’a été envoyé.`);});
        current.on("exit",()=>{if(worker===current)stop("Le moteur de dictée locale s’est arrêté. Ton brouillon est conservé.");});
        return current;
    }
    function request(action,payload){
        if(pending)throw new Error("Une préparation ou transcription locale est déjà en cours.");
        clearTimeout(idle);idle=null;
        const current=getWorker();current.ref?.();
        return new Promise((resolve,reject)=>{
            const id=++nextId;
            const timer=setTimeout(()=>stop("La dictée locale a dépassé son délai. Réessaie avec un enregistrement plus court ; aucun audio n’a été envoyé."),action==="prepare"?prepareTimeout:transcribeTimeout);
            pending={id,action,resolve,reject,timer};
            try{
                const pcm=action==="transcribe"?payload.slice().buffer:undefined;
                current.postMessage({id,action,...(pcm?{pcm}:{})},pcm?[pcm]:[]);
            }catch(error){stop(error.message);}
        });
    }
    async function dictate(action,payload){
        if(action==="cancel"){stop();return null;}
        if(action==="prepare")return ready?{ready:true,local:true}:request(action);
        if(action!=="transcribe")throw new Error("Action de dictée inconnue.");
        if(!(payload instanceof Int16Array)||payload.length<1600||payload.length>16000*120)
            throw new Error("La dictée doit durer entre 0,1 et 120 secondes.");
        if(!ready)throw new Error("Prépare d’abord le modèle de dictée locale avant d’activer le micro.");
        return request(action,payload);
    }
    return {dictate};
}
const local=createDictation();
module.exports={dictate:local.dictate,createDictation};
