"use strict";
const {createHash}=require("node:crypto");
// Process-local only: reopening the application always bootstraps instructions again.
const bootstraps=new Map();
function fingerprint(context){return createHash("sha256").update(JSON.stringify(context)).digest("hex");}
function has(id,signature){return Boolean(id)&&bootstraps.get(id)===signature;}
function remember(id,signature){
    if(!id)return;
    bootstraps.delete(id);bootstraps.set(id,signature);
    while(bootstraps.size>40)bootstraps.delete(bootstraps.keys().next().value);
}
module.exports={fingerprint,has,remember};
