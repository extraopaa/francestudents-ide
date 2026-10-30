"use strict";

/**
 * Support Blender pour Roblox.
 *
 * - detect : trouve l'exécutable (PATH, blender.json, emplacements standard) et sa version.
 * - inspect : lit réellement un GLB (en-tête glTF + JSON) et compte meshes, triangles,
 *   matériaux et textures. Un fichier tronqué est signalé comme invalide.
 * - Python côté Blender : src/blender/templates/*.py servent de base fiable à l'agent.
 */

const fs = require("node:fs");
const path = require("node:path");

const sandbox = require("./sandbox");

const TEMPLATE_DIR = path.join(__dirname, "..", "blender", "templates");
const GLB_MAGIC = 0x46546c67; // "glTF"
const MAX_GLB_JSON = 64 * 1024 * 1024;

/** Détecte Blender et sa version réelle. Ne lance Blender qu'avec --version (rapide, sans fichier). */
async function detectBlender(workspace) {
    const found = sandbox.findBlender(workspace);
    if (!found) {
        return {
            found: false,
            message: "Blender introuvable. Installe-le, ajoute-le au PATH, ou indique son chemin dans blender.json ({ \"executable\": \"C:/…/blender.exe\" })."
        };
    }
    const res = await sandbox.runProcess(found.path, ["--version"], { timeoutMs: 20000 });
    const version = /Blender\s+(\d+\.\d+(?:\.\d+)?)/i.exec(res.output)?.[1] || null;
    return {
        found: true,
        path: found.path,
        source: found.source,
        version,
        status: res.exit_code === 0 ? "ok" : "failed",
        message: version
            ? `Blender ${version} détecté (${found.source}).`
            : `Blender trouvé (${found.source}) mais sa version n'a pas pu être lue.`
    };
}

/** Liste les modèles Python disponibles pour l'agent. */
function listTemplates() {
    try {
        return fs.readdirSync(TEMPLATE_DIR)
            .filter(name => name.endsWith(".py"))
            .sort()
            .map(name => {
                const full = path.join(TEMPLATE_DIR, name);
                const head = fs.readFileSync(full, "utf8").split(/\r?\n/).slice(0, 6).join(" ");
                return {
                    name,
                    path: path.join(TEMPLATE_DIR, name),
                    description: (/"""([\s\S]*?)"""/.exec(head)?.[1] || head).replace(/\s+/g, " ").trim().slice(0, 160)
                };
            });
    } catch {
        return [];
    }
}

/**
 * Lit un GLB sans Blender : en-tête, JSON de scène, accesseurs.
 * Renvoie { valid, version, bytes, meshes, primitives, triangles, materials, textures, images, nodes, problems }.
 */
function inspectGlb(file) {
    let buffer;
    try {
        buffer = fs.readFileSync(file);
    } catch (error) {
        return { valid: false, error: `Fichier illisible : ${error.message}` };
    }
    const problems = [];
    if (buffer.length < 20) return { valid: false, error: "Fichier trop petit pour être un GLB." };

    const magic = buffer.readUInt32LE(0);
    if (magic !== GLB_MAGIC) {
        const head = buffer.subarray(0, 4).toString("ascii");
        return { valid: false, error: `Ce n'est pas un GLB (en-tête « ${head} »). Un GLTF .gltf est du JSON : exporte en .glb.` };
    }

    const version = buffer.readUInt32LE(4);
    const declared = buffer.readUInt32LE(8);
    if (version !== 2) problems.push(`Version glTF ${version} : Roblox attend glTF 2.0.`);
    if (declared !== buffer.length) problems.push(`Taille déclarée ${declared} octets, fichier réel ${buffer.length} : export tronqué ?`);

    // Premier chunk = JSON.
    const chunkLength = buffer.readUInt32LE(12);
    const chunkType = buffer.readUInt32LE(16);
    if (chunkType !== 0x4e4f534a) return { valid: false, error: "Premier chunk GLB différent de JSON : fichier corrompu." };
    if (20 + chunkLength > buffer.length) return { valid: false, error: "Chunk JSON incomplet : fichier tronqué." };

    let json;
    try {
        json = JSON.parse(buffer.subarray(20, 20 + Math.min(chunkLength, MAX_GLB_JSON)).toString("utf8").replace(/\u0000+$/g, "").trim());
    } catch (error) {
        // Une fenêtre de lecture limitée peut couper le JSON : on retente sur le chunk entier.
        try {
            json = JSON.parse(buffer.subarray(20, 20 + Math.min(chunkLength, buffer.length - 20)).toString("utf8").replace(/\u0000+$/g, "").trim());
        } catch {
            return { valid: false, error: `JSON de scène illisible : ${error.message}` };
        }
    }

    const accessors = Array.isArray(json.accessors) ? json.accessors : [];
    const meshes = Array.isArray(json.meshes) ? json.meshes : [];
    // Collections glTF lues une fois : servent à la fois aux problèmes et au rapport.
    const images = Array.isArray(json.images) ? json.images : [];
    const textures = Array.isArray(json.textures) ? json.textures : [];
    const materials = Array.isArray(json.materials) ? json.materials : [];
    let primitives = 0;
    let triangles = 0;
    let unindexedPoints = 0;

    for (const mesh of meshes) {
        for (const primitive of mesh.primitives || []) {
            primitives += 1;
            const mode = primitive.mode ?? 4;
            const count = primitive.indices !== undefined
                ? accessors[primitive.indices]?.count ?? 0
                : accessors[primitive.attributes?.POSITION]?.count ?? 0;
            if (primitive.indices === undefined) unindexedPoints += count;
            if (mode === 4) triangles += Math.floor(count / 3);
            else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
        }
    }

    if (!meshes.length) problems.push("Aucun mesh : le modèle serait vide dans Roblox.");
    if (Array.isArray(json.cameras) && json.cameras.length) problems.push(`${json.cameras.length} caméra(s) exportée(s) : à retirer avant import Roblox.`);
    if (Array.isArray(json.extensions?.KHR_lights_punctual?.lights) && json.extensions.KHR_lights_punctual.lights.length) {
        problems.push("Lumières exportées : inutiles dans Roblox, à retirer.");
    }

    if (textures.length > 4) problems.push(`${textures.length} textures : Roblox préfère peu de matériaux par modèle.`);
    if (materials.length > 5) problems.push(`${materials.length} matériaux : limite-toi à 5 couleurs (Roblox crée un sous-mesh par matériau).`);
    // L'importeur 3D de Roblox (Avatar → Import 3D) crée un MeshPart par surface :
    // plusieurs matériaux sans texture deviennent des couleurs distinctes du même mesh.
    // Avec texture, la couleur de base est remplacée par la texture dans Studio :
    // on le signale pour que l'agent ne promette pas des couleurs préservées.
    // Une texture déclarée mais sans image n'a aucun contenu : ce n'est pas une vraie texture.
    const realTextures = images.length ? textures.length : 0;
    if (materials.length > 1 && realTextures > 0) {
        problems.push("Plusieurs matériaux avec textures : l'importeur 3D de Roblox peut remplacer les couleurs de base par la texture. Pour garder la palette, exporte des couleurs sans texture, ou une seule texture cuite.");
    }

    // Taille en studs : glTF est en mètres, 1 stud = 0,28 m. Lue dans min/max de POSITION.
    let sizeStuds = null;
    for (const mesh of meshes) {
        for (const primitive of mesh.primitives || []) {
            const accessor = accessors[primitive.attributes?.POSITION];
            if (!accessor || !Array.isArray(accessor.min) || !Array.isArray(accessor.max)) continue;
            if (!sizeStuds) sizeStuds = { min: [...accessor.min], max: [...accessor.max] };
            for (let axis = 0; axis < 3; axis++) {
                sizeStuds.min[axis] = Math.min(sizeStuds.min[axis], accessor.min[axis]);
                sizeStuds.max[axis] = Math.max(sizeStuds.max[axis], accessor.max[axis]);
            }
        }
    }
    const size_studs = sizeStuds
        ? {
            x: Math.round(((sizeStuds.max[0] - sizeStuds.min[0]) / 0.28) * 100) / 100,
            y: Math.round(((sizeStuds.max[1] - sizeStuds.min[1]) / 0.28) * 100) / 100,
            z: Math.round(((sizeStuds.max[2] - sizeStuds.min[2]) / 0.28) * 100) / 100
        }
        : null;

    return {
        valid: true,
        version,
        bytes: buffer.length,
        scenes: Array.isArray(json.scenes) ? json.scenes.length : 0,
        nodes: Array.isArray(json.nodes) ? json.nodes.length : 0,
        meshes: meshes.length,
        primitives,
        triangles,
        unindexedPoints,
        materials: materials.length,
        multiMaterial: materials.length > 1 && realTextures === 0,
        materialNames: materials.map(material => material?.name).filter(Boolean).slice(0, 12),
        multi_material: materials.length > 1 && realTextures === 0,
        material_names: materials.map(material => material?.name).filter(Boolean).slice(0, 12),
        textures: textures.length,
        images: images.length,
        animated: Array.isArray(json.animations) && json.animations.length > 0,
        extensions: Object.keys(json.extensionsUsed || {}),
        size_studs,
        problems
    };
}

/** Résumé lisible d'un GLB, pour le compte rendu de l'agent. */
function describeGlb(report) {
    if (!report.valid) return `GLB invalide : ${report.error}`;
    const parts = [
        `${report.meshes} mesh(s)`,
        `${report.triangles.toLocaleString("fr-FR")} triangle(s)`,
        `${report.materials} matériau(x)`,
        `${report.images} image(s)`,
        `${(report.bytes / 1024 / 1024).toFixed(1)} Mo`
    ];
    if (report.animated) parts.push("animations incluses");
    if (report.size_studs) parts.push(`${report.size_studs.x}×${report.size_studs.y}×${report.size_studs.z} studs`);
    if (report.multi_material) parts.push(`palette de ${report.materials} couleurs importée comme surfaces du même MeshPart`);
    const problems = report.problems.length ? ` Points à corriger : ${report.problems.join(" ")}` : "";
    return `GLB valide (glTF ${report.version}) : ${parts.join(", ")}.${problems}`;
}

/** Lit une ligne marqueur (VALIDATE {...} / EXPORT {...}) écrite par un script Blender. */
function parseMarker(output, marker) {
    const line = new RegExp(`^${marker}\\s+(\\{.*\\})\\s*$`, "m").exec(String(output || ""));
    if (!line) return null;
    try { return JSON.parse(line[1]); } catch { return null; }
}

/** Chemin du manifeste d'un GLB : Coffre.glb -> Coffre.manifest.json */
function manifestPath(glbFile) {
    return glbFile.replace(/\.glb$/i, ".manifest.json");
}

/** Lit le manifeste d'un GLB s'il existe (taille en studs, catégorie, source). */
function readManifest(glbFile) {
    try { return JSON.parse(fs.readFileSync(manifestPath(glbFile), "utf8")); } catch { return null; }
}

/**
 * Écrit le manifeste d'un GLB : nom, taille en studs, catégorie, triangles, textures.
 * La taille vient du JSON glTF (min/max de l'accesseur POSITION) : elle reste juste sans Blender.
 */
function writeManifest(workspace, glbFile, report, options = {}) {
    const base = path.basename(glbFile, path.extname(glbFile));
    const name = options.name || base;
    const previous = readManifest(glbFile) || {};
    const manifest = {
        name,
        glb: path.relative(workspace, glbFile).split(path.sep).join("/"),
        category: options.category || previous.category || "model",
        triangles: report.triangles ?? previous.triangles ?? null,
        materials: report.materials ?? previous.materials ?? null,
        textures: report.textures ?? previous.textures ?? null,
        size_studs: report.size_studs || previous.size_studs || null,
        updated: new Date().toISOString()
    };
    const file = manifestPath(glbFile);
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    return { file: path.relative(workspace, file).split(path.sep).join("/"), manifest };
}

/**
 * Prépare l'import dans Roblox : copie le GLB et son manifeste dans un dossier Rojo
 * (ReplicatedStorage/Assets par défaut) et renvoie les étapes à suivre.
 */
function importPlan(workspace, glbFile, manifest) {
    const folder = path.join(workspace, "src", "ReplicatedStorage", "Assets");
    fs.mkdirSync(folder, { recursive: true });
    const targetGlb = path.join(folder, path.basename(glbFile));
    if (path.resolve(targetGlb) !== path.resolve(glbFile)) fs.copyFileSync(glbFile, targetGlb);
    const targetManifest = manifestPath(targetGlb);
    fs.writeFileSync(targetManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const relative = p => path.relative(workspace, p).split(path.sep).join("/");
    return {
        target: relative(targetGlb),
        manifestTarget: relative(targetManifest),
        size_studs: manifest.size_studs,
        steps: [
            `Dans Roblox Studio : Insert Object → Import 3D, choisis ${relative(targetGlb)}.`,
            "Renomme le MeshPart selon le manifeste et vérifie la taille en studs (View → Size).",
            "Pour versionner le modèle, garde le .glb et le .manifest.json à côté du projet Rojo."
        ]
    };
}

module.exports = { detectBlender, inspectGlb, describeGlb, listTemplates, parseMarker, readManifest, writeManifest, importPlan, manifestPath, TEMPLATE_DIR };
