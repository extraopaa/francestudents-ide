"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const secrets=require("../src/secret-storage"),{CONFIG}=require("../src/config");
function vault(){
    const key=crypto.randomBytes(32);
    return {isEncryptionAvailable:()=>true,encryptString:value=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key,iv);return Buffer.concat([iv,cipher.update(value,"utf8"),cipher.final(),cipher.getAuthTag()]);},decryptString:bytes=>{const decipher=crypto.createDecipheriv("aes-256-gcm",key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(-16));return Buffer.concat([decipher.update(bytes.subarray(12,-16)),decipher.final()]).toString("utf8");}};
}
test("OS vault refuses plaintext backends, corrupt ciphertext and unavailable keys",()=>{
    const safe=vault(),store=secrets.createSecretStorage({platform:"darwin",safeStorage:safe});
    const encrypted=store.protect("IDENTIFIANT_DEMO_été");assert.doesNotMatch(JSON.stringify(encrypted),/IDENTIFIANT/);
    assert.equal(store.unprotect(encrypted),"IDENTIFIANT_DEMO_été");
    const cold=secrets.createSecretStorage({platform:"darwin",safeStorage:safe});assert.equal(cold.unprotect(encrypted),"IDENTIFIANT_DEMO_été");
    assert.equal(cold.unprotect({...encrypted,data:"invalid"}),null);
    assert.equal(secrets.createSecretStorage({platform:"linux",safeStorage:{...safe,getSelectedStorageBackend:()=>"basic_text"}}).protect("DO_NOT_SAVE"),null);
    assert.equal(secrets.createSecretStorage({platform:"darwin"}).protect("DO_NOT_SAVE"),null);
    assert.throws(()=>secrets.createSecretStorage({platform:"darwin",safeStorage:{...safe,encryptString:()=>{throw Error("SECRET_DETAIL");}}}).protect("SECRET_DETAIL"),error=>!error.message.includes("SECRET_DETAIL"));
});
test("GitHub legacy migration preserves login and token across reload without plaintext",()=>{
    secrets.configure({platform:"darwin",safeStorage:vault()});
    const github=require("../src/github"),token="DEMO_TOKEN_NOT_A_REAL_CREDENTIAL";
    fs.mkdirSync(CONFIG.dataDir,{recursive:true});fs.writeFileSync(github.file(),JSON.stringify({token,login:"demo",scopes:["repo"]}));
    assert.equal(github.getToken(),token);const stored=fs.readFileSync(github.file(),"utf8");assert.ok(!stored.includes(token));assert.equal(JSON.parse(stored).token,undefined);
    delete require.cache[require.resolve("../src/github")];const restarted=require("../src/github");assert.equal(restarted.getToken(),token);assert.equal(restarted.loadAuth().login,"demo");restarted.clearAuth();
});
test("FranceStudent legacy migration keeps cookies, device, preferences and histories",async()=>{
    secrets.configure({platform:"darwin",safeStorage:vault()});
    const cookie="DEMO_SESSION_NOT_A_REAL_CREDENTIAL",file=path.join(CONFIG.dataDir,"session.json");
    const preserved={"settings.json":'{"automaticUpdates":false}',"history.json":'[{"title":"Projet existant"}]',"projects.json":'["aurora"]'};
    for(const [name,data] of Object.entries(preserved))fs.writeFileSync(path.join(CONFIG.dataDir,name),data);
    fs.writeFileSync(file,JSON.stringify({deviceId:"existing-device",signedOut:false,cookies:{"next-auth.session-token":cookie}}));
    delete require.cache[require.resolve("../src/api/auth")];const auth=require("../src/api/auth");await auth.loadSession();assert.equal(auth.auth.jar.get(auth.SESSION_COOKIE),cookie);assert.equal(auth.auth.deviceId,"existing-device");
    assert.ok(!fs.readFileSync(file,"utf8").includes(cookie));assert.ok(JSON.parse(fs.readFileSync(file)).protectedCookies);
    delete require.cache[require.resolve("../src/api/auth")];const restarted=require("../src/api/auth");await restarted.loadSession();assert.equal(restarted.auth.jar.get(restarted.SESSION_COOKIE),cookie);assert.equal(restarted.auth.deviceId,"existing-device");
    for(const [name,data] of Object.entries(preserved))assert.equal(fs.readFileSync(path.join(CONFIG.dataDir,name),"utf8"),data);
});
test("Without OS vault GitHub credentials remain in memory and never appear on disk",()=>{
    secrets.configure({platform:"darwin"});const github=require("../src/github"),token="DEMO_SESSION_ONLY_TOKEN";github.saveAuth({token,login:"demo"});assert.equal(github.getToken(),token);assert.ok(!fs.readFileSync(github.file(),"utf8").includes(token));github.clearAuth();
});
test("Windows DPAPI round trip works with Unicode and after a cold start",{skip:process.platform!=="win32"},()=>{
    const first=secrets.createSecretStorage(),value="SESSION_DEMO_été_你好",encrypted=first.protect(value);
    assert.equal(encrypted.backend,"windows-dpapi");assert.ok(!encrypted.data.includes(value));assert.equal(secrets.createSecretStorage().unprotect(encrypted),value);
});
test("A temporarily locked vault preserves the current login and strips legacy plaintext",async()=>{
    const safe=vault();safe.encryptString=()=>{throw Error("VAULT_LOCKED_DETAIL");};secrets.configure({platform:"darwin",safeStorage:safe});
    const github=require("../src/github"),token="DEMO_LOCKED_VAULT_TOKEN";fs.writeFileSync(github.file(),JSON.stringify({login:"demo",token}));
    assert.equal(github.getToken(),token);assert.ok(!fs.readFileSync(github.file(),"utf8").includes(token));
    const file=path.join(CONFIG.dataDir,"session.json"),cookie="DEMO_LOCKED_VAULT_COOKIE";
    fs.writeFileSync(file,JSON.stringify({deviceId:"same-device",cookies:{"next-auth.session-token":cookie}}));
    delete require.cache[require.resolve("../src/api/auth")];const auth=require("../src/api/auth");await auth.loadSession();
    assert.equal(auth.auth.jar.get(auth.SESSION_COOKIE),cookie);assert.equal(auth.auth.sessionOnly,true);assert.ok(!fs.readFileSync(file,"utf8").includes(cookie));github.clearAuth();
});
