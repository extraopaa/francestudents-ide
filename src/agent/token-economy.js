"use strict";
const {createHash}=require("node:crypto");
const digest=text=>createHash("sha256").update(text).digest("hex");
function createReadDeliveryCache(){
    const sent=new Set();
    function readKey(observation,scope,max){
        if(!scope?.id||observation?.ok!==true||!["read_file","read_attachment"].includes(observation.tool))return null;
        const result=observation.result;
        if(typeof result?.content!=="string"||result.content.length<512||result.truncated||result.images_queued||result.denied||result.is_error||result.error)return null;
        const serialized=JSON.stringify(observation);
        // Only reference reads which actually fit in the prompt, never unseen truncated tails.
        return serialized.length<=Math.min(max,8000)?digest(JSON.stringify(scope)+serialized):null;
    }
    function mapBatch(observation,scope,max,operation){
        if(observation?.tool!=="batch"||!Array.isArray(observation.result?.results))return null;
        if(JSON.stringify(observation).length>max)return observation;
        const share=Math.floor(max/Math.max(1,observation.result.results.length));
        return {...observation,result:{...observation.result,results:observation.result.results.map(item=>operation(item,scope,share))}};
    }
    function delivery(observation,scope,max){
        if(!observation)return observation;
        const batch=mapBatch(observation,scope,max,delivery);if(batch)return batch;
        const key=readKey(observation,scope,max);
        return key&&sent.has(key)?{...observation,result:{...observation.result,content:"[Contenu identique à la lecture précédente dans cette conversation ; mêmes arguments et mêmes données.]",same_as_previous_read:true}}:observation;
    }
    function remember(observation,scope,max){
        if(!observation)return;
        if(mapBatch(observation,scope,max,remember))return;
        const key=readKey(observation,scope,max);if(key){sent.add(key);if(sent.size>256)sent.delete(sent.values().next().value);}
    }
    return {delivery,remember};
}

// Remove JSON layout whitespace only; preserve strings, numeric spelling and all fields.
function compactStructuredText(text){
    if(typeof text!=="string"||text.length<500||text.length>200000||!["[","{"].includes(text.trimStart()[0]))return text;
    try{JSON.parse(text);}catch{return text;}
    let out="",quoted=false,escaped=false;
    for(const char of text){
        if(quoted){out+=char;if(escaped)escaped=false;else if(char==="\\")escaped=true;else if(char==='"')quoted=false;}
        else if(char==='"'){quoted=true;out+=char;}
        else if(!/\s/.test(char))out+=char;
    }
    return out;
}

const checkResults=new WeakMap();
function compactSuccessfulCheck(observation){
    const result=observation?.result;
    if(observation?.tool!=="run_command"||observation.ok!==true||result?.exit_code!==0||result.timed_out||result.truncated||result.error_lines!==0||typeof result.output!=="string"||result.output.length<4000)return observation;
    if(!/\b(?:npm|pnpm|yarn|bun)\s+(?:test\b|run\s+(?:test|lint|check|build)\b)|\b(?:pytest|eslint|tsc)\b|\bcargo\s+(?:test|check|build)\b/i.test(result.command||"")||/\b(?:warn(?:ing)?s?|avertissements?|error|erreur|failed|failure|fatal|panic|traceback|exception|not ok)\b/i.test(result.output))return observation;
    const {state}=require("../state"),scope=JSON.stringify([state.workspace,Boolean(state.motionDesign)]),signature=digest(scope+JSON.stringify(result));
    const known=checkResults.get(observation);if(known?.signature===signature&&Date.now()-known.at<10*60*1000)return known.value;
    try{
        const name="verification-complete.txt",manifest=require("../api/local-attachments").registerText(name,result.output);
        const {id}=JSON.parse(manifest.split("\n")[1]);
        const value={...observation,result:{...result,output:result.output.slice(0,900)+"\n[… journal détaillé conservé localement ; lecture possible via read_attachment …]\n"+result.output.slice(-900),truncated_in_prompt:true,full_output:{id,path:name}}};
        checkResults.set(observation,{signature,value,at:Date.now()});return value;
    }catch{return observation;}
}
module.exports={createReadDeliveryCache,compactStructuredText,compactSuccessfulCheck};
