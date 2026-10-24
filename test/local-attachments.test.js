"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {state}=require("../src/state");
const store=require("../src/api/local-attachments");
const tool=require("../src/tools/read-attachment");
const {convertAttachment}=require("../src/api/file-conversion");
test("local archive index sends an inventory and selected entries only, while content stays readable in full",async()=>{
    const bytes=Buffer.from(require("fflate").zipSync({"keep.txt":Buffer.from("Important content ".repeat(1000)),"private.txt":Buffer.from("DO_NOT_SEND")}));
    const result=await convertAttachment({name:"files.zip",dataUrl:`data:application/zip;base64,${bytes.toString("base64")}`},{depth:0,budget:{bytes:0},localIndex:true,selectedPaths:["keep.txt"]});
    assert.deepEqual(result.images,[]);assert.ok(!result.text.includes("DO_NOT_SEND"));assert.ok(!result.text.includes("private.txt"));
    const manifest=JSON.parse(result.text.split("\n")[1]);
    assert.equal(manifest.total_files,1);assert.equal(manifest.files[0].path,"keep.txt");
    const first=await tool.run({id:manifest.id,path:"keep.txt",max_chars:1000});
    assert.match(first.content,/Important content/);assert.equal(first.next_start,1000);
    const next=await tool.run({id:manifest.id,path:"keep.txt",start:first.next_start,max_chars:1000});
    assert.equal(next.start,1000);assert.ok(next.content.length);
    await assert.rejects(tool.run({id:manifest.id,path:"private.txt"}),/absent/);
});
test("text search is local, bounded and does not expose attachments across Code/Motion",async()=>{
    const previous=state.motionDesign;state.motionDesign=false;
    try{
        const manifest=JSON.parse(store.registerText("notes.txt","Intro\n"+"filler ".repeat(3000)+"NEEDLE useful result").split("\n")[1]);
        const found=await tool.run({id:manifest.id,path:"notes.txt",query:"NEEDLE"});
        assert.ok(found.matches.some(match=>match.content.includes("NEEDLE")));
        state.motionDesign=true;
        await assert.rejects(tool.run({id:manifest.id,path:"notes.txt"}),/indisponible/);
        assert.throws(()=>tool.check({id:manifest.id,max_chars:100000}),/maximum/);
    }finally{state.motionDesign=previous;}
});
test("ZIP selection preview returns metadata only and never file bodies",async()=>{
    const bytes=Buffer.from(require("fflate").zipSync({"one.txt":Buffer.from("hidden body"),"folder/two.txt":Buffer.from("second body")}));
    const preview=await require("../desktop/zip-selection").preview({data:`data:application/zip;base64,${bytes.toString("base64")}`});
    assert.deepEqual(preview.map(item=>item.name),["one.txt","folder/two.txt"]);
    assert.ok(!JSON.stringify(preview).includes("hidden body"));assert.equal(preview[0].size,11);
});
