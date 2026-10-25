"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {createReadDeliveryCache,compactStructuredText,compactSuccessfulCheck}=require("../src/agent/token-economy");
test("repeat-read references are scoped to the conversation, model, workspace and exact fully delivered data",()=>{
    const cache=createReadDeliveryCache(),scope={id:"one",model:1,workspace:"project",motion:false};
    const observation={tool:"read_file",ok:true,args:{path:"a.js"},result:{path:"a.js",content:"const example = 1;\n".repeat(100),truncated:false}};
    assert.equal(cache.delivery(observation,scope,15000),observation);
    cache.remember(observation,scope,15000);
    const delivery=cache.delivery(observation,scope,15000);
    assert.equal(delivery.result.same_as_previous_read,true);assert.ok(delivery.result.content.length<observation.result.content.length/4);
    assert.ok(!observation.result.same_as_previous_read);
    for(const changed of [{...scope,id:"two"},{...scope,model:2},{...scope,workspace:"other"},{...scope,motion:true}])assert.equal(cache.delivery(observation,changed,15000),observation);
    const updated={...observation,result:{...observation.result,content:"Updated content"}};
    assert.equal(cache.delivery(updated,scope,15000),updated);
    const truncated={...observation,result:{...observation.result,truncated:true}};
    cache.remember(truncated,scope,15000);assert.equal(cache.delivery(truncated,scope,15000),truncated);
    const tiny={...observation,result:{...observation.result,content:"x"}};
    cache.remember(tiny,scope,15000);assert.equal(cache.delivery(tiny,scope,15000),tiny);
});
test("MCP JSON compaction preserves strings and integer spelling rather than rounding data",()=>{
    const text='{\n  "id": 90071992547409931234,\n  "text": '+JSON.stringify('keep   spaces and "quotes"')+',\n  "items": [\n'+Array(100).fill('    { "value": 1 }').join(',\n')+'\n  ]\n}';
    const compact=compactStructuredText(text);
    assert.ok(compact.length<text.length);assert.match(compact,/90071992547409931234/);assert.match(compact,/keep {3}spaces/);
    assert.equal(compactStructuredText("not JSON ".repeat(100)),"not JSON ".repeat(100));
});
test("successful verbose checks keep a local readable full log, while failures and warnings stay detailed",async()=>{
    const observation={tool:"run_command",ok:true,result:{command:"npm test",exit_code:0,error_lines:0,truncated:false,output:"START\n"+"test passed\n".repeat(500)+"MIDDLE_SENTINEL\n"+"test passed\n".repeat(500)+"END"}};
    const compact=compactSuccessfulCheck(observation);
    assert.ok(compact.result.output.length<observation.result.output.length/3);assert.equal(compact.result.exit_code,0);
    const complete=await require("../src/api/local-attachments").read({...compact.result.full_output,max_chars:12000});
    assert.match(complete.content,/MIDDLE_SENTINEL/);
    const tail=complete.next_start===null?"":(await require("../src/api/local-attachments").read({...compact.result.full_output,start:complete.next_start,max_chars:12000})).content;
    assert.equal(complete.content+tail,observation.result.output);
    assert.equal(compactSuccessfulCheck(observation),compact);
    for(const result of [{...observation.result,exit_code:1},{...observation.result,output:observation.result.output+"\nWarning: deprecated"}]){
        const failed={...observation,result};assert.equal(compactSuccessfulCheck(failed),failed);
    }
});
