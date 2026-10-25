"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os");
const {state,resetConversation}=require("../src/state"),api=require("../src/api/api"),memory=require("../src/project/memory");
const {manager}=require("../src/mcp/manager"),{setUiBackend,UI_METHODS}=require("../src/ui-bridge"),{runAgent}=require("../src/agent/agent");
const quietUi=()=>Object.fromEntries(UI_METHODS.map(name=>[name,()=>{}]));
for(const scenario of [
    {name:"cannot verify the session",denial:"Je ne peux pas vérifier la connexion à ta session Blender depuis cette interface."},
    {name:"no local access",denial:"Je n’ai pas accès à Blender dans cet environnement."},
    {name:"no connection available",denial:"Je ne dispose pas ici d’une connexion à Blender."},
    {name:"schema discovery failure is not retried",denial:"Je ne peux pas vérifier la connexion à Blender.",schemaError:true},
    {name:"plan mode has no automatic MCP recovery",denial:"Je ne peux pas vérifier la connexion à Blender.",readOnly:true},
    {name:"eco mode has no automatic MCP recovery",denial:"Je ne peux pas vérifier la connexion à Blender.",eco:true}
])test(`MCP denial recovery: ${scenario.name}`,async()=>{
    // Provider responses are mocked: this checks local orchestration, not live model compatibility.
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-mcp-discovery-"));
    const previous={request:api.requestModel,start:manager.ensureStarted,catalog:manager.catalog,describe:manager.describeTool,find:manager.findTool,call:manager.call,workspace:state.workspace,eco:state.ecoMode};
    resetConversation();state.workspace=dir;state.ecoMode=!!scenario.eco;await memory.open(dir);
    let modelCalls=0,descriptions=0,toolCalls=0,confirmations=0;
    setUiBackend({...quietUi(),confirm:async()=>{confirmations++;return true;},spinner:()=>({stop(){}})});
    manager.ensureStarted=async()=>[];
    manager.catalog=()=>'- server "blender-mcp", tool "get_scene_info" : Inspect the Blender scene';
    manager.findTool=()=>({});
    manager.describeTool=(server,tool)=>{
        descriptions++;assert.equal(server,"blender-mcp");assert.equal(tool,"get_scene_info");assert.equal(toolCalls,0);
        if(scenario.schemaError)throw new Error("Registered schema unavailable");
        return {description:"Inspect scene",arguments:["scene_name"],schema:{type:"object",properties:{scene_name:{type:"string"}}}};
    };
    manager.call=async(server,tool,args)=>{toolCalls++;assert.equal(descriptions,1);assert.equal(server,"blender-mcp");assert.equal(tool,"get_scene_info");assert.deepEqual(args,{scene_name:"Scene"});return {text:"Observed scene: Scene",isError:false,images:[]};};
    api.requestModel=async prompt=>{
        modelCalls++;state.chatIds.agent="mcp-discovery";state.chatId="mcp-discovery";
        if(modelCalls===1)return JSON.stringify({type:"final",message:scenario.denial,completed:false});
        if(scenario.schemaError){assert.match(prompt,/Registered schema unavailable/);return JSON.stringify({type:"final",message:scenario.denial,completed:false});}
        if(modelCalls===2){
            assert.match(prompt,/scene_name/);assert.match(prompt,/"describe":true/);assert.equal(toolCalls,0);assert.equal(confirmations,0);
            return JSON.stringify({type:"tool",name:"mcp_call",args:{server:"blender-mcp",tool:"get_scene_info",arguments:{scene_name:"Scene"}},reason:"Check Blender"});
        }
        assert.match(prompt,/Observed scene: Scene/);
        return JSON.stringify({type:"final",message:"Blender a répondu : scène Scene.",completed:true});
    };
    try{
        const result=await runAgent("Tu es connecté à Blender ?",{readOnly:!!scenario.readOnly});
        const blocked=scenario.readOnly||scenario.eco;
        assert.equal(modelCalls,blocked?1:scenario.schemaError?2:3);
        assert.equal(descriptions,blocked?0:1);assert.equal(toolCalls,blocked||scenario.schemaError?0:1);
        assert.equal(confirmations,toolCalls);assert.equal(result.completed,!blocked&&!scenario.schemaError);
    }finally{
        Object.assign(manager,{ensureStarted:previous.start,catalog:previous.catalog,describeTool:previous.describe,findTool:previous.find,call:previous.call});
        api.requestModel=previous.request;state.workspace=previous.workspace;state.ecoMode=previous.eco;setUiBackend(null);memory.close();resetConversation();fs.rmSync(dir,{recursive:true,force:true});
    }
});

for(const uncertain of [false,true])test(`MCP ${uncertain?"uncertain calls are not repeated":"tool errors stay failures in observations"}`,async()=>{
    const dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-mcp-reliability-"));
    const previous={request:api.requestModel,start:manager.ensureStarted,catalog:manager.catalog,find:manager.findTool,call:manager.call,workspace:state.workspace,eco:state.ecoMode};
    resetConversation();state.workspace=dir;state.ecoMode=false;await memory.open(dir);
    let modelCalls=0,toolCalls=0;
    setUiBackend({...quietUi(),confirm:async()=>true,spinner:()=>({stop(){}})});
    manager.ensureStarted=async()=>[];manager.catalog=()=>'- server "test", tool "modify_scene"';manager.findTool=()=>({});
    manager.call=async()=>{toolCalls++;if(uncertain)throw Object.assign(new Error("Result lost"),{executionUncertain:true});return {text:"Scene rejected",isError:true,images:[]};};
    api.requestModel=async prompt=>{
        modelCalls++;state.chatIds.agent="mcp-reliability";state.chatId="mcp-reliability";
        if(modelCalls===1)return JSON.stringify({type:"tool",name:"mcp_call",args:{server:"test",tool:"modify_scene",arguments:{one:1,two:2}},reason:"Modify scene"});
        if(uncertain&&modelCalls===2)return JSON.stringify({type:"tool",name:"mcp_call",args:{arguments:{two:2,one:1},tool:"modify_scene",server:"test"},reason:"Retry scene"});
        assert.match(prompt,/"ok":false/);
        if(!uncertain)assert.match(prompt,/"is_error":true/);
        return JSON.stringify({type:"final",message:"La scène n’est pas confirmée.",completed:false});
    };
    try{const result=await runAgent("Modify the test scene");assert.equal(result.completed,false);assert.equal(toolCalls,1);assert.equal(modelCalls,uncertain?3:2);}
    finally{Object.assign(manager,{ensureStarted:previous.start,catalog:previous.catalog,findTool:previous.find,call:previous.call});api.requestModel=previous.request;state.workspace=previous.workspace;state.ecoMode=previous.eco;setUiBackend(null);memory.close();resetConversation();fs.rmSync(dir,{recursive:true,force:true});}
});
