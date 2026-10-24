"use strict";
const {requireString}=require("./core/args");
function check(args){
    requireString(args.id,"id");
    for(const key of ["path","query"])if(args[key]!==undefined)requireString(args[key],key);
    for(const key of ["start","offset","max_chars"])if(args[key]!==undefined&&(!Number.isSafeInteger(args[key])||args[key]<(key==="max_chars"?200:0)))throw new Error(`${key} invalide.`);
    if(args.max_chars>12000)throw new Error("max_chars : 12000 maximum par lecture ; utilise next_start pour poursuivre.");
    if(args.query?.length>500)throw new Error("query : 500 caractères maximum.");
    if(args.page!==undefined&&(!Number.isSafeInteger(args.page)||args.page<1))throw new Error("page : entier positif attendu.");
    if(args.visual!==undefined&&typeof args.visual!=="boolean")throw new Error("visual : booléen attendu.");
}
module.exports={name:"read_attachment",check,run:args=>{check(args);return require("../api/local-attachments").read(args);},describe:args=>args.path||"Inventaire de la pièce jointe"};
