"use strict";
const {pathToFileURL}=require("node:url");
function isTrustedIpcSender(event,window,indexFile){
    if(!window||window.isDestroyed()||event.sender!==window.webContents)return false;
    const frame=event.senderFrame;
    if(!frame||frame!==window.webContents.mainFrame)return false;
    try{
        const url=new URL(frame.url),expected=new URL(pathToFileURL(indexFile));
        // Only the bundled main document gets native privileges. An iframe,
        // preview page or another WebContents must never reach these handlers.
        return url.protocol==="file:"&&url.origin===expected.origin&&url.host===expected.host&&url.pathname===expected.pathname&&!url.search;
    }catch{return false;}
}
module.exports={isTrustedIpcSender};
