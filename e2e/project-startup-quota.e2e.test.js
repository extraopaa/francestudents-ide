"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{_electron}=require("playwright-core");
test("opening a project stays local; explicit indexing reports quota failures clearly",{timeout:45000},async()=>{
    const root=path.resolve(__dirname,".."),dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-project-quota-")),workspace=path.join(dir,"project"),harness=path.join(dir,"launch.cjs");
    fs.mkdirSync(workspace);fs.writeFileSync(path.join(workspace,"app.js"),"console.log('local context');");
    const mod=name=>JSON.stringify(path.join(root,name)),resetAt=new Date(Date.now()+3*3600000).toISOString();
    fs.writeFileSync(harness,`require(${mod("src/core/session")}).bootstrap=async()=>({ok:true});require(${mod("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});require(${mod("src/api/account")}).fetchUserUsage=async()=>({chatBudget:{usedPercent:100,resetAt:${JSON.stringify(resetAt)}}});globalThis.summaryCalls=0;require(${mod("src/api/api")}).requestModel=async()=>{globalThis.summaryCalls++;throw Error('HTTP 429: Chat budget exhausted. Reset at '+${JSON.stringify(resetAt)});};require(${mod("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});require(${mod("desktop/main.js")});`);
    const env={...process.env,FS_DATA_DIR:dir,FS_STATE_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
    const app=await _electron.launch({executablePath:require("electron"),args:[harness,"--user-data-dir="+path.join(dir,"electron")],env,cwd:root});
    try{
        const page=await app.firstWindow();
        if(process.platform==="darwin")await page.locator("#mac-beta-notice").getByRole("button",{name:"Continuer",exact:true}).click();
        await page.locator("#startup-loading").waitFor({state:"hidden"});
        if(await page.locator("#guide-close").isVisible())await page.locator("#guide-close").click();
        await page.evaluate(dir=>window.frst.openProject(dir),workspace);
        assert.equal(await app.evaluate(()=>globalThis.summaryCalls),0);
        fs.writeFileSync(path.join(workspace,"app.js"),"console.log('changed locally');");
        await page.evaluate(dir=>window.frst.openProject(dir),workspace);
        assert.equal(await app.evaluate(()=>globalThis.summaryCalls),0);
        await page.evaluate(()=>window.frst.submit("/index"));
        assert.equal(await app.evaluate(()=>globalThis.summaryCalls),1);
        const card=page.locator(".budget-notice").last();await card.waitFor();
        assert.match(await card.innerText(),/Budget de chat épuisé/);
        assert.match(await card.locator(".budget-context").innerText(),/contexte local partiel/);
        assert.equal(await card.getByRole("button",{name:"J’ai reçu un reset"}).count(),1);
        assert.equal(await card.locator("details").getAttribute("open"),null);
        assert.doesNotMatch(await card.innerText(),/HTTP 429/);
        await page.screenshot({path:path.join(root,`release/startup-quota-v${require("../package.json").version}.png`)});
    }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
