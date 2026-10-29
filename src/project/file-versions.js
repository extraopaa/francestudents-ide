"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const memory = require("./memory");
const { normalizeRelative, resolveInWorkspace, assertRealInside } = require("../tools/security");

const MAX_POINTS = 50;
const EXCLUDED = new Set([".git", "node_modules", ".frst", "dist", "build", "coverage"]);
const digest = data => crypto.createHash("sha256").update(data).digest("hex");
const root = () => memory.projectPath("file-versions");

function validateId(id) {
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("Version invalide.");
    return id;
}

async function scan(workspace) {
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    const relativeRoot = path.relative(path.resolve(workspace), path.resolve(root()));
    if (!relativeRoot || (!relativeRoot.startsWith(`..${path.sep}`) && relativeRoot !== ".." && !path.isAbsolute(relativeRoot))) {
        throw new Error("Le stockage des versions se trouve dans le projet : sauvegarde impossible.");
    }
    const files = Object.create(null);
    const excludedPaths = [];
    let excluded = 0;
    const markExcluded = rel => { excluded++; excludedPaths.push(rel); };
    async function visit(dir, prefix) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (EXCLUDED.has(entry.name.toLowerCase()) || entry.isSymbolicLink()) { markExcluded(rel); continue; }
            try { normalizeRelative(rel); } catch { markExcluded(rel); continue; }
            const { target } = await resolveInWorkspace(workspace, rel);
            const info = await fs.lstat(target);
            if (info.isSymbolicLink()) { markExcluded(rel); continue; }
            if (info.isDirectory()) { await visit(target, rel); continue; }
            if (!info.isFile()) { markExcluded(rel); continue; }
            await assertRealInside(workspace, target);
            const content = await fs.readFile(target);
            const after = await fs.lstat(target);
            if (!after.isFile() || after.isSymbolicLink() || info.size !== after.size || info.mtimeMs !== after.mtimeMs || info.ino !== after.ino) throw new Error(`${rel} a changé pendant la sauvegarde. Réessaie.`);
            files[rel] = { hash: digest(content), size: content.length, mode: info.mode & 0o777, content };
        }
    }
    await visit(workspace, "");
    return { files, excluded, excludedPaths };
}

function fingerprint(files, excludedPaths = []) {
    return digest(JSON.stringify([Object.keys(files).sort().map(rel => [rel, files[rel].hash, files[rel].mode]), [...excludedPaths].sort()]));
}

async function list() {
    let names;
    try { names = await fs.readdir(root()); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    const points = [];
    for (const name of names) {
        if (!/^[a-f0-9-]{36}$/.test(name)) continue;
        try {
            const point = JSON.parse(await fs.readFile(path.join(root(), name, "manifest.json"), "utf8"));
            if (point.id === name && point.version === 1 && point.files && typeof point.files === "object") points.push(point);
        } catch (error) {
            if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
        }
    }
    return points.sort((a, b) => b.at.localeCompare(a.at));
}

async function save(workspace, task, kind = "prompt", captured = null) {
    const points = await list();
    if (kind !== "safety" && points.filter(point => point.kind !== "safety").length >= MAX_POINTS) throw new Error(`Limite de ${MAX_POINTS} versions avant demande atteinte ; supprime d'anciennes versions avant de continuer.`);
    const snapshot = captured || await scan(workspace);
    const id = crypto.randomUUID();
    const dir = path.join(root(), id);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    try {
        const files = Object.create(null);
        for (const [rel, file] of Object.entries(snapshot.files)) {
            files[rel] = { hash: file.hash, size: file.size, mode: file.mode };
            try { await fs.writeFile(path.join(dir, file.hash), file.content, { flag: "wx", mode: 0o600 }); }
            catch (error) { if (error.code !== "EEXIST") throw error; }
        }
        const point = { version: 1, id, at: new Date().toISOString(), task: String(task || "").replace(/\s+/g, " ").trim().slice(0, 120), kind, workspace, excluded: snapshot.excluded, excludedPaths: snapshot.excludedPaths, files };
        await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(point), { flag: "wx", mode: 0o600 });
        return point;
    } catch (error) {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
        throw error;
    }
}

async function get(workspace, id) {
    validateId(id);
    const point = JSON.parse(await fs.readFile(path.join(root(), id, "manifest.json"), "utf8"));
    if (point.version !== 1 || point.id !== id || point.workspace !== workspace || !point.files || typeof point.files !== "object" || Array.isArray(point.files)) throw new Error("Version invalide pour ce projet.");
    if (!Array.isArray(point.excludedPaths) || point.excludedPaths.some(rel => typeof rel !== "string")) throw new Error("Version sans liste fiable des exclusions : restauration impossible.");
    point.files = Object.assign(Object.create(null), point.files);
    for (const [rel, file] of Object.entries(point.files)) {
        if (normalizeRelative(rel) !== rel || rel.split("/").some(part => EXCLUDED.has(part.toLowerCase())) || !file || !/^[a-f0-9]{64}$/.test(file.hash) || !Number.isInteger(file.mode) || file.mode < 0 || file.mode > 0o777) throw new Error("La version contient une entrée invalide.");
    }
    return point;
}

function differences(before, current) {
    const paths = [...new Set([...Object.keys(before), ...Object.keys(current)])].sort();
    return paths.filter(rel => !before[rel] || !current[rel] || before[rel].hash !== current[rel].hash || before[rel].mode !== current[rel].mode).map(rel => ({
        path: rel,
        action: !before[rel] ? "retirer" : !current[rel] ? "rétablir" : "restaurer"
    }));
}

function checkedDifferences(point, current) {
    const changes = differences(point.files, current.files);
    const normalize = rel => process.platform === "win32" ? rel.toLowerCase() : rel;
    const excluded = [...point.excludedPaths, ...current.excludedPaths].map(normalize);
    const changedPaths = new Set(changes.map(change => normalize(change.path)));
    for (const rel of changedPaths) {
        const parts = rel.split("/");
        for (let i = 1; i < parts.length; i++) {
            const parent = parts.slice(0, i).join("/");
            if (changedPaths.has(parent)) throw new Error(`Restauration impossible : ${parent} a changé entre fichier et dossier. Réorganise ces chemins avant de réessayer.`);
        }
    }
    for (const change of changes) {
        const rel = normalize(change.path);
        if (excluded.some(item => rel === item || rel.startsWith(`${item}/`) || item.startsWith(`${rel}/`))) {
            throw new Error(`Restauration impossible : ${change.path} chevauche un chemin exclu de la sauvegarde ou de l’état actuel.`);
        }
    }
    return changes;
}

async function preview(workspace, id) {
    const point = await get(workspace, id);
    const current = await scan(workspace);
    const changes = checkedDifferences(point, current);
    return { id, task: point.task, changes, expected: fingerprint(current.files, current.excludedPaths), excluded: current.excluded, savedExcluded: point.excluded, excludedPaths: [...new Set([...point.excludedPaths, ...current.excludedPaths])].sort() };
}

async function restore(workspace, id, expected) {
    if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) throw new Error("Aperçu de restauration manquant.");
    const point = await get(workspace, id);
    const current = await scan(workspace);
    if (fingerprint(current.files, current.excludedPaths) !== expected) throw new Error("Le projet a changé depuis l'aperçu. Actualise-le avant de restaurer.");
    const changes = checkedDifferences(point, current);
    if (!changes.length) return { restored: 0 };
    for (const change of changes) {
        const { target } = await resolveInWorkspace(workspace, change.path);
        await assertRealInside(workspace, target);
        if (point.files[change.path]) {
            const content = await fs.readFile(path.join(root(), id, point.files[change.path].hash));
            if (digest(content) !== point.files[change.path].hash) throw new Error(`Sauvegarde endommagée : ${change.path}.`);
        }
    }
    const safety = await save(workspace, `Avant restauration : ${point.task}`, "safety", current);
    let restored = 0;
    try {
        for (const change of changes) {
            const { target } = await resolveInWorkspace(workspace, change.path);
            await assertRealInside(workspace, target);
            const old = current.files[change.path];
            if (old) {
                const info = await fs.lstat(target);
                if (!info.isFile() || info.isSymbolicLink() || digest(await fs.readFile(target)) !== old.hash) throw new Error(`${change.path} a changé pendant la restauration.`);
            } else {
                try { await fs.lstat(target); throw new Error(`${change.path} existe désormais.`); }
                catch (error) { if (error.code !== "ENOENT") throw error; }
            }
            const saved = point.files[change.path];
            if (!saved) {
                await fs.unlink(target);
            } else {
                const content = await fs.readFile(path.join(root(), id, saved.hash));
                if (digest(content) !== saved.hash) throw new Error(`Sauvegarde endommagée : ${change.path}.`);
                await fs.mkdir(path.dirname(target), { recursive: true });
                await resolveInWorkspace(workspace, change.path);
                await assertRealInside(workspace, target);
                if (!old) await fs.writeFile(target, content, { flag: "wx", mode: saved.mode });
                else {
                    const tmp = path.join(path.dirname(target), `.frst-restore-${crypto.randomUUID()}.tmp`);
                    try {
                        await fs.writeFile(tmp, content, { flag: "wx", mode: saved.mode });
                        if (digest(await fs.readFile(target)) !== old.hash) throw new Error(`${change.path} a changé pendant la restauration.`);
                        await fs.rename(tmp, target);
                    } finally { await fs.rm(tmp, { force: true }); }
                }
            }
            memory.dropPath(change.path);
            restored++;
        }
    } catch (error) {
        throw new Error(`Restauration interrompue après ${restored} fichier(s) : ${error.message}. La version de sécurité « ${safety.task} » est disponible.`, { cause: error });
    }
    return { restored, safetyId: safety.id };
}

async function remove(workspace, id) {
    await get(workspace, id);
    await fs.rm(path.join(root(), id), { recursive: true });
}

module.exports = { save, list, preview, restore, remove };
