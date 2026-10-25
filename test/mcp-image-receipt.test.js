"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const receipt=require("../src/api/mcp-image-receipt");
test("simple acknowledgement applies only to MCP captures and GPT 6.1 Sol, with provenance retained after upload",()=>{
    const original="mcp-capture-for-test",id="uploaded-mcp-capture-for-test";
    assert.equal(receipt.useSimpleReceipt(-1003,[original]),false);
    receipt.mark(original);assert.equal(receipt.useSimpleReceipt(-1003,[original]),true);
    receipt.rekey(original,id);assert.equal(receipt.useSimpleReceipt(-1003,[id]),true);
    assert.equal(receipt.useSimpleReceipt(-1003,[original]),false);
    assert.equal(receipt.useSimpleReceipt(-1002,[id]),false);
    assert.equal(receipt.useSimpleReceipt(-2001,[id]),false);
    assert.equal(receipt.useSimpleReceipt(-1003,[id,"ordinary-user-attachment"]),false);
    assert.equal(receipt.useSimpleReceipt(-1003,[]),false);
});
test("GPT 6.1 MCP receipt accepts a short yes without pretending the image content was described",()=>{
    assert.match(receipt.prompt(1),/As-tu reçu l’image jointe/);
    for(const answer of ["Oui.","Oui, reçue.",JSON.stringify({type:"final",message:"Oui, j’ai reçu l’image."})]){
        const result=receipt.read(answer,1);assert.equal(result.length,1);assert.match(result[0],/Contenu visuel non décrit/);
    }
    for(const answer of ["Non.","Je vais regarder.","Oui, mais je ne peux pas accéder à l’image."]){
        assert.throws(()=>receipt.read(answer,1),error=>error.status===400&&error.receiptFormat===false);
    }
    assert.throws(()=>receipt.read("Oui, mais seulement une image sur deux.",2));
});
