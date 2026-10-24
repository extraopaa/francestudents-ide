"use strict";
const { test } = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs/promises"), os = require("node:os"), path = require("node:path");
const { zipSync, strToU8 } = require("fflate");
const { readLocalSkill, createLocalSkillImporter } = require("../desktop/local-skill-import");
const content = "---\nname: local-qa\ndescription: Local skill QA\n---\n\nRead references/guide.md";
test("local skill imports a ZIP bundle with resources, disabled, without extracting beside the source", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "frst-skill-zip-"));
    try {
        const file = path.join(dir, "download.zip");
        await fs.writeFile(file, zipSync({ "my-skill/SKILL.md": strToU8(content), "my-skill/references/guide.md": strToU8("Reference"), "my-skill/scripts/run.sh": strToU8("echo hello") }));
        const importer = createLocalSkillImporter(), preview = await importer.preview(file), bundle = importer.get(preview.token);
        assert.equal(preview.name, "local-qa"); assert.equal(preview.resourceCount, 2);
        assert.match(bundle.content, /disabled: true/); assert.equal(bundle.files[0].data.toString(), "Reference");
        assert.deepEqual(await fs.readdir(dir), ["download.zip"]);
        importer.remove(preview.token); assert.throws(() => importer.get(preview.token), /expiré/);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
test("local skill supports a folder and standalone Markdown, rejects ambiguous collections and traversal", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "frst-skill-folder-"));
    try {
        const file = path.join(dir, "SKILL.md"); await fs.writeFile(file, content);
        await fs.mkdir(path.join(dir, "references")); await fs.writeFile(path.join(dir, "references/guide.md"), "Guide");
        assert.equal((await readLocalSkill(dir)).files.length, 1);
        assert.equal((await readLocalSkill(file)).files.length, 0);
        const zip = path.join(dir, "bad.zip");
        await fs.writeFile(zip, zipSync({ "one/SKILL.md": strToU8(content), "two/SKILL.md": strToU8(content) }));
        await assert.rejects(readLocalSkill(zip), /exactement un SKILL/);
        await fs.writeFile(zip, zipSync({ "../outside.md": strToU8("no"), "SKILL.md": strToU8(content) }));
        await assert.rejects(readLocalSkill(zip), /chemin|relative path/i);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
