"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),{EventEmitter}=require("node:events");
const {createClient}=require("../src/mcp/client");
function fixture(){
    const child=new EventEmitter();let killed=false;
    child.stdout=new EventEmitter();child.stdout.setEncoding=()=>{};
    child.stderr=new EventEmitter();child.stderr.setEncoding=()=>{};
    child.stdin=new EventEmitter();child.stdin.end=()=>{};
    child.stdin.write=(line,callback)=>{
        const request=JSON.parse(line);
        if(request.method==="initialize")queueMicrotask(()=>child.stdout.emit("data",JSON.stringify({id:request.id,result:{serverInfo:{name:"test"}}})+"\n"));
        callback?.();return true;
    };
    child.kill=()=>{killed=true;};
    const client=createClient({name:"test",command:process.execPath,spawnImpl:()=>child,timeoutMs:1000});
    return {child,client,killed:()=>killed};
}
test("a broken MCP pipe rejects a pending call as uncertain without an uncaught stream error",async()=>{
    const {client,child,killed}=fixture();await client.start();
    const pending=client.callTool("modify_scene",{});
    const rejected=assert.rejects(pending,error=>error.executionUncertain===true&&/connexion MCP interrompue/.test(error.message));
    child.stdin.emit("error",Object.assign(new Error("broken pipe"),{code:"EPIPE"}));
    await rejected;assert.equal(client.running,false);assert.equal(killed(),true);
    child.stdout.emit("error",new Error("already closed"));
    client.close();
});
test("MCP call timeouts identify uncertainty without retrying the action",async()=>{
    const {client}=fixture();await client.start();
    try{await assert.rejects(client.callTool("modify_scene",{},10),error=>error.executionUncertain===true&&/état de l’action est inconnu/.test(error.message));}
    finally{client.close();}
});
