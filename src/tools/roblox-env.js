"use strict";

/**
 * Outil roblox_env : un seul appel pour savoir si la machine est prête.
 *
 * Vérifie chaque brique (Rojo, Selene, luau-lsp, luau-analyze, Aftman/Wally, Blender) et
 * donne la commande d'installation exacte pour celles qui manquent. Aucun téléchargement,
 * aucune installation automatique : l'utilisateur garde la main.
 *
 * Action « studio » : génère .rojo-connect.json (hôte, port, projet) pour brancher le plugin
 * Rojo de Roblox Studio en un clic, plus que la saisie manuelle.
 */

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");

const { state } = require("../state");
const sandbox = require("./sandbox");
const blender = require("./blender");
const rojo = require("./rojo-server");
const { findRojoProject } = require("./roblox-check");

const TOOLS = [
    { name: "rojo", bin: "rojo", install: "aftman add rojo-rbx/rojo", role: "compile la place .rbxlx et synchronise Studio", required: true },
    { name: "selene", bin: "selene", install: "aftman add Kampfkarren/selene", role: "lint Luau", required: false },
    { name: "luau-lsp", bin: "luau-lsp", install: "aftman add JohnnyMorganz/luau-lsp", role: "autocomplétion et types de l'API Roblox", required: false },
    { name: "luau-analyze", bin: "luau-analyze", install: "aftman add luau-lang/luau", role: "analyse de types en ligne de commande", required: false },
    { name: "aftman", bin: "aftman", install: "https://github.com/aftman/aftman", role: "gestionnaire d'outils Roblox du projet", required: false },
    { name: "wally", bin: "wally", install: "aftman add UpliftGames/wally", role: "dépendances Luau", required: false }
];

function versionOf(output) {
    return /(\d+\.\d+(?:\.\d+)?)/.exec(String(output || ""))?.[1] || null;
}

async function statusOf(workspace, tool) {
    const found = sandbox.findRobloxTool(workspace, tool.bin);
    if (!found) return { name: tool.name, status: "absent", path: null, version: null, install: tool.install, role: tool.role, required: tool.required };
    const res = await sandbox.runProcess(found, ["--version"], { cwd: workspace, timeoutMs: 15000 });
    return {
        name: tool.name,
        status: res.exit_code === 0 ? "ok" : "installe mais --version a echoue",
        path: sandbox.relativeTo(workspace, found) || found,
        version: versionOf(res.output),
        install: tool.install,
        role: tool.role,
        required: tool.required
    };
}

/** Trouve un port libre à partir de 34872 (port par défaut de Rojo). */
async function freePort(start = 34872, attempts = 20) {
    for (let offset = 0; offset < attempts; offset++) {
        const port = start + offset;
        const free = await new Promise(resolve => {
            const server = net.createServer();
            server.once("error", () => resolve(false));
            server.once("listening", () => server.close(() => resolve(true)));
            server.listen(port, "127.0.0.1");
        });
        if (free) return port;
    }
    return null;
}

function writeStudioConnect(workspace, server = null) {
    const project = findRojoProject(workspace);
    if (!project) throw new Error("Aucun *.project.json : ce dossier n'est pas un projet Rojo.");
    const host = server?.host || "127.0.0.1";
    const port = server?.port || 34872;
    const target = path.join(workspace, ".rojo-connect.json");
    const data = {
        project,
        host,
        port,
        command: `rojo serve ${project} --address ${host} --port ${port}`,
        running: Boolean(server?.running),
        steps: [
            "Installe le plugin Rojo depuis l'éditeur de plugins de Roblox Studio (Rojo by rojo-rbx).",
            server?.running
                ? "Le serveur est déjà lancé par FranceStudent Code Roblox."
                : "Lance le serveur depuis l'IDE (outil rojo_serve, action start) ou la commande « command ».",
            `Dans Studio, ouvre le plugin Rojo et clique Connect à l'adresse ${host}:${port}.`
        ]
    };
    fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    return { ...data, file: ".rojo-connect.json" };
}

/**
 * Outils déclarés dans aftman.toml / rokit.toml / wally.toml du projet, quand ces fichiers
 * existent : utilisé seulement pour expliquer un « absent » après une installation.
 */
async function readInstalledManifest(workspace) {
    const declared = [];
    for (const [file, pattern] of [["aftman.toml", /^\s*([A-Za-z0-9_-]+)\s*=/gm], ["rokit.toml", /^\s*([A-Za-z0-9_-]+)\s*=/gm], ["wally.toml", /^\s*([A-Za-z0-9_-]+)\s*=/gm]]) {
        try {
            const text = await fs.promises.readFile(path.join(workspace, file), "utf8");
            for (const match of text.matchAll(pattern)) {
                const name = match[1];
                if (TOOLS.some(tool => tool.bin === name)) declared.push(`${name} (${file})`);
            }
        } catch {
            // fichier absent : rien à signaler
        }
    }
    return [...new Set(declared)];
}

async function runRobloxEnv(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");

    if (args.action === "studio") {
        // Le serveur est lancé ici : plus besoin de copier la commande dans un terminal.
        const started = await rojo.startServer(workspace);
        const result = writeStudioConnect(workspace, started);
        const message = started.error
            ? `Fichier .rojo-connect.json écrit, mais le serveur n'a pas démarré : ${started.error}`
            : `Serveur Rojo démarré sur ${result.host}:${result.port} (${result.project}). Dans Studio : plugin Rojo → Connect → ${result.host}:${result.port}.`;
        return { ...result, server: started, message };
    }
    if (args.action !== "check") throw new Error("action doit valoir check ou studio.");

    const tools = [];
    for (const tool of TOOLS) tools.push(await statusOf(workspace, tool));
    const blenderState = await blender.detectBlender(workspace);
    const project = findRojoProject(workspace);
    const server = rojo.statusOf();
    const port = server.port || await freePort();

    const missing = tools.filter(tool => tool.status !== "ok").map(tool => tool.name);
    const blocking = tools.filter(tool => tool.required && tool.status !== "ok").map(tool => tool.name);

    let message;
    // Les packs Aftman/Rokit ajoutent leurs binaires au PATH au prochain démarrage.
    // Un « absent » après installation n'est donc pas un vrai échec : il faut redémarrer.
    const justInstalled = await readInstalledManifest(workspace);
    if (blocking.length) message = `Roblox incomplet : ${blocking.join(", ")} manquant(s). Installe-les avec Aftman avant de builder.`;
    if (blocking.length && justInstalled.length) message += ` ${justInstalled.join(", ")} vient d'être installé : redémarre FranceStudent Code Roblox pour qu'il soit reconnu.`;
    else if (missing.length) message = `Prêt pour builder. Optionnel absent : ${missing.join(", ")}.`;
    else message = "Environnement Roblox complet (Rojo, Selene, luau-lsp, luau-analyze, Aftman, Wally).";
    message += server.running
        ? server.connected
            ? ` Serveur Rojo actif sur ${server.host}:${server.port}, Studio connecté.`
            : ` Serveur Rojo actif sur ${server.host}:${server.port}, Studio pas encore connecté.`
        : " Serveur Rojo arrêté (outil rojo_serve).";
    message += blenderState.found ? ` ${blenderState.message}` : " Blender introuvable : seule la génération de scripts reste possible.";

    return {
        project,
        rojoProject: project,
        tools,
        missing,
        blocking,
        blender: blenderState,
        studioPort: port,
        rojoServer: server,
        message
    };
}

module.exports = {
    name: "roblox_env",
    run: runRobloxEnv,
    check(args = {}) {
        if (args.action !== undefined && !["check", "studio"].includes(args.action)) {
            throw new Error("action doit valoir check ou studio.");
        }
    },
    describe: (a) => (a.action === "studio" ? "Connexion Roblox Studio" : "Environnement Roblox"),
    runRobloxEnv,
    freePort
};
