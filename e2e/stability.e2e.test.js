"use strict";
/* global liveStart, liveAppend, liveEnd */
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");

test("Windows terminal errors stay contained; an abrupt exit shows a copyable diagnostic once after restart", { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-stability-e2e-"));
    const project = path.join(dir, "project"); fs.mkdirSync(project);
    const harness = path.join(dir, "launch.cjs"), version = require("../package.json").version;
    const modulePath = relative => JSON.stringify(path.join(root, relative));
    fs.writeFileSync(harness, `
require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});
require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});
require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});
require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(version)},automaticUpdates:false});
const pty=require(${modulePath("node_modules/node-pty")}),spawn=pty.spawn;
globalThis.stabilityTestPtys=[];
pty.spawn=(...args)=>{const terminal=spawn(...args);globalThis.stabilityTestPtys.push(terminal);return terminal;};
require(${modulePath("desktop/main.js")});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir, FS_SKILLS_DIR: path.join(dir, "skills") }; delete env.ELECTRON_RUN_AS_NODE;
    const launch = () => _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "electron")], env, cwd: root });
    let app;
    async function ready() {
        const page = await app.firstWindow();
        if (process.platform === "darwin") await page.locator("#mac-beta-notice").getByRole("button", { name: "Continuer", exact: true }).click();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        return page;
    }
    try {
        app = await launch(); let page = await ready();
        await page.evaluate(project => window.frst.openProject(project), project);
        const terminal = await page.evaluate(() => window.frst.ptyCreate(".", 80, 24));
        await page.evaluate(id => {
            globalThis.stabilityExpectedExit = new Promise(resolve => {
                const off = window.frst.onEvent((name, data) => { if (name === "ptyExit" && data.id === id) { off(); resolve(data); } });
            });
        }, terminal.id);
        await app.evaluate((_electron, pid) => globalThis.stabilityTestPtys.find(terminal => terminal.pid === pid).emit("error", Object.assign(new Error("SIMULATED_TRANSPORT_FAILURE"), { code: "ECONNRESET" })), terminal.pid);
        assert.equal((await page.evaluate(() => globalThis.stabilityExpectedExit)).errorCode, "FST-301");
        assert.equal(await page.evaluate(id => window.frst.ptyWrite(id, ""), terminal.id), false);
        assert.equal(await page.evaluate(() => window.frst.stability()), null);
        const exited = new Promise(resolve => app.process().once("exit", resolve));
        await app.evaluate(({ app }) => app.exit(77)).catch(() => {});
        // ConPTY teardown during app.exit can report a Windows fast-fail code
        // instead of 77. Both are abrupt, non-clean exits for recovery purposes.
        assert.notEqual(await exited, 0); app = null;

        app = await launch(); page = await ready();
        await page.locator("#stability-notice[open]").waitFor();
        assert.match(await page.locator("#stability-notice").innerText(), /FST-001/);
        await page.locator("#stability-copy").click();
        await page.getByRole("button", { name: "Diagnostic copié" }).waitFor();
        assert.match(await app.evaluate(async ({ clipboard }) => clipboard.readText()), /Code : FST-001/);
        await page.screenshot({ path: path.join(root, "release/stability-notice.png") });
        await page.locator("#stability-acknowledge").click();
        await page.waitForFunction(async () => await window.frst.stability() === null);
        const complete = await page.evaluate(() => {
            const text = "Longue réponse <sans exécution>\n".repeat(5000);
            liveStart(); for (let i = 0; i < text.length; i += 80) liveAppend(text.slice(i, i + 80)); liveEnd();
            return document.querySelector("#transcript .assistant:last-child").textContent === text;
        });
        assert.equal(complete, true);
        await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); });
        await app.evaluate(async ({ BrowserWindow }) => {
            const contents = BrowserWindow.getAllWindows()[0].webContents;
            contents.forcefullyCrashRenderer();
            const start = Date.now();
            while (Date.now() - start < 20000) {
                try { if (await contents.executeJavaScript("!!document.querySelector('#stability-notice[open]')")) return; } catch { /* Renderer is being restarted. */ }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error("The renderer did not recover after the simulated crash");
        });
        // The old DevTools Page remains marked crashed. Inspect the recovered
        // document through Electron, including the real preload/IPC acknowledgement.
        const recovered = await app.evaluate(async ({ BrowserWindow }) => {
            const contents = BrowserWindow.getAllWindows()[0].webContents;
            const text = await contents.executeJavaScript("document.querySelector('#stability-notice').innerText");
            await contents.executeJavaScript("document.querySelector('#stability-acknowledge').click()");
            for (let i = 0; i < 100; i++) {
                if (await contents.executeJavaScript("window.frst.stability()") === null) return text;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error("Recovered diagnostic was not acknowledged");
        });
        assert.match(recovered, /FST-101/);
        await app.close(); app = null;
        app = await launch(); page = await ready();
        assert.equal(await page.evaluate(() => window.frst.stability()), null);
        assert.equal(await page.locator("#stability-notice").count(), 0);
    } finally {
        if (app) await app.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});
