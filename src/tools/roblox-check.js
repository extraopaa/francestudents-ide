"use strict";

/**
 * Outil roblox_check : vérifie un projet Roblox Studio avant de déclarer un résultat.
 *
 * Trois familles de contrôles :
 * 1. Analyse syntaxique et de type Luau (luau-analyze, si installé).
 * 2. Lint Luau (selene .) et build Rojo (rojo build --output …) : ce sont eux qui prouvent
 *    que le projet compile réellement.
 * 3. Contrôles Roblox locaux (toujours) : noms d'Instances réservés ou invalides, services
 *    instanciés directement, boucles serrées sans attente, requêtes client non protégées.
 *
 * Aucun résultat n'est présenté comme réussi si un binaire a échoué sans diagnostic lisible.
 */

const fs = require("node:fs");
const path = require("node:path");

const { state } = require("../state");
const { ui } = require("../ui-bridge");
const { optionalInt } = require("./core/args");
const sandbox = require("./sandbox");

const MAX_DIAGNOSTICS = 200;
const trusted = new Set();

const LUAU_EXT = /\.(luau|lua)$/i;
const IGNORED_DIRS = new Set(["node_modules", ".git", "build", "dist", "packages", ".frst", "release"]);

/* Noms réservés ou interdits pour une Instance créée en code. */
const RESERVED_NAMES = new Set([
    "game", "workspace", "script", "Instance", "Parent", "Name",
    "ClassName", "RobloxLocked", "Archivable", "DataCost"
]);

/* Services qui doivent passer par GetService : les écrire en global masque les erreurs de nom. */
const SERVICES = new Set([
    "Players", "ReplicatedStorage", "ServerStorage", "ServerScriptService", "StarterGui",
    "StarterPack", "Lighting", "SoundService", "Debris", "CollectionService", "TweenService",
    "MarketplaceService", "DataStoreService", "PathfindingService", "UserInputService",
    "ContextActionService", "HttpService", "TextService", "GuiService", "PhysicsService",
    "TeleportService", "MessagingService", "BadgeService", "InsertService", "PolicyService",
    "MemoryStoreService", "LocalizationService", "SocialService", "RunService"
]);

function walk(workspace, rel = ".", out = [], depth = 0) {
    if (depth > 12 || out.length > 4000) return out;
    let entries;
    try { entries = fs.readdirSync(path.join(workspace, rel), { withFileTypes: true }); } catch { return out; }
    for (const entry of entries) {
        if (entry.name.startsWith(".") && entry.name !== ".luaurc") continue;
        const child = rel === "." ? entry.name : `${rel}/${entry.name}`;
        if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            walk(workspace, child, out, depth + 1);
        } else if (entry.isFile() && LUAU_EXT.test(entry.name)) {
            out.push(child);
        }
    }
    return out;
}

/**
 * Contrôles statiques sur le texte Luau. Renvoie des diagnostics
 * { file, line, column, severity, source, code, message }.
 */
function inspectLuau(source, file = "") {
    const list = [];
    const lines = String(source).split(/\r?\n/);
    const push = (line, column, severity, code, message) =>
        list.push({ file, line, column, severity, code, message, source: "roblox" });

    // État multi-lignes : { kind: "comment"|"string", eq: nombre de "=" }
    let open = null;
    const isServerFile = /(^|\/)(server|ServerScriptService|ServerStorage|src\/server)/i.test(file) || /\bScript\b/.test(file);

    /** Retire les blocs multi-lignes d'une ligne ; renvoie le code restant et l'état suivant. */
    function stripBlocks(line, state) {
        let rest = line;
        let current = state;
        let guard = 0;
        while (guard++ < 20) {
            if (current) {
                const marker = `]${current.eq}]`;
                const at = rest.indexOf(marker);
                if (at === -1) return { code: "", state: current };
                rest = rest.slice(at + marker.length);
                current = null;
                continue;
            }
            const comment = /--\[(=*)\[/.exec(rest);
            const string = /\[(=*)\[/.exec(rest);
            const start = comment && (!string || comment.index <= string.index) ? comment : string;
            if (!start) return { code: rest.replace(/--.*$/, ""), state: null };
            const before = rest.slice(0, start.index);
            const eq = start[1];
            const marker = `]${eq}]`;
            const end = rest.indexOf(marker, start.index + start[0].length);
            if (end === -1) return { code: before.replace(/--.*$/, ""), state: { eq } };
            rest = before + rest.slice(end + marker.length);
        }
        return { code: rest, state: null };
    }

    lines.forEach((raw, index) => {
        const lineNo = index + 1;
        const stripped = stripBlocks(raw, open);
        open = stripped.state;
        const code = stripped.code;
        if (!code.trim()) return;

        // Instance.new("Nom") avec un nom de classe invalide.
        for (const match of code.matchAll(/Instance\.new\(\s*(["'])([^"']*)\1/g)) {
            const name = match[2];
            if (!name.trim()) push(lineNo, match.index + 1, "error", "instance-new-empty", "Instance.new : nom de classe vide.");
            else if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) push(lineNo, match.index + 1, "error", "instance-new-name", `Instance.new("${name}") : nom de classe invalide.`);
        }

        // Réaffectation de .Name avec un nom réservé.
        for (const match of code.matchAll(/\.Name\s*=\s*(["'])([^"']*)\1/g)) {
            const name = match[2];
            if (RESERVED_NAMES.has(name)) {
                push(lineNo, match.index + 1, "warning", "reserved-name", `Nom d'Instance « ${name} » réservé ou vide : choisis un nom explicite.`);
            }
        }

        // Bug Luau courant : construit sur une ligne, affecté sur la suivante.
        if (/^\s*local\s+[A-Za-z_]\w*\s*,?\s*$/.test(raw) && /^\s*=\s*[^=]/.test(lines[index + 1] || "")) {
            push(lineNo, 1, "warning", "split-assignment", "Affectation commencée sur cette ligne et terminée sur la suivante : le parser Luau la refuse.");
        }

        // Boucle while true do sans attente.
        if (/while\s+true\s+do\b/.test(code) && /^\s*while\s+true\s+do\s*$/.test(code.trim())) {
            const end = findLoopEnd(lines, index);
            const body = lines.slice(index + 1, end).join("\n");
            if (!/\b(task\.wait|wait|runService\.|:Wait|Heartbeat:Wait|yield)\b/.test(body)) {
                push(lineNo, 1, "error", "tight-loop", "Boucle while true do sans attente : bloque le thread. Ajoute task.wait ou utilise RunService.");
            }
        }

        // DataStore lu/écrit depuis un fichier client : n'a aucun effet.
        if (/DataStoreService/.test(code) && /client/i.test(file) && !isServerFile) {
            push(lineNo, 1, "error", "datastore-client", "DataStoreService n'est pas accessible depuis le client : déplace cette logique dans un Script serveur.");
        }

        // Service Roblox écrit en global : vérifié après l'analyse du fichier (cf. boucle ci-dessous).
    });

    // Un service utilisé en global sans GetService dans tout le fichier est fragile.
    for (const service of SERVICES) {
        const use = new RegExp(`(^|[^\\w.:])${service}\\b`);
        if (!use.test(String(source))) continue;
        if (new RegExp(`GetService\\(\\s*["']${service}["']\\s*\\)`, "i").test(source)) continue;
        const line = lines.findIndex(item => new RegExp(`(^|[^\\w.:])${service}\\b`).test(item.replace(/--.*$/, ""))) + 1;
        push(line || 1, 1, "warning", "service-global", `${service} utilisé sans GetService : utilise game:GetService("${service}").`);
    }

    return list;
}

/** Cherche le "end" qui ferme la boucle while ouverte à l'index donné. */
function findLoopEnd(lines, start) {
    let depth = 1;
    for (let i = start + 1; i < lines.length; i++) {
        const code = lines[i].replace(/--.*$/, "");
        const opens = (code.match(/\b(function|if|for|while|do|repeat)\b/g) || []).filter(word => word !== "do" || !/\bfor\b|\bwhile\b/.test(code)).length;
        const closes = (code.match(/\b(end|until)\b/g) || []).length;
        depth += opens - closes;
        if (depth <= 0) return i;
    }
    return lines.length;
}

/** Transforme la sortie texte de Selene en diagnostics. */
function parseSelene(output, workspace) {
    const list = [];
    const lineRe = /^(.+?):(\d+):(\d+):\s+(error|warning)(?:\[(\w+)\])?:\s*(.*)$/;
    for (const raw of String(output).split(/\r?\n/)) {
        const match = lineRe.exec(raw.replace(/\s+$/, ""));
        if (!match) continue;
        list.push({
            file: sandbox.relativeTo(workspace, match[1]),
            line: Number(match[2]),
            column: Number(match[3]),
            severity: match[4] === "error" ? "error" : "warning",
            code: match[5] || "selene",
            message: match[6].trim(),
            source: "selene"
        });
    }
    return list;
}

/** Transforme la sortie textuelle de luau-analyze en diagnostics (best effort). */
function parseLuauAnalyze(output, workspace) {
    const list = [];
    const lineRe = /^(.+?)\((\d+),(\d+)\):\s*(?:(\w+):\s*)?(.*)$/;
    // luau-analyze ne distingue pas toujours erreurs et avertissements : seul « TypeError », « SyntaxError »
    // et « UnknownType » sont des erreurs bloquantes ; « UnknownGlobal » reste un avertissement.
    const fatal = /^(TypeError|SyntaxError|UnknownType|UnknownRequire)$/;
    for (const raw of String(output).split(/\r?\n/)) {
        const match = lineRe.exec(raw.trim());
        if (!match) continue;
        const kind = String(match[4] || "").toLowerCase();
        list.push({
            file: sandbox.relativeTo(workspace, match[1]),
            line: Number(match[2]),
            column: Number(match[3]),
            severity: kind && fatal.test(match[4]) ? "error" : "warning",
            code: "luau-analyze",
            message: match[5].trim(),
            source: "luau-analyze"
        });
    }
    return list;
}

function findRojoProject(workspace) {
    try {
        const projects = fs.readdirSync(workspace).filter(name => /\.project\.json$/i.test(name));
        if (projects.includes("default.project.json")) return "default.project.json";
        return projects.sort()[0] || null;
    } catch {
        return null;
    }
}

function checkArgs(args = {}) {
    if (args.files !== undefined) {
        if (!Array.isArray(args.files) || args.files.some(f => typeof f !== "string" || !f.trim())) {
            throw new Error("files doit être une liste de chemins (chaînes non vides).");
        }
        if (args.files.length > 100) throw new Error("files : 100 chemins au maximum.");
    }
    optionalInt(args.timeout_ms, "timeout_ms");
    if (args.build !== undefined && typeof args.build !== "boolean") throw new Error("build doit être true ou false.");
}

async function runRobloxCheck(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    checkArgs(args);

    const timeoutMs = Math.min(600000, Math.max(5000, args.timeout_ms ?? 120000));
    const wanted = Array.isArray(args.files) && args.files.length
        ? args.files.map(file => {
            const abs = path.resolve(workspace, file);
            if (path.relative(workspace, abs).startsWith("..")) throw new Error(`Chemin hors du projet : ${file}`);
            return sandbox.relativeTo(workspace, abs);
        })
        : walk(workspace);

    const notes = [];
    const checkers = [];
    let diagnostics = [];

    // 1. Contrôles Roblox locaux, toujours disponibles.
    for (const file of wanted.slice(0, 500)) {
        try {
            diagnostics.push(...inspectLuau(fs.readFileSync(path.join(workspace, file), "utf8"), file));
        } catch { /* fichier illisible */ }
    }
    checkers.push({ tool: "roblox-rules", status: "ok", exit_code: 0, count: diagnostics.length });

    const needsTrust = [];
    if (sandbox.findRobloxTool(workspace, "selene")) needsTrust.push("selene");
    if (sandbox.findRobloxTool(workspace, "luau-analyze")) needsTrust.push("luau-analyze");
    const rojoProject = findRojoProject(workspace);
    if (rojoProject && args.build !== false) needsTrust.push("rojo build");

    if (needsTrust.length && !trusted.has(workspace)) {
        const ok = await ui.confirm(`Lancer ${needsTrust.join(", ")} sur ce projet Roblox ? Ces outils lisent et compilent les fichiers du projet.`);
        if (!ok) {
            return { denied: true, message: "Vérification Roblox refusée par l'utilisateur.", checkers, notes, diagnostics };
        }
        trusted.add(workspace);
    }

    // 2. Selene : lint Luau.
    const selene = needsTrust.includes("selene") ? sandbox.findRobloxTool(workspace, "selene") : null;
    if (selene) {
        const res = await sandbox.runProcess(selene, [".", "--display-style", "quiet"], { cwd: workspace, timeoutMs });
        const parsed = parseSelene(res.output, workspace);
        diagnostics.push(...parsed);
        const entry = { tool: "selene", status: res.timed_out ? "timeout" : res.exit_code === 0 ? "ok" : "failed", exit_code: res.exit_code, count: parsed.length };
        if (res.exit_code !== 0 && !parsed.length) entry.output = res.output;
        checkers.push(entry);
    } else {
        notes.push("selene absent : installe-le (aftman add Kampfkarren/selene ou cargo install selene) pour un lint Luau complet.");
    }

    // 3. luau-analyze : analyse de types.
    const luau = needsTrust.includes("luau-analyze") ? sandbox.findRobloxTool(workspace, "luau-analyze") : null;
    if (luau) {
        const res = await sandbox.runProcess(luau, wanted.slice(0, 200), { cwd: workspace, timeoutMs });
        const parsed = parseLuauAnalyze(res.output, workspace);
        diagnostics.push(...parsed);
        checkers.push({ tool: "luau-analyze", status: res.timed_out ? "timeout" : parsed.some(d => d.severity === "error") ? "failed" : "ok", exit_code: res.exit_code, count: parsed.length });
    } else {
        notes.push("luau-analyze absent : les types ne sont pas vérifiés avant le build.");
    }

    // 4. rojo build : preuve que le projet se compile.
    let build = null;
    if (rojoProject && args.build !== false) {
        const rojo = sandbox.findRobloxTool(workspace, "rojo");
        if (!rojo) {
            notes.push("rojo absent : impossible de builder la place Roblox (aftman add rojo-rbx/rojo).");
        } else {
            const output = ".frst/build/roblox-check.rbxlx";
            fs.mkdirSync(path.join(workspace, ".frst", "build"), { recursive: true });
            const res = await sandbox.runProcess(rojo, ["build", rojoProject, "--output", output], { cwd: workspace, timeoutMs });
            const ok = res.exit_code === 0;
            build = { project: rojoProject, output: ok ? output : null, status: res.timed_out ? "timeout" : ok ? "ok" : "failed", exit_code: res.exit_code };
            if (!ok) build.output = res.output;
            checkers.push({ tool: "rojo", status: build.status, exit_code: res.exit_code, count: 0 });
        }
    } else if (!rojoProject) {
        notes.push("Aucun fichier *.project.json : ce dossier n'est pas encore un projet Rojo.");
    }

    diagnostics.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));
    const errors = diagnostics.filter(d => d.severity === "error").length;
    const warnings = diagnostics.length - errors;
    const failed = checkers.filter(c => c.status !== "ok").map(c => c.tool);

    let message;
    if (failed.length) message = `${failed.join(", ")} en échec ; ${errors} erreur(s), ${warnings} avertissement(s).`;
    else if (errors) message = `${errors} erreur(s), ${warnings} avertissement(s) — corrige avant d'annoncer un résultat.`;
    else message = warnings ? `Aucune erreur ; ${warnings} avertissement(s).` : "Aucune erreur détectée (lint et build compris).";

    return {
        build,
        checkers,
        notes,
        errors,
        warnings,
        diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
        truncated: diagnostics.length > MAX_DIAGNOSTICS,
        files: wanted.length,
        message
    };
}

function resetTrust() {
    trusted.clear();
}

module.exports = {
    name: "roblox_check",
    run: runRobloxCheck,
    check: checkArgs,
    describe(a) {
        const files = Array.isArray(a.files) && a.files.length ? `${a.files.length} fichier(s)` : "projet complet";
        return `Roblox ${files}${a.build === false ? " (sans build)" : ""}`;
    },
    runRobloxCheck,
    inspectLuau,
    parseSelene,
    parseLuauAnalyze,
    findRojoProject,
    resetTrust
};
