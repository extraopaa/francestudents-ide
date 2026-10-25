"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const settings=require("../src/settings"),preferences=require("../desktop/preferences"),{state}=require("../src/state"),{auth}=require("../src/api/auth"),{requestModel}=require("../src/api/api");
test("automatic local preparation ignores legacy beta flags and falls back without exposing excluded ZIP entries",async()=>{
    const previous={settings:settings.load(),fetch:global.fetch,register:require("../src/api/local-attachments").registerArchive};
    const bytes=Buffer.from(require("fflate").zipSync({"keep.txt":Buffer.from("KEEP_BODY"),"private.txt":Buffer.from("EXCLUDED_BODY")}));
    auth.accessToken="test-token";auth.expiresAt=Date.now()+300000;auth.deviceId="test-device";
    let body;
    global.fetch=async(_,options)=>{
        body=JSON.parse(options.body);
        return new Response('event: response.output_text.delta\ndata: '+JSON.stringify({chat_id:"auto-local-test",delta:"ok"})+'\n\ndata: [DONE]\n\n');
    };
    const attach=()=>{state.chatIds.agent=null;state.pendingImages=[];state.pendingFiles=[{name:"files.zip",dataUrl:`data:application/zip;base64,${bytes.toString("base64")}`,selectedPaths:["keep.txt"]}];};
    try{
        for(const legacy of [false,true]){
            settings.save({localAttachmentsExperimental:legacy});attach();
            await requestModel("Read selected files",{conversationMode:"agent"});
            assert.match(body.initialContent,/PRÉPARÉE LOCALEMENT/);assert.ok(!body.initialContent.includes("KEEP_BODY"));assert.ok(!body.initialContent.includes("EXCLUDED_BODY"));
        }
        assert.equal(preferences.get().localAttachmentsExperimental,undefined);
        require("../src/api/local-attachments").registerArchive=()=>{throw Error("Local index unavailable");};attach();
        await requestModel("Read selected files",{conversationMode:"agent"});
        assert.match(body.initialContent,/KEEP_BODY/);assert.ok(!body.initialContent.includes("EXCLUDED_BODY"));assert.ok(!body.initialContent.includes("private.txt"));
    }finally{settings.save(previous.settings);global.fetch=previous.fetch;require("../src/api/local-attachments").registerArchive=previous.register;state.pendingImages=[];state.pendingFiles=[];state.chatIds.agent=null;}
});
