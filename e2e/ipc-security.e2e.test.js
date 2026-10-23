"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{_electron}=require("playwright-core");
test("Foreign windows cannot use the native bridge even with the same preload",{timeout:45000},async()=>{
    const root=path.resolve(__dirname,".."),dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-ipc-security-")),harness=path.join(dir,"launch.cjs");fs.writeFileSync(harness,`require(${JSON.stringify(path.join(root,"src/core/session"))}).bootstrap=async()=>({ok:true});require(${JSON.stringify(path.join(root,"desktop/main.js"))});`);
    const env={...process.env,FS_DATA_DIR:dir,FS_STATE_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
    const app=await _electron.launch({executablePath:require("electron"),args:[harness,"--user-data-dir="+path.join(dir,"electron")],cwd:root,env});
    try{
        const page=await app.firstWindow();assert.equal(typeof(await page.evaluate(()=>window.frst.status())).booted,"boolean");
        await page.evaluate(()=>window.frst.copyText("FranceStudent — presse-papiers"));
        assert.equal(await app.evaluate(async({clipboard})=>await clipboard.readText()),"FranceStudent — presse-papiers");
        const result=await app.evaluate(async({BrowserWindow},preload)=>{const foreign=new BrowserWindow({show:false,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false}});try{await foreign.loadURL("data:text/html,<h1>Untrusted window</h1>");return await foreign.webContents.executeJavaScript("window.frst.status().then(()=> 'ALLOWED',error=>error.message)");}finally{foreign.destroy();}},path.join(root,"desktop/preload.js"));
        assert.match(result,/non autorisée/);
    }finally{await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
