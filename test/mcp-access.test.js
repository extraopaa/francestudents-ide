"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {untestedMcpDenial}=require("../src/agent/mcp-access");
const catalog='- server "blender-mcp", tool "get_scene_info" : Inspect scene';
const denial="Je ne dispose pas ici d’une connexion à Blender permettant d’inspecter la scène.";
test("a claimed missing Blender connection is checked only against available MCP servers",()=>{
    assert.equal(untestedMcpDenial(denial,catalog),true);
    assert.equal(untestedMcpDenial(denial,""),false);
    assert.equal(untestedMcpDenial(denial,'- server "github", tool "read"'),false);
    assert.equal(untestedMcpDenial("Blender a été inspecté avec succès.",catalog),false);
});
test("actual MCP attempts, permission denials and cancellation never trigger a connection retry",()=>{
    for(const observation of [{tool:"mcp_call",ok:false,error:"Connection refused"},{tool:"mcp_call",ok:true,result:{schema:{}}},{tool:"read_file",result:{denied:true}},{tool:"read_file",error:"Préchargement annulé par l’utilisateur."}]){
        assert.equal(untestedMcpDenial(denial,catalog,[observation]),false);
    }
});
