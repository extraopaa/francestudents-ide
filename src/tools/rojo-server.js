"use strict";

/**
 * Serveur Rojo géré par l'IDE.
 *
 * Lance `rojo serve` sur le projet ouvert, réserve un port réellement libre, lit la sortie
 * du serveur pour savoir si Roblox Studio est connecté, et arrête proprement le processus.
 * Aucun téléchargement : si `rojo` est absent, le statut le dit sans prétendre à un succès.
 *
 * Un seul serveur à la fois : un nouveau `start` remplace l'ancien projet.
 */

const { spawn } = require("node:child_process");
const net = require("node:net");

const sandbox = require("../tools/sandbox");
const { findRojoProject } = require("../tools/roblox-check");

const DEFAULT_PORT = 34872;
const MAX_PORT_ATTEMPTS = 20;
const MAX_LOG_LINES = 200;

let current = null;

/** Trouve un port libre à partir de 34872 (port par défaut de Rojo). */
function freePort(start = DEFAULT_PORT, attempts = MAX_PORT_ATTEMPTS) {
    return new Promise(resolve => {
        let offset = 0;
        const tryNext = () => {
            if (offset >= attempts) return resolve(null);
            const port = start + offset++;
            const server = net.createServer();
            server.once("error", () => tryNext());
            server.once("listening", () => server.close(() => resolve(port)));
            server.listen(port, "127.0.0.1");
        };
        tryNext();
    });
}

/** Lit une ligne de sortie de `rojo serve` et met à jour l'état de connexion. */
function readLine(entry, raw) {
    const line = sandbox.stripAnsi(raw).trim();
    if (!line) return;
    entry.log.push({ at: Date.now(), line: line.slice(0, 500) });
    if (entry.log.length > MAX_LOG_LINES) entry.log.shift();
    if (/connected|client connected|studio connected/i.test(line)) {
        entry.clients += 1;
        entry.connected = true;
    }
    if (/disconnected|client disconnected/i.test(line)) {
        entry.clients = Math.max(0, entry.clients - 1);
        entry.connected = entry.clients > 0;
    }
    if (/error|failed|could not|introuvable/i.test(line)) entry.lastError = line.slice(0, 300);
}

function stopServer(entry = current) {
    if (!entry) return null;
    current = null;
    entry.status = "stopped";
    entry.connected = false;
    entry.clients = 0;
    if (entry.child && !entry.child.killed) {
        try { entry.child.kill(); } catch { /* déjà terminé */ }
    }
    return entry.summary();
}

function statusOf() {
    return current ? current.summary() : {
        running: false,
        connected: false,
        project: null,
        host: null,
        port: null,
        url: null,
        clients: 0,
        uptime_ms: 0,
        last_error: null
    };
}

/**
 * Démarre `rojo serve` sur le projet du dossier.
 * Renvoie { running, connected, project, host, port, url, … } ou { running:false, error }.
 */
async function startServer(workspace, options = {}) {
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    const project = options.project || findRojoProject(workspace);
    if (!project) throw new Error("Aucun *.project.json : ce dossier n'est pas un projet Rojo.");

    const rojo = sandbox.findRobloxTool(workspace, "rojo");
    if (!rojo) {
        return {
            running: false,
            connected: false,
            project,
            error: "rojo absent : installe-le avec « aftman add rojo-rbx/rojo ».",
            install: "aftman add rojo-rbx/rojo"
        };
    }

    if (current && current.workspace === workspace && current.project === project && current.status === "running") {
        return current.summary();
    }
    if (current) stopServer();

    const port = await freePort(options.port || DEFAULT_PORT);
    if (!port) throw new Error("Aucun port libre entre 34872 et 34891 : ferme l'instance Rojo déjà ouverte.");

    const host = "127.0.0.1";
    const child = spawn(rojo, ["serve", project, "--address", host, "--port", String(port)], {
        cwd: workspace,
        windowsHide: true,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }
    });

    const entry = {
        child,
        workspace,
        project,
        host,
        port,
        status: "starting",
        connected: false,
        clients: 0,
        lastError: null,
        startedAt: Date.now(),
        log: [],
        summary() {
            return {
                running: this.status === "running",
                status: this.status,
                connected: this.connected,
                project: this.project,
                host: this.host,
                port: this.port,
                url: `rojo://${this.host}:${this.port}`,
                clients: this.clients,
                uptime_ms: Date.now() - this.startedAt,
                last_error: this.lastError,
                log: this.log.slice(-40)
            };
        }
    };
    current = entry;

    let pending = "";
    const onData = chunk => {
        const text = String(chunk);
        pending += text;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) readLine(entry, line);
        if (entry.status === "starting" && /serving|listening|server started/i.test(text)) entry.status = "running";
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.once("error", error => {
        entry.status = "failed";
        entry.lastError = error.message;
    });
    child.once("exit", code => {
        entry.status = entry.status === "failed" ? "failed" : "stopped";
        entry.connected = false;
        entry.clients = 0;
        if (code && code !== 0) entry.lastError = entry.lastError || `rojo serve s'est arrêté (code ${code}).`;
    });

    // Rojo met quelques centaines de millisecondes à ouvrir son socket.
    const deadline = Date.now() + 4000;
    while (entry.status === "starting" && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (entry.status === "starting") {
            const listening = await probe(host, port);
            if (listening) entry.status = "running";
        }
    }
    if (entry.status === "starting") entry.status = "running";
    return entry.summary();
}

/** Vérifie qu'un serveur écoute sur host:port. */
function probe(host, port, timeoutMs = 300) {
    return new Promise(resolve => {
        const socket = net.connect({ host, port });
        const done = value => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(value);
        };
        socket.setTimeout(timeoutMs);
        socket.once("connect", () => done(true));
        socket.once("error", () => done(false));
        socket.once("timeout", () => done(false));
    });
}

function studioConnectInfo(workspace) {
    const status = statusOf();
    const project = findRojoProject(workspace);
    return {
        project,
        host: status.host || "127.0.0.1",
        port: status.port || DEFAULT_PORT,
        command: `rojo serve ${project || "default.project.json"} --address ${status.host || "127.0.0.1"} --port ${status.port || DEFAULT_PORT}`,
        running: status.running,
        connected: status.connected
    };
}

module.exports = { startServer, stopServer, statusOf, freePort, studioConnectInfo, probe };
