"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),path=require("node:path"),{pathToFileURL}=require("node:url");
const {isTrustedIpcSender}=require("../desktop/ipc-security");
test("Native IPC accepts only the bundled main frame in the expected window",()=>{
    const file=path.resolve("desktop/renderer/index.html"),frame={url:pathToFileURL(file).href},webContents={mainFrame:frame},window={webContents,isDestroyed:()=>false};
    assert.equal(isTrustedIpcSender({sender:webContents,senderFrame:frame},window,file),true);
    assert.equal(isTrustedIpcSender({sender:webContents,senderFrame:{url:frame.url}},window,file),false);
    assert.equal(isTrustedIpcSender({sender:{mainFrame:frame},senderFrame:frame},window,file),false);
    for(const url of ["https://example.com","http://127.0.0.1:8091",pathToFileURL(file+".evil").href,frame.url+"?untrusted=1","invalid"]){const original=frame.url;frame.url=url;assert.equal(isTrustedIpcSender({sender:webContents,senderFrame:frame},window,file),false);frame.url=original;}
    assert.equal(isTrustedIpcSender({sender:webContents,senderFrame:frame},{...window,isDestroyed:()=>true},file),false);
});
