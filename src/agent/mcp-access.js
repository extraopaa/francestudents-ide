"use strict";
function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g," ");}
function untestedMcpDenial(message,catalog,observations=[]){
    const text=normalize(message);
    const denial=/(?:ne dispose pas|n ai pas|pas d acces|aucun acces|pas ici|ne peux pas|cannot|no access|not connected)/.test(text);
    if(!denial||!/(?:connexion|connecte|connection|access|acces)/.test(text))return false;
    // A denial/cancellation or any attempted MCP execution is evidence: never override it.
    if(observations.some(item=>item.tool==="mcp_call"||item.result?.denied||item.result?.cancelled||/annul|refus/i.test(item.error||"")))return false;
    return String(catalog||"").split("\n").some(line=>{
        const server=/^- server "([^"]+)", tool "([^"]+)"/.exec(line);
        if(!server)return false;
        const words=normalize(server[1]).split(/[^a-z0-9]+|mcp/).filter(word=>word.length>=3&&!['server','serveur'].includes(word));
        return words.some(word=>new RegExp(`\\b${word}\\b`).test(text));
    });
}
module.exports={untestedMcpDenial};
