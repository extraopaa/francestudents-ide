"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");

test("IDE Link est accessible près du bouton Accès et demande confirmation", { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-link-desktop-")), project = path.join(dir, "project");
    fs.mkdirSync(project);
    const modulePath = name => JSON.stringify(path.join(root, name)), harness = path.join(dir, "launch.cjs");
    fs.writeFileSync(harness, `
require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});
require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1003,name:'GPT-6.1 Sol',model:'gpt-6.1-sol'}],source:'api'});
require(${modulePath("src/state")}).state.model=-1003;
require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});
require(${modulePath("src/api/account")}).fetchChatUsage=async()=>({});
require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});
require(${modulePath("desktop/ide-link")}).createIdeLink = ({onChange}) => { let state = 'stopped'; const status = () => state === 'running' ? {state, url:'https://example.trycloudflare.com/#secret', address:'https://example.trycloudflare.com', pin:'012345'} : {state, url:'', address:'', pin:''}; return {status, record(){}, async start(){state='running';onChange(status());}, async stop(){state='stopped';onChange(status());}}; };
require(${modulePath("desktop/main.js")});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, FS_SKILLS_DIR: path.join(dir, "skills") }; delete env.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "electron")], env, cwd: root });
    try {
        const page = await app.firstWindow();
        if (process.platform === "darwin") await page.locator("#mac-beta-notice").getByRole("button", { name: "Continuer", exact: true }).click();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        if (await page.locator("#guide-close").isVisible()) await page.locator("#guide-close").click();
        await page.evaluate(project => window.frst.openProject(project), project);
        assert.equal(await page.locator("#chat-access-button + #chat-ide-link-button").count(), 1);
        assert.equal(await page.locator(".settings-card #ide-link-start").count(), 0);
        await page.locator("#chat-ide-link-button").click();
        await page.locator("#ide-link-start").waitFor({ state: "visible" });
        await page.locator("#ide-link-start").click();
        assert.match(await page.locator("#studio-confirm-message").innerText(), /Toute personne possédant le lien/);
        await page.locator('[data-confirm="cancel"]').click();
        assert.equal((await page.evaluate(() => window.frst.ideLink("status"))).state, "stopped");
        await page.locator("#chat-ide-link-button").click();
        await page.locator("#ide-link-start").click();
        await page.locator('[data-confirm="accept"]').click();
        await page.locator("#ide-link-details").waitFor({ state: "visible" });
        assert.equal(await page.locator("#ide-link-pin span").count(), 6);
        assert.equal(await page.locator("#ide-link-pin").textContent(), "012345");
        assert.equal(await page.locator("#ide-link-address").inputValue(), "https://example.trycloudflare.com");
        assert.match(await page.locator("#ide-link-qr").getAttribute("src"), /^data:image\/png/);
        await page.locator("#ide-link-stop").click();
        await page.locator("#ide-link-details").waitFor({ state: "hidden" });
        await page.locator("#ide-link-close").click();
        await page.waitForFunction(() => document.querySelector("#chat-ide-link-button").getAttribute("aria-expanded") === "false");
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
});
