"use strict";

/**
 * Graphe de scène Roblox : lit un projet Rojo et en extrait la structure réelle du jeu.
 *
 * Ce que le graphe apporte à l'agent (au-delà de la lecture fichier par fichier) :
 * - où va chaque script (ServerScriptService, StarterPlayerScripts, ReplicatedStorage…) ;
 * - qui émet et qui écoute chaque RemoteEvent / RemoteFunction ;
 * - les tags CollectionService utilisés ;
 * - les remotes déclarés mais jamais écoutés côté serveur (surface de triche) ;
 * - les modules orphelins et les dépendances entre modules (require).
 *
 * Aucune exécution de code : analyse statique du texte Luau et du default.project.json.
 */

const fs = require("node:fs");
const path = require("node:path");

const IGNORED_DIRS = new Set(["node_modules", ".git", "build", "dist", "packages", ".frst", "release"]);
const SERVICE_PATHS = [
    [/^ServerScriptService/i, "ServerScriptService"],
    [/^ServerStorage/i, "ServerStorage"],
    [/^ReplicatedStorage|^ReplicatedFirst/i, "ReplicatedStorage"],
    [/^StarterPlayerScripts|^StarterCharacterScripts/i, "StarterPlayer"],
    [/^StarterGui/i, "StarterGui"],
    [/^StarterPack/i, "StarterPack"],
    [/^Workspace/i, "Workspace"],
    [/^Lighting/i, "Lighting"],
    [/^SoundService/i, "SoundService"]
];

function walk(workspace, rel = ".", out = [], depth = 0) {
    if (depth > 12 || out.length > 3000) return out;
    let entries;
    try { entries = fs.readdirSync(path.join(workspace, rel), { withFileTypes: true }); } catch { return out; }
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const child = rel === "." ? entry.name : `${rel}/${entry.name}`;
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            walk(workspace, child, out, depth + 1);
        } else if (entry.isFile()) {
            out.push(child);
        }
    }
    return out;
}

function serviceFor(file) {
    const rel = file.replace(/^src\//, "");
    const found = SERVICE_PATHS.find(([re]) => re.test(rel));
    if (found) return found[1];
    // Convention Rojo courante : src/server, src/client, src/shared.
    if (/^server\//i.test(rel)) return "ServerScriptService";
    if (/^client\//i.test(rel)) return "StarterPlayer";
    if (/^shared\//i.test(rel)) return "ReplicatedStorage";
    return "Workspace";
}

function scriptKind(file) {
    if (/\.client\.luau?$/i.test(file)) return "LocalScript";
    if (/\.server\.luau?$/i.test(file)) return "Script";
    if (/init\.luau?$/i.test(file)) return "ModuleScript";
    return "ModuleScript";
}

/** Nom de l'Instance telle que Rojo la crée pour un fichier. */
function instanceName(file) {
    const base = path.basename(file).replace(/\.(server|client)\.luau?$/i, "").replace(/\.luau?$/i, "").replace(/^init$/i, "");
    const parent = path.basename(path.dirname(file));
    return base || parent;
}

function stripComments(source) {
    return String(source)
        .replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, " ")
        .replace(/--[^\n]*/g, " ");
}

/**
 * Analyse une source Luau : remotes, tags, require, connexions, services.
 * Renvoie { remotes: {name: {emit,listen}}, tags, requires, connects, services, loops }.
 */
function analyzeSource(source) {
    const code = stripComments(source);
    const remotes = {};
    const tags = new Set();
    const requires = [];
    const services = new Set();
    const connects = [];
    let loops = 0;

    for (const match of code.matchAll(/Instance\.new\(\s*["'](RemoteEvent|RemoteFunction|BindableEvent|BindableFunction)["']/g)) {
        // Le nom est souvent fixé juste après : .Name = "..."
        const tail = code.slice(match.index, match.index + 240);
        const named = /\.Name\s*=\s*["']([^"']+)["']/.exec(tail);
        const key = named ? named[1] : match[1];
        remotes[key] = remotes[key] || { kind: match[1], emit: 0, listen: 0 };
    }
    for (const match of code.matchAll(/GetService\(\s*["']([A-Za-z]+)["']\s*\)/g)) services.add(match[1]);

    // Variables qui désignent un remote du ReplicatedStorage : local x = ReplicatedStorage:WaitForChild("Nom").
    const aliases = new Map();
    for (const match of code.matchAll(/(?:local\s+)?([A-Za-z_]\w*)\s*=\s*(?:ReplicatedStorage|game:GetService\(\s*["']ReplicatedStorage["']\s*\))\s*:\s*WaitForChild\(\s*["']([^"']+)["']\s*\)/g)) {
        aliases.set(match[1], match[2]);
    }
    const remoteName = raw => aliases.get(String(raw).split(".").pop()) || String(raw).split(".").pop();

    for (const match of code.matchAll(/([A-Za-z_][\w.]*)\s*:\s*(FireServer|FireClient|FireAllClients|Fire|InvokeServer|InvokeClient)\s*\(/g)) {
        const name = remoteName(match[1]);
        remotes[name] = remotes[name] || { kind: "RemoteEvent", emit: 0, listen: 0 };
        remotes[name].emit += 1;
    }
    for (const match of code.matchAll(/([A-Za-z_][\w.]*)\s*\.\s*On(ServerEvent|ClientEvent|ServerInvoke|ClientInvoke)\s*[:=]?\s*(?::Connect|function)?/g)) {
        const name = remoteName(match[1]);
        remotes[name] = remotes[name] || { kind: "RemoteEvent", emit: 0, listen: 0 };
        remotes[name].listen += 1;
    }
    for (const match of code.matchAll(/AddTag\(\s*["']([^"']+)["']/g)) tags.add(match[1]);
    for (const match of code.matchAll(/GetTagged\(\s*["']([^"']+)["']/g)) tags.add(match[1]);
    for (const match of code.matchAll(/require\(\s*(?:script\.)?([\w.]+)\s*\)/g)) requires.push(match[1]);
    for (const match of code.matchAll(/([A-Za-z_][\w.]*)\s*:\s*Connect\s*\(/g)) connects.push(match[1]);
    loops += (code.match(/while\s+true\s+do/g) || []).length;

    return { remotes, tags: [...tags], requires, connects, services: [...services], loops };
}

function readRojoProject(workspace, file) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(workspace, file), "utf8"));
        const tree = data.tree || {};
        return {
            name: data.name || null,
            services: Object.keys(tree),
            tree,
            mappings: Object.entries(tree).map(([key, value]) => ({
                service: key,
                path: typeof value === "string" ? value : value?.$path || null
            }))
        };
    } catch {
        return null;
    }
}

/* ---------- Arbre Roblox Studio (pour la barre latérale de l'IDE) ---------- */

/** Chemin absolu → chemin relatif au projet, toujours en « / ». */
function relOf(workspace, abs) {
    const rel = path.relative(workspace, abs);
    return rel.split(path.sep).join("/");
}

/** Fichier Rojo (script ou modèle) : nom d'Instance, classe et chemin du fichier. */
function rojoFileNode(workspace, abs) {
    const file = relOf(workspace, abs);
    const base = path.basename(file);
    if (/\.meta\.json$/i.test(base)) return null;
    if (/\.model\.json$/i.test(base)) return { name: base.replace(/\.model\.json$/i, ""), className: "Model", path: file, kind: "file" };
    if (/\.(rbxm|rbxmx)$/i.test(base)) return { name: base.replace(/\.rbxmx?$/i, ""), className: "Model", path: file, kind: "file" };
    if (!/\.luau?$/i.test(base)) return null;
    return { name: instanceName(file) || base, className: scriptKind(file), path: file, kind: "file" };
}

/** Enfants d'un dossier : dossiers (nom d'Instance) puis fichiers, triés par nom. */
function scanRojoDir(workspace, abs, depth = 0, limit = 400) {
    const nodes = [];
    if (depth > 10) return nodes;
    let entries;
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return nodes; }
    const sorted = entries
        .filter(entry => !entry.name.startsWith("."))
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    for (const entry of sorted) {
        if (nodes.length >= limit) break;
        const child = path.join(abs, entry.name);
        if (entry.isDirectory()) {
            // Un dossier « init.luau » devient le ModuleScript parent : son contenu remonte d'un niveau.
            let children = scanRojoDir(workspace, child, depth + 1, limit - nodes.length);
            const init = ["init.luau", "init.lua"].find(name => {
                try { return fs.statSync(path.join(child, name)).isFile(); } catch { return false; }
            });
            const node = { name: entry.name, className: init ? "ModuleScript" : "Folder", path: relOf(workspace, child), kind: "dir", children };
            if (init) node.init = relOf(workspace, path.join(child, init));
            nodes.push(node);
        } else {
            const node = rojoFileNode(workspace, child);
            if (node) nodes.push(node);
        }
    }
    return nodes;
}



/**
 * Convertit un nœud du default.project.json en nœud d'arbre.
 * Une chaîne ou $path mappe un dossier ; un $path = fichier donne une seule Instance ;
 * un objet imbriqué est une Instance virtuelle (Folder, Configuration, objet modèle…).
 */
function rojoNodeFromConfig(workspace, key, value, depth = 0) {
    if (depth > 10) return null;
    if (typeof value === "string" || (value && typeof value === "object" && value.$path)) {
        const target = typeof value === "string" ? value : value.$path;
        const abs = path.resolve(workspace, target);
        let exists = true;
        let isFile = false;
        try {
            const info = fs.statSync(abs);
            isFile = info.isFile();
        } catch {
            exists = false;
        }
        if (!exists) return { name: key, className: "Folder", path: target.split(path.sep).join("/"), kind: "dir", children: [], missing: true };
        if (isFile) {
            const node = rojoFileNode(workspace, abs);
            return node ? { ...node, path: relOf(workspace, abs), name: key || node.name, className: value.$className || node.className } : null;
        }
        return { name: key, className: value.$className || "Folder", path: relOf(workspace, abs), kind: "dir", children: scanRojoDir(workspace, abs) };
    }
    if (value && typeof value === "object") {
        const children = [];
        for (const [childKey, childValue] of Object.entries(value)) {
            if (childKey.startsWith("$") || childKey.startsWith("@")) continue;
            const child = rojoNodeFromConfig(workspace, childKey, childValue, depth + 1);
            if (child) children.push(child);
        }
        return { name: key, className: value.$className || "Folder", kind: "dir", path: null, children };
    }
    return null;
}

/* Ordre d'affichage des services, proche de l'Explorer de Roblox Studio. */
const SERVICE_ORDER = [
    "Workspace", "Players", "Lighting", "ReplicatedFirst", "ReplicatedStorage", "ServerScriptService",
    "ServerStorage", "StarterGui", "StarterPack", "StarterPlayer", "SoundService", "Teams"
];

/**
 * Arbre de scène tel que Roblox Studio l'affiche, reconstruit depuis le default.project.json.
 * Renvoie { project, services: [{ name, className, path, kind, children }], warnings }.
 * Lecture seule : aucun fichier modifié, aucun serveur lancé.
 */
function buildStudioTree(workspace) {
    if (!workspace) return { project: null, services: [], warnings: ["Aucun projet ouvert."] };
    const graph = buildGraph(workspace);
    const projectFile = graph.project?.file || null;
    if (!projectFile) {
        return { project: null, services: [], warnings: ["Aucun *.project.json : ce dossier n'est pas encore un projet Rojo."] };
    }
    const data = readRojoProject(workspace, projectFile);
    const tree = data?.tree || {};
    const services = [];
    const warnings = [];
    const keys = Object.keys(tree).filter(key => !key.startsWith("$") && !key.startsWith("@")).sort((a, b) => {
        const ai = SERVICE_ORDER.indexOf(a), bi = SERVICE_ORDER.indexOf(b);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi) || a.localeCompare(b);
    });
    for (const key of keys) {
        const node = rojoNodeFromConfig(workspace, key, tree[key]);
        if (!node) continue;
        services.push({ ...node, name: key, className: key });
    }
    // Scripts du graphique absents du mapping : signalés, pas cachés.
    const mapped = new Set();
    function collect(nodes) {
        for (const node of nodes) {
            if (node.path) mapped.add(node.path);
            if (node.children) collect(node.children);
        }
    }
    collect(services);
    for (const script of graph.scripts) if (!mapped.has(script.file)) warnings.push(`${script.file} n'est mappé par aucun service du projet Rojo.`);
    return { project: projectFile, name: data?.name || null, services, warnings, counts: graph.counts };
}

/** Construit le graphe complet du projet. */
function buildGraph(workspace) {
    const files = walk(workspace);
    const luau = files.filter(file => /\.luau?$/i.test(file));
    const projects = files.filter(file => /\.project\.json$/i.test(file)).map(file => ({ file, ...readRojoProject(workspace, file) }));
    const project = projects.sort((a, b) => (b.file === "default.project.json" ? 1 : 0) - (a.file === "default.project.json" ? 1 : 0))[0] || null;

    const scripts = [];
    const emitted = new Map();
    const listened = new Map();
    const allTags = new Set();
    const services = new Set();
    const modules = new Set();
    const problems = [];

    for (const file of luau) {
        let source;
        try { source = fs.readFileSync(path.join(workspace, file), "utf8"); } catch { continue; }
        const info = analyzeSource(source);
        const name = instanceName(file);
        const kind = scriptKind(file);
        const service = serviceFor(file);
        if (kind === "ModuleScript") modules.add(name);
        info.services.forEach(item => services.add(item));
        info.tags.forEach(tag => allTags.add(tag));

        for (const [remote, usage] of Object.entries(info.remotes)) {
            if (usage.emit) emitted.set(remote, (emitted.get(remote) || 0) + usage.emit);
            if (usage.listen) listened.set(remote, (listened.get(remote) || 0) + usage.listen);
        }
        if (info.loops) problems.push(`${file} : ${info.loops} boucle(s) while true do à vérifier (attente obligatoire).`);

        scripts.push({
            file,
            name,
            kind,
            service,
            lines: source.split(/\r?\n/).length,
            remotes: Object.keys(info.remotes),
            tags: info.tags,
            requires: [...new Set(info.requires)]
        });
    }

    const clientFiles = scripts.filter(item => item.kind === "LocalScript" || /client/i.test(item.file));
    for (const remote of emitted.keys()) {
        if (!listened.has(remote)) {
            problems.push(`Remote « ${remote} » émis mais jamais écouté : vérifie qu'un Script serveur l'écoute, sinon aucun effet.`);
        }
    }
    const clientEmitsServerData = clientFiles.filter(item => item.remotes.length);
    for (const item of clientEmitsServerData) {
        if (item.service !== "ServerScriptService" && !scripts.some(other => other.kind === "Script" && other.remotes.some(name => item.remotes.includes(name)))) {
            problems.push(`${item.file} manipule « ${item.remotes.join(", ")} » sans écoute serveur correspondante : risque de triche.`);
        }
    }
    const orphans = scripts.filter(item => item.kind === "ModuleScript" && !scripts.some(other => other.file !== item.file && other.requires.includes(item.name)));
    if (orphans.length > 3) problems.push(`${orphans.length} modules ne semblent requis par aucun script (dont ${orphans.slice(0, 3).map(item => item.name).join(", ")}).`);

    return {
        project,
        roblox: Boolean(project),
        scripts,
        counts: {
            files: luau.length,
            server: scripts.filter(item => item.kind === "Script").length,
            client: scripts.filter(item => item.kind === "LocalScript").length,
            modules: scripts.filter(item => item.kind === "ModuleScript").length
        },
        remotes: [...new Set([...emitted.keys(), ...listened.keys()])].map(name => ({
            name,
            emitted: emitted.get(name) || 0,
            listened: listened.get(name) || 0
        })),
        tags: [...allTags],
        services: [...services],
        modules: [...modules],
        problems
    };
}

/** Résumé texte compact pour le prompt (le graphe complet reste dans le résultat d'outil). */
function summarizeGraph(graph, maxLines = 40) {
    if (!graph.roblox) return "Aucun fichier *.project.json : projet Roblox non détecté.";
    const lines = [
        `Projet Rojo : ${graph.project?.file || "?"} (${graph.counts.files} fichier(s) Luau, ${graph.counts.server} script(s) serveur, ${graph.counts.client} client, ${graph.counts.modules} module(s)).`
    ];
    for (const script of graph.scripts.slice(0, maxLines)) {
        lines.push(`- ${script.file} → ${script.kind} dans ${script.service}${script.remotes.length ? ` ; remotes : ${script.remotes.join(", ")}` : ""}`);
    }
    if (graph.remotes.length) {
        lines.push(`Remotes : ${graph.remotes.map(item => `${item.name} (émis ${item.emitted}, écouté ${item.listened})`).join(" ; ")}.`);
    }
    if (graph.tags.length) lines.push(`Tags : ${graph.tags.join(", ")}.`);
    if (graph.problems.length) lines.push(`Points à vérifier : ${graph.problems.slice(0, 8).join(" | ")}`);
    return lines.join("\n");
}

module.exports = { buildGraph, analyzeSource, summarizeGraph, serviceFor, scriptKind, instanceName, walk, buildStudioTree };
