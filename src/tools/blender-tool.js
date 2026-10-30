"use strict";

/**
 * Outil blender : détecte Blender, analyse un GLB, produit un rendu de contrôle et
 * exécute un script Python du projet en mode --background.
 *
 * Les chemins restent dans le projet. Le modèle ne peut pas passer d'arguments arbitraires :
 * seuls ceux validés ici sont transmis au script (via "--" séparateur Blender).
 */

const fs = require("node:fs");
const path = require("node:path");

const { state } = require("../state");
const { ui } = require("../ui-bridge");
const { requireString, optionalInt } = require("./core/args");
const sandbox = require("./sandbox");
const blender = require("./blender");

const ACTIONS = ["detect", "inspect", "validate", "render", "script", "templates", "manifest", "import_roblox", "export_blender"];
const trusted = new Set();

function insideProject(workspace, file) {
    const abs = path.resolve(workspace, String(file || ""));
    const rel = path.relative(workspace, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Chemin hors du projet : ${file}`);
    return abs;
}

function argList(value, name) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 24 || value.some(item => typeof item !== "string" || item.length > 200)) {
        throw new Error(`${name} doit être une liste de 24 chaînes maximum.`);
    }
    return value;
}

function checkArgs(args = {}) {
    if (!ACTIONS.includes(args.action)) throw new Error(`action doit valoir ${ACTIONS.join(", ")}.`);
    if (["inspect", "validate", "render", "script", "manifest", "export_blender"].includes(args.action)) requireString(args.path, "path");
    if (args.output !== undefined) requireString(args.output, "output");
    if (args.name !== undefined) requireString(args.name, "name");
    optionalInt(args.timeout_ms, "timeout_ms");
    argList(args.script_args, "script_args");
}

async function runBlender(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    checkArgs(args);

    if (args.action === "templates") {
        const templates = blender.listTemplates();
        return {
            templates,
            message: templates.length
                ? `${templates.length} modèle(s) Blender disponibles : ${templates.map(item => item.name).join(", ")}. Copie-les dans le projet avec read_file, adapte-les, puis lance action:"script".`
                : "Aucun modèle Blender trouvé dans src/blender/templates."
        };
    }

    if (args.action === "detect") {
        const result = await blender.detectBlender(workspace);
        if (result.found) {
            const templates = blender.listTemplates().map(item => item.name);
            result.templates = templates;
            result.message += ` ${templates.length} modèle(s) prêts : ${templates.join(", ")}.`;
        }
        return result;
    }

    if (args.action === "inspect") {
        const abs = insideProject(workspace, args.path);
        if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${args.path}`);
        const report = blender.inspectGlb(abs);
        report.path = sandbox.relativeTo(workspace, abs);
        report.manifest = blender.readManifest(abs);
        report.message = blender.describeGlb(report);
        return report;
    }

    if (args.action === "manifest") {
        const abs = insideProject(workspace, args.path);
        if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${args.path}`);
        const report = blender.inspectGlb(abs);
        if (!report.valid) throw new Error(`GLB invalide : ${report.error}`);
        const written = blender.writeManifest(workspace, abs, report, { name: args.name });
        return {
            ...written,
            message: `Manifeste écrit dans ${written.file} : ${written.manifest.name}, ${written.manifest.size_studs ? `${written.manifest.size_studs.x}×${written.manifest.size_studs.y}×${written.manifest.size_studs.z} studs` : "taille inconnue"}, ${report.triangles} triangle(s).`
        };
    }

    const found = sandbox.findBlender(workspace);
    if (!found) {
        const detection = await blender.detectBlender(workspace);
        return { ...detection, blocked: true, message: `${detection.message} Le rendu et l'exécution de scripts nécessitent Blender installé.` };
    }

    if (args.action === "validate") {
        const abs = insideProject(workspace, args.path);
        if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${args.path}`);
        const harness = path.join(blender.TEMPLATE_DIR, "validate_model.py");
        const res = await sandbox.runProcess(
            found.path,
            ["--background", "--factory-startup", "--python", harness, "--", "--input", abs],
            { cwd: workspace, timeoutMs: args.timeout_ms ?? 180000 }
        );
        const parsed = blender.parseMarker(res.output, "VALIDATE");
        if (!parsed) {
            return {
                status: res.timed_out ? "timeout" : "failed",
                exit_code: res.exit_code,
                output: res.output.slice(-4000),
                problems: [],
                message: "La validation Blender n'a rien renvoyé d'exploitable : lis output. Un modèle n'est pas validé dans ce cas."
            };
        }
        const problems = parsed.problems || [];
        return {
            status: problems.length ? "failed" : "ok",
            exit_code: res.exit_code,
            path: sandbox.relativeTo(workspace, abs),
            meshes: parsed.meshes,
            triangles: parsed.triangles,
            size_studs: parsed.size_studs,
            problems,
            ok: problems.length === 0,
            message: problems.length
                ? `Validation Blender : ${problems.length} problème(s) à corriger. ${problems.slice(0, 5).join(" ")}`
                : `Modèle valide dans Blender : ${parsed.triangles} triangle(s), UV présentes, normales cohérentes${parsed.size_studs ? `, ${parsed.size_studs.x}×${parsed.size_studs.y}×${parsed.size_studs.z} studs` : ""}.`
        };
    }

    if (args.action === "export_blender") {
        const abs = insideProject(workspace, args.path);
        if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${args.path}`);
        if (!trusted.has(workspace)) {
            const ok = await ui.confirm(`Exporter ${args.path} avec Blender en arrière-plan ? Blender lit le fichier et écrit un GLB dans le projet.`);
            if (!ok) return { denied: true, message: "Export Blender refusé par l'utilisateur." };
            trusted.add(workspace);
        }
        const outputDir = sandbox.relativeTo(workspace, args.output || "build/models");
        const harness = path.join(blender.TEMPLATE_DIR, "export_for_roblox.py");
        const argsList = ["--background", "--factory-startup", "--python", harness, "--", "--input", abs, "--output", insideProject(workspace, outputDir)];
        if (args.name) argsList.push("--name", args.name);
        const res = await sandbox.runProcess(found.path, argsList, { cwd: workspace, timeoutMs: args.timeout_ms ?? 300000 });
        const parsed = blender.parseMarker(res.output, "EXPORT");
        if (!parsed) {
            return { status: res.timed_out ? "timeout" : "failed", exit_code: res.exit_code, output: res.output.slice(-4000), message: "L'export Blender a échoué : lis output." };
        }
        return {
            status: "ok",
            exit_code: res.exit_code,
            ...parsed,
            message: `GLB écrit dans ${parsed.glb} (${parsed.triangles} triangle(s)${parsed.size_studs ? `, ${parsed.size_studs.x}×${parsed.size_studs.y}×${parsed.size_studs.z} studs` : ""}). Enchaîne avec inspect, validate puis render.`
        };
    }

    if (args.action === "render") {
        const input = insideProject(workspace, args.path);
        if (!fs.existsSync(input)) throw new Error(`Fichier introuvable : ${args.path}`);
        const output = sandbox.relativeTo(workspace, args.output || `.frst/blender/${path.basename(args.path).replace(/\.[^.]+$/, "")}.png`);
        const target = insideProject(workspace, output);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const harness = path.join(blender.TEMPLATE_DIR, "render_preview.py");
        const res = await sandbox.runProcess(
            found.path,
            ["--background", "--factory-startup", "--python", harness, "--", "--input", input, "--render", target],
            { cwd: workspace, timeoutMs: args.timeout_ms ?? 180000 }
        );
        const ok = res.exit_code === 0 && fs.existsSync(target);
        return {
            status: ok ? "ok" : res.timed_out ? "timeout" : "failed",
            exit_code: res.exit_code,
            preview: ok ? output : null,
            output: res.output.slice(-4000),
            message: ok
                ? `Rendu écrit dans ${output}. Examine-le avec view_image {path:"${output}"}.`
                : "Le rendu Blender a échoué : lis output, corrige le script puis relance."
        };
    }

    if (args.action === "import_roblox") {
        const abs = insideProject(workspace, args.path);
        if (!fs.existsSync(abs)) throw new Error(`Fichier introuvable : ${args.path}`);
        const report = blender.inspectGlb(abs);
        if (!report.valid) throw new Error(`GLB invalide, import impossible : ${report.error}`);
        const written = blender.writeManifest(workspace, abs, report, { name: args.name });
        const plan = blender.importPlan(workspace, abs, written.manifest);
        return {
            ...plan,
            manifest: written.manifest,
            manifestFile: written.file,
            glb: report,
            message: `Modèle prêt pour Roblox : ${plan.target}, manifeste ${written.file}. Dans Studio : Insert Object → Import 3D → ${written.manifest.glb}, puis place le MeshPart dans ${plan.target}.`
        };
    }

    // action: script
    const scriptAbs = insideProject(workspace, args.path);
    if (!fs.existsSync(scriptAbs)) throw new Error(`Script introuvable : ${args.path}`);
    if (!trusted.has(workspace)) {
        const ok = await ui.confirm(`Exécuter ${args.path} avec Blender en arrière-plan ? Le script Python s'exécute sur ta machine et peut écrire des fichiers du projet.`);
        if (!ok) return { denied: true, message: "Exécution Blender refusée par l'utilisateur." };
        trusted.add(workspace);
    }
    const extra = argList(args.script_args, "script_args");
    const res = await sandbox.runProcess(
        found.path,
        ["--background", "--factory-startup", "--python", scriptAbs, ...(extra.length ? ["--", ...extra] : [])],
        { cwd: workspace, timeoutMs: args.timeout_ms ?? 600000 }
    );
    const statsLine = /STATS\s+(\{.*\})/.exec(res.output);
    let stats = null;
    if (statsLine) {
        try { stats = JSON.parse(statsLine[1].replace(/'/g, "\"")); } catch { stats = null; }
    }
    const previewLine = /PREVIEW\s+(.+)$/m.exec(res.output);
    return {
        status: res.exit_code === 0 ? "ok" : res.timed_out ? "timeout" : "failed",
        exit_code: res.exit_code,
        stats,
        preview: previewLine ? sandbox.relativeTo(workspace, previewLine[1].trim()) : null,
        output: res.output.slice(-6000),
        message: res.exit_code === 0
            ? "Blender a terminé sans erreur. Vérifie le GLB avec action:\"inspect\" avant d'annoncer le résultat."
            : "Blender a échoué : lis output et corrige le script avant de relancer."
    };
}

function resetTrust() {
    trusted.clear();
}

module.exports = {
    name: "blender",
    run: runBlender,
    check: checkArgs,
    describe(a) {
        if (a.action === "script" || a.action === "render" || a.action === "inspect") return `${a.action} : ${a.path}`;
        return `Blender : ${a.action}`;
    },
    runBlender,
    checkArgs,
    resetTrust
};
