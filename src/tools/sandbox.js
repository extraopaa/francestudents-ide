"use strict";

/**
 * Exécution de binaires de vérification (Selene, Rojo, luau-analyze, Blender).
 *
 * Contrairement à run_command, ces outils n'acceptent que des binaires connus et des
 * arguments construits ici : le modèle ne peut pas y glisser une commande arbitraire.
 * Aucun téléchargement : si l'outil est absent, le résultat le dit sans prétendre à un succès.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const MAX_BUFFER = 16 * 1024 * 1024;

function stripAnsi(text) {
    return String(text ?? "").replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

/** Candidates dans le dépôt : node_modules/.bin puis .aftman/bin (Aftman/Rokit). */
function localCandidates(workspace, name) {
    const exts = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
    const dirs = [path.join(workspace, "node_modules", ".bin"), path.join(workspace, ".aftman", "bin")];
    const found = [];
    for (const dir of dirs) {
        for (const ext of exts) {
            const file = path.join(dir, name + ext);
            try {
                if (fs.statSync(file).isFile()) found.push(file);
            } catch { /* absent */ }
        }
    }
    return found;
}

/** Cherche un exécutable dans le PATH (Windows : PATHEXT). */
function which(name) {
    const paths = String(process.env.PATH || "").split(path.delimiter).filter(Boolean);
    const exts = process.platform === "win32"
        ? String(process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";").filter(Boolean)
        : [""];
    for (const dir of paths) {
        for (const ext of exts) {
            const file = path.join(dir, name + ext);
            try {
                if (fs.statSync(file).isFile()) return file;
            } catch { /* suivant */ }
        }
    }
    return null;
}

/** Emplacements connus de Blender quand il n'est pas dans le PATH. */
function blenderCandidates(workspace) {
    const list = [];
    if (workspace) {
        try {
            const config = JSON.parse(fs.readFileSync(path.join(workspace, "blender.json"), "utf8"));
            if (typeof config.executable === "string" && config.executable.trim()) list.push(config.executable.trim());
        } catch { /* pas de config */ }
    }
    if (process.env.BLENDER_PATH) list.push(process.env.BLENDER_PATH);
    const roots = [process.env["ProgramFiles"], process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs")]
        .filter(Boolean);
    for (const root of roots) {
        const base = path.join(root, "Blender Foundation");
        try {
            for (const version of fs.readdirSync(base).filter(name => /^Blender/i.test(name)).sort().reverse()) {
                list.push(path.join(base, version, "blender.exe"));
            }
        } catch { /* dossier absent */ }
    }
    for (const steam of [process.env["ProgramFiles(x86)"], process.env["ProgramFiles"]].filter(Boolean)) {
        list.push(path.join(steam, "Steam", "steamapps", "common", "Blender", "blender.exe"));
    }
    return list;
}

function exists(file) {
    try { return fs.statSync(file).isFile(); } catch { return false; }
}

/**
 * Détecte Blender : PATH, puis blender.json du projet, variables et emplacements standards.
 * Renvoie { path, source } ou null. Ne lance jamais Blender ici.
 */
function findBlender(workspace) {
    const fromPath = which("blender");
    if (fromPath) return { path: fromPath, source: "PATH" };
    for (const candidate of blenderCandidates(workspace)) {
        if (exists(candidate)) {
            const source = process.env.BLENDER_PATH && candidate === process.env.BLENDER_PATH ? "BLENDER_PATH" : "installation standard";
            return { path: candidate, source };
        }
    }
    return null;
}

/** Chemin d'un vérificateur Roblox : dépôt prioritaire, puis PATH. */
function findRobloxTool(workspace, name) {
    const local = localCandidates(workspace, name)[0];
    if (local) return local;
    return which(name);
}

function runProcess(file, args, { cwd, timeoutMs = 120000, env } = {}) {
    return new Promise(resolve => {
        execFile(file, args, {
            cwd,
            timeout: Math.min(600000, Math.max(1000, timeoutMs)),
            maxBuffer: MAX_BUFFER,
            windowsHide: true,
            shell: false,
            env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env }
        }, (error, stdout, stderr) => {
            const timedOut = Boolean(error && error.killed);
            let code = 0;
            if (error) code = typeof error.code === "number" ? error.code : 1;
            resolve({
                exit_code: timedOut ? null : code,
                timed_out: timedOut,
                stdout: stripAnsi(stdout || ""),
                stderr: stripAnsi(stderr || ""),
                output: stripAnsi(`${stdout || ""}${stderr || ""}`).trim().slice(0, 30000)
            });
        });
    });
}

/** Chemin relatif au projet, toujours avec des "/". */
function relativeTo(workspace, file) {
    if (!file) return "";
    const abs = path.resolve(workspace, file);
    const rel = path.relative(workspace, abs);
    return (rel && !rel.startsWith("..") ? rel : abs).split(path.sep).join("/");
}

module.exports = { findBlender, findRobloxTool, which, runProcess, relativeTo, stripAnsi, exists };
