"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");

test("the agent opens choices/free text and waits; answering or skipping resumes exactly once even in Full access", { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-user-questions-"));
    const modulePath = name => JSON.stringify(path.join(root, name)), harness = path.join(dir, "launch.cjs");
    fs.writeFileSync(harness, `
require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});
require(${modulePath("src/state")}).state.fullAccess=true;
require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});
require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});
require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});
globalThis.questionRequests=[];
require(${modulePath("src/api/api")}).requestModel=async(prompt,options={})=>{
 if(options.fresh)return 'Summary';globalThis.questionRequests.push(prompt);const turn=globalThis.questionRequests.length;
 if(turn===1)return JSON.stringify({type:'tool',name:'ask_user',args:{question:'Quelle couleur préfères-tu ?',options:['Bleu','Rouge']},reason:'Choisir une couleur'});
 if(turn===2){if(!prompt.includes('Bleu'))throw Error('Answer not delivered');return JSON.stringify({type:'question',question:'Quel slogan veux-tu ?'});}
 if(turn===3){if(!prompt.includes('Mon slogan'))throw Error('Free text not delivered');return JSON.stringify({type:'tool',name:'ask_user',args:{question:'Quels formats ?',options:['Portrait','Paysage'],multiple:true},reason:'Choisir les formats'});}
 if(turn===4){if(!prompt.includes('"skipped":true'))throw Error('Skip not delivered');return JSON.stringify({type:'final',message:'Questions prises en compte.',completed:true});}
 throw Error('Unexpected request');
};
require(${modulePath("desktop/main.js")});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, FS_SKILLS_DIR: path.join(dir, "skills") }; delete env.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "electron")], env, cwd: root });
    try {
        const page = await app.firstWindow();
        if (process.platform === "darwin") await page.locator("#mac-beta-notice").getByRole("button", { name: "Continuer", exact: true }).click();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        if (await page.locator("#guide-close").isVisible()) await page.locator("#guide-close").click();
        await page.locator("#input").fill("Prépare les choix pour mon projet"); await page.locator("#btn-send").click();
        const question = page.locator("#prompt-zone .fs-agent-question"), reply = page.locator('[data-question-action="answer"]');
        await question.getByText("Quelle couleur préfères-tu ?", { exact: true }).waitFor();
        assert.equal((await app.evaluate(() => globalThis.questionRequests)).length, 1);
        assert.equal(await reply.isDisabled(), true);
        await question.getByLabel("Bleu", { exact: true }).check(); await reply.click();
        await question.getByText("Quel slogan veux-tu ?", { exact: true }).waitFor();
        await question.locator("textarea").fill("Mon slogan"); await reply.click();
        await question.getByText("Quels formats ?", { exact: true }).waitFor();
        await question.getByLabel("Portrait", { exact: true }).check();
        await question.locator('[data-question-action="skip"]').click();
        await page.waitForFunction(() => document.querySelector("#transcript").textContent.includes("Questions prises en compte."));
        assert.equal((await app.evaluate(() => globalThis.questionRequests)).length, 4);
        assert.match(await page.locator("#transcript").innerText(), /Bleu[\s\S]*Mon slogan[\s\S]*Question passée/);
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
