"use strict";
const fs = require("node:fs/promises"), path = require("node:path"), { randomUUID } = require("node:crypto");
const MAX_BYTES = 4000000, MAX_FILES = 200;
async function readLocalSkill(selected) {
    const info = await fs.lstat(selected); if (info.isSymbolicLink()) throw new Error("Choisis un fichier ou dossier réel, sans lien symbolique.");
    const entries = []; let total = 0, visited = 0;
    function add(name, bytes) {
        total += bytes.length;
        if (entries.length >= MAX_FILES + 1 || total > MAX_BYTES) throw new Error("Le skill dépasse 200 ressources ou 4 Mo.");
        entries.push({ name, bytes });
    }
    if (info.isDirectory()) {
        async function visit(dir, prefix = "", depth = 0) {
            if (depth > 12) throw new Error("Le dossier du skill contient trop de niveaux.");
            for (const item of await fs.readdir(dir, { withFileTypes: true })) {
                if (++visited > 1000) throw new Error("Le dossier contient trop d’éléments. Choisis le dossier du skill uniquement.");
                if ([".git", "node_modules", "__pycache__", ".DS_Store"].includes(item.name)) continue;
                if (item.isSymbolicLink()) throw new Error("Les liens symboliques ne sont pas importés. Choisis un dossier sans liens.");
                const full = path.join(dir, item.name), name = prefix + item.name;
                if (item.isDirectory()) await visit(full, name + "/", depth + 1);
                else if (item.isFile()) { if ((await fs.stat(full)).size > MAX_BYTES) throw new Error("Une ressource dépasse 4 Mo."); add(name, await fs.readFile(full)); }
                else throw new Error("Le dossier contient un fichier spécial non pris en charge.");
            }
        }
        await visit(selected);
    } else if (info.isFile() && /\.zip$/i.test(selected)) {
        if (info.size > MAX_BYTES) throw new Error("L’archive dépasse 4 Mo.");
        const bytes = await fs.readFile(selected), { readZip } = require("../src/api/archive-input");
        const index = await readZip(bytes, { contents: false });
        if (index.length > 250 || index.reduce((n, item) => n + item.size, 0) > MAX_BYTES) throw new Error("Archive trop volumineuse après décompression.");
        for (const item of await readZip(bytes)) if (!item.directory) { if (!item.bytes) throw new Error("Une ressource est chiffrée ou illisible."); add(item.name, item.bytes); }
    } else if (info.isFile() && /\.md$/i.test(selected)) {
        if (info.size > 360000) throw new Error("Le SKILL.md est trop volumineux."); add("SKILL.md", await fs.readFile(selected));
    } else throw new Error("Choisis un SKILL.md, un dossier de skill ou une archive ZIP.");
    const instructions = entries.filter(item => /(?:^|\/)SKILL\.md$/i.test(item.name));
    if (instructions.length !== 1) throw new Error("Choisis un seul skill contenant exactement un SKILL.md. Pour une collection, importe chaque dossier séparément.");
    const skill = instructions[0], prefix = skill.name.slice(0, -8), content = skill.bytes.toString("utf8").replace(/^\uFEFF/, "");
    if (!content.trim() || content.length > 90000 || content.includes("\0")) throw new Error("Le SKILL.md est vide, binaire ou dépasse 90 000 caractères.");
    const files = entries.filter(item => item !== skill && item.name.startsWith(prefix)).map(item => ({ path: item.name.slice(prefix.length), data: item.bytes }));
    const meta = require("../src/skills").parseFrontmatter(content).meta;
    const name = String(meta.name || path.basename(info.isDirectory() ? selected : path.dirname(selected)) || "mon-skill").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "mon-skill";
    return { name, content: require("../src/skills").setFrontmatterValue(content, "disabled", "true"), files };
}
function createLocalSkillImporter() {
    const previews = new Map();
    return {
        async preview(selected) {
            const bundle = await readLocalSkill(selected), token = randomUUID();
            while (previews.size >= 4) previews.delete(previews.keys().next().value);
            previews.set(token, { bundle, at: Date.now() });
            return { token, name: bundle.name, content: bundle.content, resourceCount: bundle.files.length, resourceNames: bundle.files.map(file => file.path) };
        },
        get(token) { const entry = previews.get(token); if (!entry || Date.now() - entry.at > 600000) throw new Error("L’aperçu a expiré. Sélectionne à nouveau le skill."); return entry.bundle; },
        remove(token) { previews.delete(token); }
    };
}
module.exports = { readLocalSkill, createLocalSkillImporter };
