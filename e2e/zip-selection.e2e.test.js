"use strict";
/* global addAttachments, pendingAttachments, renderAttachments */
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{_electron}=require("playwright-core");
test("ZIP picker inventories locally, filters files and preserves only the explicit selection",{timeout:45000},async()=>{
    const root=path.resolve(__dirname,".."),dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-zip-picker-")),harness=path.join(dir,"launch.cjs");
    const modulePath=name=>JSON.stringify(path.join(root,name));
    fs.writeFileSync(harness,`require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});require(${modulePath("desktop/main.js")});`);
    const env={...process.env,FS_DATA_DIR:dir,FS_STATE_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
    const app=await _electron.launch({executablePath:require("electron"),args:[harness,"--user-data-dir="+path.join(dir,"electron")],env,cwd:root});
    try{
        const page=await app.firstWindow();
        if(process.platform==="darwin")await page.locator("#mac-beta-notice").getByRole("button",{name:"Continuer",exact:true}).click();
        await page.locator("#startup-loading").waitFor({state:"hidden"});
        if(await page.locator("#guide-close").isVisible())await page.locator("#guide-close").click();
        const bytes=Buffer.from(require("fflate").zipSync({"src/app.js":Buffer.from("useful code"),"private.txt":Buffer.from("private contents")}));
        const attachment={name:"project.zip",kind:"file",data:`data:application/zip;base64,${bytes.toString("base64")}`,size:bytes.length};
        assert.equal(await page.locator("#set-local-attachments-experimental").count(),0);
        await page.evaluate(item=>{
            const bytes=Uint8Array.from(atob(item.data.split(",")[1]),char=>char.charCodeAt(0));
            globalThis.zipAdding=addAttachments([new File([bytes],item.name,{type:"application/zip"})]);
        },attachment);
        const dialog=page.locator("#zip-selection-dialog");await dialog.waitFor();
        assert.equal(await dialog.getByRole("button",{name:"Joindre la sélection"}).isDisabled(),true);
        await dialog.getByRole("searchbox").fill("app.js");
        assert.equal(await dialog.getByRole("checkbox").count(),1);
        await dialog.getByRole("checkbox").check();
        await page.screenshot({path:path.join(root,"release/zip-selection-v1.4.2.png")});
        await dialog.getByRole("button",{name:"Joindre la sélection"}).click();
        await page.evaluate(()=>globalThis.zipAdding);
        const selected=await page.evaluate(()=>pendingAttachments[0]);
        assert.deepEqual(selected.selectedPaths,["src/app.js"]);
        await app.evaluate(()=>{process.mainModule.require(process.cwd()+"/desktop/zip-selection").preview=async()=>{throw Error("Local inventory unavailable");};});
        await page.evaluate(async item=>{
            pendingAttachments.splice(0);renderAttachments();
            const bytes=Uint8Array.from(atob(item.data.split(",")[1]),char=>char.charCodeAt(0));
            await addAttachments([new File([bytes],"fallback.zip",{type:"application/zip"})]);
        },attachment);
        assert.equal(await page.locator("#zip-selection-dialog").count(),0);
        assert.equal(await page.evaluate(()=>pendingAttachments[0].classicPreparation),true);
        assert.equal((await page.evaluate(()=>window.frst.status())).busy,false);
    }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
