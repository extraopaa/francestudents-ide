"use strict";

/**
 * Outil roblox_playtest : lance la place construite dans Roblox Studio en mode test,
 * capture les logs serveur/client et détecte les erreurs d'exécution.
 *
 * Le build est fait d'abord avec `rojo build` (même commande que roblox_check), puis
 * Studio est ouvert sur le fichier .rbxlx. Roblox Studio n'expose pas d'API de test
 * automatisée : cet outil prépare et ouvre le test, puis relit les logs Studio si le
 * dossier de logs Roblox est disponible. Aucun résultat n'est présenté comme réussi
 * sans preuve lisible.
 */

const fs = require("node:fs");
const path = require("node:path");

const { state } = require("../state");
const { ui } = require("../ui-bridge");
const { optionalInt } = require("./core/args");
const sandbox = require("./sandbox");
const { findRojoProject } = require("./roblox-check");

const trusted = new Set();
const MAX_LOG_BYTES = 256 * 1024;
const MAX_LOG_FILES = 20;

/** Chemins connus des logs Roblox Studio (Windows). */
function studioLogDirs() {
    const local = process.env.LOCALAPPDATA;
    if (!local) return [];
    return [
        path.join(local, "Roblox", "logs"),
        path.join(local, "Roblox", "Logs")
    ].filter(dir => {
        try { return fs.statSync(dir).isDirectory(); } catch { return false; }
    });
}

/** Emplacements connus de RobloxStudioBeta.exe. */
function studioCandidates() {
    const local = process.env.LOCALAPPDATA;
    const list = [];
    if (local) {
        const versions = path.join(local, "Roblox", "Versions");
        try {
            for (const name of fs.readdirSync(versions)) {
                list.push(path.join(versions, name, "RobloxStudioBeta.exe"));
            }
        } catch { /* absent */ }
    }
    return list.filter(file => sandbox.exists(file));
}

function findStudio() {
    const fromPath = sandbox.which("RobloxStudioBeta");
    if (fromPath) return fromPath;
    return studioCandidates()[0] || null;
}

/** Dernier fichier de log Studio modifié, ou null. */
function latestStudioLog() {
    const files = [];
    for (const dir of studioLogDirs()) {
        try {
            for (const name of fs.readdirSync(dir)) {
                if (!/\.log$/i.test(name)) continue;
                if (files.length >= MAX_LOG_FILES) break;
                const full = path.join(dir, name);
                try { files.push({ full, mtime: fs.statSync(full).mtimeMs }); } catch { /* ignoré */ }
            }
        } catch { /* ignoré */ }
    }
    files.sort((a, b) => b.mtime - a.mtime);
    return files[0] || null;
}

/** Extrait les erreurs et avertissements d'un log Studio (best effort, borné). */
function readStudioErrors(sinceMs = 0) {
    const latest = latestStudioLog();
    if (!latest) return { available: false, file: null, errors: [], warnings: [], message: "Dossier de logs Roblox Studio introuvable." };
    if (latest.mtime < sinceMs) return { available: true, file: latest.full, errors: [], warnings: [], message: "Aucun nouveau log Studio depuis le lancement du test." };
    let text;
    try {
        const fd = fs.openSync(latest.full, "r");
        try {
            const size = fs.fstatSync(fd).size;
            const start = Math.max(0, size - MAX_LOG_BYTES);
            const buffer = Buffer.alloc(size - start);
            fs.readSync(fd, buffer, 0, buffer.length, start);
            text = buffer.toString("utf8");
        } finally {
            fs.closeSync(fd);
        }
    } catch (error) {
        return { available: true, file: latest.full, errors: [], warnings: [], message: `Log illisible : ${error.message}` };
    }
    const errors = [];
    const warnings = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        if (/\b(Error|ERREUR|stack traceback|attempt to index nil|Infinite yield)\b/i.test(line)) {
            if (errors.length < 40) errors.push(line.slice(0, 400));
        } else if (/\bWarning\b|\bWARN\b/.test(line) && warnings.length < 20) {
            warnings.push(line.slice(0, 300));
        }
    }
    return { available: true, file: latest.full, errors, warnings, message: `${errors.length} erreur(s) et ${warnings.length} avertissement(s) dans le dernier log Studio.` };
}

function checkArgs(args = {}) {
    if (args.build !== undefined && typeof args.build !== "boolean") throw new Error("build doit être true ou false.");
    if (args.open !== undefined && typeof args.open !== "boolean") throw new Error("open doit être true ou false.");
    optionalInt(args.timeout_ms, "timeout_ms");
}

async function runPlaytest(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    checkArgs(args);

    const project = findRojoProject(workspace);
    const result = { project, build: null, studio: null, log: null, status: "prepared" };

    // 1. Construire la place : c'est la seule preuve que le code compile.
    let place = null;
    if (args.build !== false) {
        const rojo = sandbox.findRobloxTool(workspace, "rojo");
        if (!rojo) {
            return { ...result, status: "blocked", message: "rojo absent : installe-le (aftman add rojo-rbx/rojo) avant de lancer un test." };
        }
        if (!project) return { ...result, status: "blocked", message: "Aucun *.project.json : ce dossier n'est pas un projet Rojo." };
        const output = ".frst/build/playtest.rbxlx";
        fs.mkdirSync(path.join(workspace, ".frst", "build"), { recursive: true });
        const res = await sandbox.runProcess(rojo, ["build", project, "--output", output], {
            cwd: workspace,
            timeoutMs: Math.min(600000, Math.max(5000, args.timeout_ms ?? 180000))
        });
        const ok = res.exit_code === 0;
        result.build = { project, output: ok ? output : null, status: ok ? "ok" : res.timed_out ? "timeout" : "failed", exit_code: res.exit_code };
        if (!ok) {
            result.build.output = res.output.slice(-4000);
            return { ...result, status: "failed", message: "Le build a échoué : corrige les erreurs de build avant de tester dans Studio." };
        }
        place = path.join(workspace, output);
    }

    // 2. Ouvrir Studio sur la place construite.
    // Sans place, on ne demande rien : aucune confirmation inutile et aucun lancement.
    if (!place) {
        const studio = findStudio();
        return {
            ...result,
            studio: { found: Boolean(studio), path: studio, opened: false },
            log: readStudioErrors(0),
            status: "blocked",
            message: studio
                ? "Aucune place à ouvrir : lance d'abord avec build:true pour construire et tester le projet."
                : "Aucune place à ouvrir et Roblox Studio introuvable. Installe Studio depuis https://create.roblox.com/."
        };
    }

    const studio = findStudio();
    if (!studio) {
        return {
            ...result,
            studio: { found: false },
            status: "blocked",
            message: "Roblox Studio introuvable. Installe-le depuis https://create.roblox.com/ puis relance. Le build reste valide."
        };
    }

    if (!trusted.has(workspace)) {
        const ok = await ui.confirm("Ouvrir Roblox Studio sur la place construite pour la tester ? Studio s'exécute sur ta machine et lit le fichier .rbxlx du projet.");
        if (!ok) return { ...result, denied: true, status: "denied", message: "Test Studio refusé par l'utilisateur." };
        trusted.add(workspace);
    }

    const startedAt = Date.now();
    if (place && args.open !== false) {
        const { spawn } = require("node:child_process");
        const child = spawn(studio, [place], { cwd: workspace, detached: true, stdio: "ignore", windowsHide: false });
        child.unref();
    }
    result.studio = { found: true, path: studio, opened: Boolean(place && args.open !== false) };

    // 3. Laisser Studio démarrer puis relire ses logs.
    const waitMs = Math.min(60000, Math.max(2000, args.wait_ms ?? 8000));
    await new Promise(resolve => setTimeout(resolve, waitMs));
    result.log = readStudioErrors(startedAt);

    const ok = result.log.errors.length === 0;
    return {
        ...result,
        status: ok ? "ok" : "failed",
        message: ok
            ? `Place construite et ouverte dans Studio. ${result.log.message} Lance le test (F5) puis demande action:"logs" pour relire les erreurs.`
            : `Le test signale ${result.log.errors.length} erreur(s) : lis log.errors et corrige avant d'annoncer le résultat.`
    };
}

/** Relit les erreurs du dernier log Studio sans relancer de build. */
async function readLogs(args = {}) {
    const since = args.since_ms ? Date.now() - Math.max(0, args.since_ms) : 0;
    return readStudioErrors(since);
}

function resetTrust() {
    trusted.clear();
}

module.exports = {
    name: "roblox_playtest",
    run: async (args = {}) => (args.action === "logs" ? { ...(await readLogs(args)), action: "logs" } : runPlaytest(args)),
    check(args = {}) {
        if (args.action !== undefined && args.action !== "logs") throw new Error("action doit valoir logs ou être omis.");
        checkArgs(args);
    },
    describe(a = {}) {
        return a.action === "logs" ? "Logs Roblox Studio" : "Test Roblox Studio";
    },
    runPlaytest,
    readStudioErrors,
    findStudio,
    latestStudioLog,
    resetTrust
};
