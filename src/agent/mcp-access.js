"use strict";
function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g," ");}
function catalogTools(catalog){return String(catalog||"").split("\n").map(line=>{
    const match=/^- server "([^"]+)", tool "([^"]+)"/.exec(line);
    return match?{server:match[1],tool:match[2]}:null;
}).filter(Boolean);}
function selectMcpTool(catalog,task=""){
    const tools=catalogTools(catalog);if(!tools.length)return "";
    const text=normalize(task);
    return tools.find(item=>normalize(item.server).split(/[^a-z0-9]+|mcp/).some(word=>word.length>=3&&!['server','serveur'].includes(word)&&new RegExp(`\\b${word}\\b`).test(text)))||tools[0];
}
function capabilityHint(catalog,task=""){
    const match=selectMcpTool(catalog,task);if(!match)return "";
    return "CONNECTEURS LOCAUX DISPONIBLES — Le catalogue MCP a été obtenu par l’IDE, indépendamment du fournisseur IA. Pour découvrir les arguments d’un outil réellement proposé, réponds dans le texte avec "+JSON.stringify({type:"tool",name:"mcp_call",args:{server:match.server,tool:match.tool,describe:true},reason:"Découvrir le schéma du connecteur local"})+". Cette description ne teste pas la connexion à l’application : appelle ensuite l’outil utile sous les permissions existantes. N’invente pas un outil et ne conclus pas à une absence d’accès depuis ton environnement natif.";
}
function resolveNativeMcp(name,catalog){
    const matches=catalogTools(catalog).filter(({server,tool})=>[tool,`${server}.${tool}`,`${server}/${tool}`,`mcp__${server}__${tool}`,`mcp_${server}_${tool}`].includes(name));
    return matches.length===1?matches[0]:null;
}
function untestedMcpDenial(message,catalog,observations=[],task=""){
    const text=normalize(message);
    const denial=/(?:ne dispose pas|ne dispose d aucun|n ai pas|n ai aucun|pas d acces|aucun acces|pas ici|ne peux pas|cannot|can t|no access|not connected)/.test(text);
    if(!denial||!/(?:connexion|connecte|connection|access|acces|outil|tool|mcp)/.test(text))return false;
    // A denial/cancellation or any attempted MCP execution is evidence: never override it.
    const attempted=items=>items.some(item=>item.tool==="mcp_call"&&item.args?.describe!==true||item.result?.denied||item.result?.cancelled||/annul|refus/i.test(item.error||"")||item.tool==="batch"&&attempted(item.result?.results||[]));
    if(attempted(observations))return false;
    return String(catalog||"").split("\n").some(line=>{
        const server=/^- server "([^"]+)", tool "([^"]+)"/.exec(line);
        if(!server)return false;
        const words=normalize(server[1]).split(/[^a-z0-9]+|mcp/).filter(word=>word.length>=3&&!['server','serveur'].includes(word));
        return words.some(word=>new RegExp(`\\b${word}\\b`).test(text+" "+normalize(task)));
    });
}
module.exports={untestedMcpDenial,capabilityHint,resolveNativeMcp,selectMcpTool};
