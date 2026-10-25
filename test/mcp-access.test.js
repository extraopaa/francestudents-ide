"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {untestedMcpDenial,resolveNativeMcp,capabilityHint,selectMcpTool}=require("../src/agent/mcp-access");
const catalog='- server "blender-mcp", tool "get_scene_info" : Inspect scene';
const denial="Je ne dispose pas ici d’une connexion à Blender permettant d’inspecter la scène.";
test("a claimed missing Blender connection is checked only against available MCP servers",()=>{
    assert.equal(untestedMcpDenial(denial,catalog),true);
    assert.equal(untestedMcpDenial(denial,""),false);
    assert.equal(untestedMcpDenial(denial,'- server "github", tool "read"'),false);
    assert.equal(untestedMcpDenial("Blender a été inspecté avec succès.",catalog),false);
});

test("MCP native names resolve only against the available catalogue and never guess ambiguous tools",()=>{
    for(const name of ["get_scene_info","blender-mcp.get_scene_info","mcp__blender-mcp__get_scene_info"]){
        assert.deepEqual(resolveNativeMcp(name,catalog),{server:"blender-mcp",tool:"get_scene_info"});
    }
    assert.equal(resolveNativeMcp("get_scene_info",catalog+'\n- server "other", tool "get_scene_info"'),null);
    assert.equal(resolveNativeMcp("execute_unknown",catalog),null);
    assert.match(capabilityHint(catalog,"Inspecte Blender"),/"server":"blender-mcp"/);
    assert.equal(capabilityHint("","Inspecte Blender"),"");
});

test("schema description alone is not evidence of application access; real refusals still stop recovery",()=>{
    const described={tool:"mcp_call",args:{describe:true},ok:true,result:{schema:{}}};
    assert.equal(untestedMcpDenial("Je n’ai aucun outil accessible ici.",catalog,[described],"Crée une scène Blender"),true);
    assert.equal(untestedMcpDenial(denial,catalog,[{...described,result:{denied:true}}]),false);
});
test("actual MCP attempts, permission denials and cancellation never trigger a connection retry",()=>{
    for(const observation of [{tool:"mcp_call",ok:false,error:"Connection refused"},{tool:"mcp_call",ok:true,result:{schema:{}}},{tool:"read_file",result:{denied:true}},{tool:"read_file",error:"Préchargement annulé par l’utilisateur."}]){
        assert.equal(untestedMcpDenial(denial,catalog,[observation]),false);
    }
});

test("recovery selects a tool from the matching available server, with whole server words",()=>{
    const multiple='- server "github", tool "read"\n'+catalog;
    assert.deepEqual(selectMcpTool(multiple,"Vérifie Blender"),{server:"blender-mcp",tool:"get_scene_info"});
    assert.deepEqual(selectMcpTool(multiple,"Mygithubproject"),{server:"github",tool:"read"});
    assert.equal(selectMcpTool("","Blender"),"");
});

test("a real MCP attempt or cancellation in a read batch also prevents recovery",()=>{
    for(const item of [{tool:"mcp_call",args:{server:"blender-mcp",tool:"get_scene_info"},ok:false},{tool:"read_file",result:{cancelled:true}}]){
        assert.equal(untestedMcpDenial(denial,catalog,[{tool:"batch",result:{results:[item]}}]),false);
    }
});
