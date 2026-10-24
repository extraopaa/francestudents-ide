"use strict";
async function preview(file){
    const data=String(file?.data||"");
    if(data.length>35*1024*1024)throw new Error("ZIP trop volumineux (25 Mo maximum).");
    const match=/^data:[^,]*;base64,([A-Za-z0-9+/=\s]+)$/.exec(data);
    if(!match)throw new Error("ZIP joint invalide.");
    const bytes=Buffer.from(match[1],"base64");
    if(bytes.length>25*1024*1024)throw new Error("ZIP trop volumineux (25 Mo maximum).");
    const entries=await require("../src/api/archive-input").readZip(bytes,{contents:false,allowPartial:true});
    return entries.filter(entry=>!entry.directory).map(({name,size,error})=>({name,size,error}));
}
module.exports={preview};
