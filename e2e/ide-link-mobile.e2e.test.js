"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { _electron } = require("playwright-core");

test("IDE Link : rendu mobile et actions de file via serveur simulé", { timeout: 60000 }, async t => {
    const root = path.resolve(__dirname, ".."), dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-link-ui-"));
    const requests = [], state = { history: [{ type: "assistant", text: "Bonjour depuis le PC" }], live: "", pending: [{ id: 7, kind: "confirm", question: "Autoriser cette action ?", options: [] }], queue: { enabled: false, tasks: [] } };
    const server = http.createServer((req, res) => {
        if (req.method === "GET") {
            const files = { "/": ["desktop/ide-link-web/index.html", "text/html"], "/app.js": ["desktop/ide-link-web/app.js", "text/javascript"], "/style.css": ["desktop/ide-link-web/style.css", "text/css"], "/studio.js": ["desktop/renderer/vendor/studio.js", "text/javascript"], "/render.js": ["desktop/renderer/src/01-render.js", "text/javascript"] };
            const file = files[req.url]; if (!file) { res.writeHead(404); return res.end(); }
            res.writeHead(200, { "Content-Type": file[1] }); return res.end(fs.readFileSync(path.join(root, file[0])));
        }
        let body = ""; req.on("data", chunk => body += chunk); req.on("end", () => {
            requests.push({ route: req.url, authorization: req.headers.authorization, body: JSON.parse(body || "{}") });
            if (req.url === "/api/pair" && JSON.parse(body || "{}").pin !== "123456") { res.writeHead(401, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Code incorrect" })); }
            if (req.url !== "/api/pair" && req.headers.authorization !== "Bearer secret-test") { res.writeHead(401, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ error: "Accès non autorisé" })); }
            if (req.url === "/api/prompt") state.pending = state.pending.filter(item => item.id !== JSON.parse(body).id);
            if (req.url === "/api/tasks") state.queue.tasks.push({ id: "1", prompt: JSON.parse(body).prompt, status: "pending", message: "" });
            if (req.url === "/api/queue") {
                const data = JSON.parse(body), action = data.action, task = state.queue.tasks.find(t => t.id === data.id);
                if (action === "start") state.queue.enabled = true;
                if (action === "remove") state.queue.tasks = state.queue.tasks.filter(t => t.id !== data.id);
                if (action === "edit") task.prompt = data.prompt;
                if (action === "attach") task.attachments = [...(task.attachments || []), ...data.attachments.map(f => ({ name: f.name }))];
                if (action === "steer") task.status = "steering";
                if (action === "move") { const i = state.queue.tasks.indexOf(task), j = i + (data.direction === "up" ? -1 : 1); if (j >= 0 && j < state.queue.tasks.length) [state.queue.tasks[i], state.queue.tasks[j]] = [state.queue.tasks[j], state.queue.tasks[i]]; }
            }
            res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(req.url === "/api/state" ? state : req.url === "/api/pair" ? { token: "secret-test" } : { ok: true }));
        });
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const harness = path.join(dir, "main.cjs");
    fs.writeFileSync(harness, 'const {app,BrowserWindow}=require("electron");app.whenReady().then(()=>{const win=new BrowserWindow({width:390,height:844,webPreferences:{contextIsolation:true,sandbox:true}});win.loadURL(process.env.TEST_URL);});');
    const env = { ...process.env, TEST_URL: `http://127.0.0.1:${server.address().port}/#secret-test` }; delete env.ELECTRON_RUN_AS_NODE;
    const app = await _electron.launch({ executablePath: require("electron"), args: [harness, "--user-data-dir=" + path.join(dir, "profile")], env, cwd: root });
    try {
        const page = await app.firstWindow();
        await page.locator("#pair-pin").waitFor();
        assert.equal(await page.locator("#form").isVisible(), false);
        assert.equal(requests.some(r => r.route === "/api/state"), false);
        await page.locator("#pair-pin").fill("000000");
        await page.getByRole("button", { name: "Connecter" }).click();
        await page.getByText("Code incorrect").waitFor();
        assert.equal(await page.locator("#form").isVisible(), false);
        await page.locator("#pair-pin").fill("123456");
        await page.getByRole("button", { name: "Connecter" }).click();
        await page.getByText("Bonjour depuis le PC").waitFor();
        state.history.push({ type: "assistant", text: "**Texte important**" }, { type: "user", text: "test" }, { type: "tool", name: "list_directory", arg: "." }, { type: "result", text: "1 élément" }, { type: "warn", text: "Version automatique indisponible" }, { type: "reason", text: "Exécuter les tests" }, { type: "tool", name: "run_command", arg: "npm test" });
        await page.locator('#messages strong').getByText('Texte important').waitFor();
        await page.locator('#messages .entry.user .message-author').getByText('Vous').waitFor();
        await page.locator('#messages .entry.warn').getByText('Version automatique indisponible').waitFor();
        await page.locator('#messages .entry.reason').getByText('Exécuter les tests').waitFor();
        await page.locator('#messages > .entry.tool').getByText('npm test').waitFor();
        const group = page.locator('#messages .tool-group details');
        await group.locator('summary').getByText('1 dossier listé').waitFor();
        assert.equal(await group.evaluate(el => el.open), false);
        await group.locator('summary').click();
        await group.getByText('1 élément').waitFor();
        state.history.push({ type: 'assistant', text: 'Suite' });
        await page.getByText('Suite', { exact: true }).waitFor();
        assert.equal(await group.evaluate(el => el.open), true);
        assert.equal(await page.locator('details[aria-label="File de tâches"]').count(), 0);
        await page.locator(".agent-header").getByText("Agent", { exact: true }).waitFor();
        await page.locator(".agent-navigation").getByText("Conversation").waitFor();
        assert.equal(await page.locator("body").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(24, 24, 24)");
        assert.equal(await page.locator(".composer-box").last().evaluate(el => getComputedStyle(el).backgroundColor), "rgb(42, 42, 42)");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.getByText("Autoriser cette action ?").waitFor();
        await page.getByRole("button", { name: "Refuser" }).click();
        await page.getByText("Autoriser cette action ?").waitFor({ state: "hidden" });
        assert.ok(requests.some(r => r.route === "/api/prompt" && r.body.id === 7 && r.body.answer === "n"));
        state.pending = [{ id: 8, kind: "question", question: "Quel choix ?", options: [{ id: "1", label: "Premier" }, { id: "2", label: "Second" }] }];
        await page.getByText("Quel choix ?").waitFor();
        await page.getByLabel("Second").check();
        await page.getByRole("button", { name: "Répondre" }).click();
        await page.getByText("Quel choix ?").waitFor({ state: "hidden" });
        assert.ok(requests.some(r => r.route === "/api/prompt" && r.body.id === 8 && r.body.answer.selected[0] === "2"));
        await page.locator("#prompt").fill("Créer une page");
        assert.equal(await page.locator("#task-mode").count(), 0);
        await page.locator("#attachments").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("Hello") });
        await page.locator("#attachment-list").getByText("Pièces jointes : note.txt").waitFor();
        await page.getByRole("button", { name: "Envoyer" }).click();
        await page.waitForFunction(() => document.querySelector("#attachment-list").textContent === "");
        assert.equal(await page.getByText("File de tâches").count(), 0);
        const queue = page.locator('#queued-prompts');
        await queue.getByText('Créer une page').waitFor();
        assert.equal(await queue.getByRole('button', { name: 'Orienter' }).isDisabled(), true);
        await queue.getByRole('button', { name: 'Reprendre' }).click();
        await queue.getByText(/En pause/).waitFor({ state: 'hidden' });
        state.queue.tasks.push({ id: '2', prompt: 'Deuxième demande', status: 'pending', attachments: [] });
        state.queue.canSteer = true;
        await queue.getByText('Deuxième demande').waitFor();
        const second = queue.locator('.queue-row[data-id="2"]');
        await second.locator('summary').click();
        await second.getByRole('button', { name: 'Monter' }).click();
        await page.waitForFunction(() => document.querySelector('#queued-prompts .queue-row')?.dataset.id === '2');
        await second.locator('summary').click();
        await second.getByRole('button', { name: 'Modifier' }).click();
        await second.locator('.queue-editor').fill('Demande modifiée');
        await second.getByRole('button', { name: 'Enregistrer' }).click();
        await queue.getByText('Demande modifiée').waitFor();
        await second.locator('summary').click();
        const chooser = page.waitForEvent('filechooser');
        await second.getByRole('button', { name: 'Joindre un fichier' }).click();
        await (await chooser).setFiles({ name: 'ajout.txt', mimeType: 'text/plain', buffer: Buffer.from('ajout') });
        await second.getByText('📎 ajout.txt').waitFor();
        await second.getByRole('button', { name: 'Orienter' }).click();
        await second.getByRole('button', { name: 'Transmise…' }).waitFor();
        await second.getByRole('button', { name: 'Supprimer : Demande modifiée' }).click();
        await queue.getByText('Demande modifiée').waitFor({ state: 'hidden' });
        assert.ok(requests.some(r => r.body.action === 'attach' && r.body.attachments[0].name === 'ajout.txt'));
        assert.ok(requests.some(r => r.body.action === 'move' && r.body.direction === 'up'));
        assert.ok(requests.some(r => r.body.action === 'steer' && r.body.id === '2'));
        await page.getByRole("button", { name: "Stop" }).click();
        await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Connecté'));
        assert.ok(requests.some(r => r.route === "/api/tasks" && r.body.prompt === "Créer une page" && r.body.mode === undefined && r.body.attachments[0].name === "note.txt" && r.body.attachments[0].data === "data:text/plain;base64,SGVsbG8="));
        assert.equal(await page.locator("#attachments").evaluate(el => el.files.length), 0);
        assert.ok(requests.some(r => r.route === "/api/queue" && r.body.action === "interrupt"));
        assert.ok(requests.filter(r => r.route !== "/api/pair").every(r => r.authorization === "Bearer secret-test"));
        assert.equal(new URL(page.url()).hash, "");
        await page.evaluate(() => sessionStorage.removeItem("ide-link-key"));
        await page.reload();
        await page.locator("#pair-pin").fill("123456");
        await page.getByRole("button", { name: "Connecter" }).click();
        await page.locator("#pair-form").waitFor({ state: "hidden" });
        await page.getByText("Bonjour depuis le PC").waitFor();
        assert.ok(requests.some(r => r.route === "/api/pair" && r.body.pin === "123456"));
        assert.equal(await page.evaluate(() => sessionStorage.getItem("ide-link-key")), "secret-test");
    } finally { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
