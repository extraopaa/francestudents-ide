"use strict";
const os=require("node:os");
const MODEL="onnx-community/whisper-base";
const REVISION="1846881b6b3a3024392c1eea3ad983695bc23925";

function createLocalSpeechEngine({pipeline,env,cacheDir,fetchImpl=globalThis.fetch}){
    let transcriber=null,downloadsAllowed=false;
    async function modelFetch(input,options={}){
        const url=new URL(typeof input==="string"||input instanceof URL?input:input.url);
        const method=String(options.method||input?.method||"GET").toUpperCase();
        if(!downloadsAllowed||!["GET","HEAD"].includes(method)||options.body!=null||input?.body!=null||
            url.protocol!=="https:"||url.hostname!=="huggingface.co"||!url.pathname.startsWith(`/${MODEL}/resolve/${REVISION}/`)){
            throw new Error(`Réseau désactivé pour la transcription locale : ${url.origin}${url.pathname}. Seul le téléchargement initial du modèle est autorisé.`);
        }
        return fetchImpl(input,options);
    }
    env.cacheDir=cacheDir;env.useFSCache=true;env.useBrowserCache=false;
    // Transformers.js 4.3 probes file availability without forwarding the
    // revision option. Force every Hub URL to the pinned commit anyway.
    env.remotePathTemplate=`{model}/resolve/${REVISION}/`;
    env.allowLocalModels=true;env.allowRemoteModels=false;env.fetch=modelFetch;
    const options={revision:REVISION,cache_dir:cacheDir,device:"cpu",dtype:"q8",
        session_options:{intraOpNumThreads:Math.max(1,Math.min(4,(os.availableParallelism?.()||os.cpus().length)-1)),interOpNumThreads:1}};
    async function prepare(){
        if(transcriber)return {ready:true,local:true};
        try{
            transcriber=await pipeline("automatic-speech-recognition",MODEL,{...options,local_files_only:true});
        }catch{
            try{
                downloadsAllowed=true;env.allowRemoteModels=true;
                transcriber=await pipeline("automatic-speech-recognition",MODEL,{...options,local_files_only:false});
            }catch(cause){throw new Error("Le modèle de dictée locale n’a pas pu être préparé. Une connexion Internet est nécessaire pour son premier téléchargement (environ 100 Mo). Aucun audio n’a été envoyé.",{cause});}
            finally{downloadsAllowed=false;env.allowRemoteModels=false;}
        }
        return {ready:true,local:true};
    }
    async function transcribe(pcm){
        if(!transcriber)throw new Error("Modèle de dictée locale non préparé.");
        if(!(pcm instanceof Int16Array)||pcm.length<1600||pcm.length>16000*120)throw new Error("Audio PCM de dictée invalide.");
        const samples=new Float32Array(pcm.length);let energy=0;
        for(let index=0;index<pcm.length;index++){const value=pcm[index]/32768;samples[index]=value;energy+=value*value;}
        try{
            if(Math.sqrt(energy/pcm.length)<0.001)return "";
            const result=await transcriber(samples,{task:"transcribe",chunk_length_s:30,stride_length_s:5,return_timestamps:false,do_sample:false});
            return String(result?.text||"").trim().slice(0,20000);
        }finally{samples.fill(0);pcm.fill(0);}
    }
    return {prepare,transcribe,modelFetch};
}
module.exports={createLocalSpeechEngine,MODEL,REVISION};
