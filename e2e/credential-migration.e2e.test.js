"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),{_electron}=require("playwright-core");
test("A legacy profile keeps its connections and preferences across a real Electron restart",{timeout:60000},async t=>{
    const root=path.resolve(__dirname,".."),dir=fs.mkdtempSync(path.join(os.tmpdir(),"frst-migration-")),harness=path.join(dir,"launch.cjs"),cookie="SESSION_DEMO_MIGRATION",token="GITHUB_DEMO_MIGRATION_TOKEN";
    fs.writeFileSync(path.join(dir,"session.json"),JSON.stringify({deviceId:"unchanged-device",cookies:{"next-auth.session-token":cookie},signedOut:false}));
    fs.writeFileSync(path.join(dir,"github.json"),JSON.stringify({login:"demo",token}));
    fs.writeFileSync(path.join(dir,"settings.json"),JSON.stringify({automaticUpdates:false,editorFontSize:15}));
    const history='[{"title":"Conversation à conserver"}]';fs.writeFileSync(path.join(dir,"history.json"),history);
    fs.writeFileSync(harness,`const auth=require(${JSON.stringify(path.join(root,"src/api/auth"))}),github=require(${JSON.stringify(path.join(root,"src/github"))});require(${JSON.stringify(path.join(root,"src/core/session"))}).bootstrap=async()=>{await auth.loadSession();return {ok:auth.auth.jar.has(auth.SESSION_COOKIE)};};require(${JSON.stringify(path.join(root,"src/api/agents"))}).listAgents=async()=>({agents:[{id:-1002,name:'Demo'}],source:'local'});require(${JSON.stringify(path.join(root,"src/api/account"))}).fetchUserUsage=async()=>({chatBudget:{usedPercent:0}});globalThis.migrationState=()=>({cookie:auth.auth.jar.get(auth.SESSION_COOKIE)===${JSON.stringify(cookie)},token:github.getToken()===${JSON.stringify(token)},device:auth.auth.deviceId,secure:require(${JSON.stringify(path.join(root,"src/secret-storage"))}).available()});require(${JSON.stringify(path.join(root,"desktop/main.js"))});`);
    const env={...process.env,FS_DATA_DIR:dir,FS_STATE_DIR:dir};delete env.ELECTRON_RUN_AS_NODE;
    const launch=()=>_electron.launch({executablePath:require("electron"),args:[harness,"--user-data-dir="+path.join(dir,"electron")],env,cwd:root});
    let app;
    try{
        app=await launch();let page=await app.firstWindow();await page.evaluate(()=>window.frst.bootstrap());await page.waitForFunction(async()=>(await window.frst.status()).booted);
        const first=await app.evaluate(()=>globalThis.migrationState());assert.equal(first.cookie,true,JSON.stringify(first));assert.equal(first.token,true,JSON.stringify(first));assert.equal(first.device,"unchanged-device");
        assert.ok(!fs.readFileSync(path.join(dir,"session.json"),"utf8").includes(cookie));assert.ok(!fs.readFileSync(path.join(dir,"github.json"),"utf8").includes(token));
        if(!first.secure){t.skip("Le runner ne fournit pas de coffre système : fonctionnement temporaire vérifié, persistance non disponible.");return;}
        await app.close();app=await launch();page=await app.firstWindow();await page.evaluate(()=>window.frst.bootstrap());await page.waitForFunction(async()=>(await window.frst.status()).booted);
        const restored=await app.evaluate(()=>globalThis.migrationState());assert.equal(restored.cookie,true);assert.equal(restored.token,true);assert.equal(restored.device,"unchanged-device");
        const settings=JSON.parse(fs.readFileSync(path.join(dir,"settings.json")));assert.equal(settings.automaticUpdates,false);assert.equal(settings.editorFontSize,15);assert.equal(fs.readFileSync(path.join(dir,"history.json"),"utf8"),history);
    }finally{if(app)await app.close();fs.rmSync(dir,{recursive:true,force:true});}
});
