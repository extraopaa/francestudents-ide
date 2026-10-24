"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readReceipt}=require("../src/api/visual-receipt");
const receipt={images:[{index:1,status:"seen",description:'Un panneau bleu avec le texte "Accueil" et une zone {centrale}.'}]};
test("visual receipt accepts fenced, wrapped and prose-surrounded JSON",()=>{
    const json=JSON.stringify(receipt);
    for(const response of [json,`Voici la capture :\n\`\`\`json\n${json}\n\`\`\`\nFin.`,JSON.stringify({message:json})]){
        assert.deepEqual(readReceipt(response,1),[receipt.images[0].description]);
    }
});
test("visual receipt never treats prose or unavailable pixels as confirmed vision",()=>{
    assert.throws(()=>readReceipt("Je vais examiner la capture.",1),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt(JSON.stringify({images:[{index:1,status:"unavailable",description:"Pixels inaccessibles"}]}),1),error=>error.status===400&&!error.receiptFormat);
    assert.throws(()=>readReceipt(JSON.stringify(receipt),2),error=>error.receiptFormat===true);
    assert.throws(()=>readReceipt('{"images":[null]}',1),error=>error.receiptFormat===true);
});
