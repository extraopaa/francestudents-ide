"use strict";
/* global renderEntry, renderAgentActivity, renderWorkPlan */
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), os = require("node:os"), { _electron } = require("playwright-core");
test("one work-plan card updates without duplicate transcript plans, preserves folding and clears for a new chat", { timeout: 45000 }, async () => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-work-plan-")), harness = path.join(dir, "launch.cjs");
    const modulePath = name => JSON.stringify(path.join(root, name));
    fs.writeFileSync(harness, `require(${modulePath("src/core/session")}).bootstrap=async()=>({ok:true});require(${modulePath("src/api/agents")}).listAgents=async()=>({agents:[{id:-1002,name:'Test model'}],source:'local'});require(${modulePath("src/api/account")}).fetchUserUsage=async()=>({});require(${modulePath("src/settings")}).save({releaseHighlightsSeen:${JSON.stringify(require("../package.json").version)},automaticUpdates:false});require(${modulePath("desktop/main.js")});`);
    const env = { ...process.env, FS_DATA_DIR: dir, FS_STATE_DIR: dir }; delete env.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "electron")], env, cwd: root });
    try {
        const page = await app.firstWindow();
        if (process.platform === "darwin") await page.locator("#mac-beta-notice").getByRole("button", { name: "Continuer", exact: true }).click();
        await page.locator("#startup-loading").waitFor({ state: "hidden" });
        if (await page.locator("#guide-close").isVisible()) await page.locator("#guide-close").click();
        await page.evaluate(() => {
            renderEntry({ type: "plan", items: ["✓ Lire les sources", "◉ Corriger le rendu", "○ Vérifier le résultat"] });
            renderAgentActivity({ workspace: null, motionDesign: false, status: "running", prompt: "Réparer le rendu", startedAt: Date.now(), steps: [
                { step: "Lire les sources", status: "completed" }, { step: "Corriger le rendu", status: "in_progress" }, { step: "Vérifier le résultat", status: "pending" }
            ] });
        });
        assert.equal(await page.locator("#agent-live-plan details").count(), 1);
        assert.equal(await page.locator("#transcript .entry.plan").count(), 0);
        assert.equal(await page.getByText("Corriger le rendu", { exact: true }).count(), 1);
        assert.equal(await page.locator("#agent-live-plan progress").getAttribute("value"), "1");
        await page.locator("#agent-live-plan summary").click();
        await page.evaluate(() => renderEntry({ type: "plan", items: ["✓ Lire les sources", "✓ Corriger le rendu", "◉ Vérifier le résultat"] }));
        assert.equal(await page.locator("#agent-live-plan details").getAttribute("open"), null);
        await page.locator("#agent-live-plan summary").click();
        assert.equal(await page.locator('#agent-live-plan li[aria-current="step"] .work-plan-step-text').innerText(), "Vérifier le résultat");
        await page.evaluate(() => renderWorkPlan([{ step: "Étape non vérifiée", status: "pending" }], { status: "done" }));
        assert.equal(await page.locator(".work-plan-state").innerText(), "À poursuivre");
        await page.evaluate(() => renderWorkPlan([]));
        assert.equal(await page.locator("#agent-live-plan").isVisible(), false);
        await page.evaluate(() => renderEntry({ type: "plan", replayed: true, items: ["✓ Ancienne étape", "○ Suite"] }));
        assert.equal(await page.locator("#agent-live-plan details").getAttribute("open"), null);
        assert.equal(await page.locator("#transcript .entry.plan").count(), 0);
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
