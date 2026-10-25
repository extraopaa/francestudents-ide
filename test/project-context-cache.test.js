"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const memory = require("../src/project/memory");
const api = require("../src/api/api");
const { setUiBackend, getUiBackend } = require("../src/ui-bridge");
const projectContext = require("../src/project/project-context");

test("explicit local-only loading never calls AI, while a forced summary remains available",async()=>{
    const {root,workspace,data}=await makeDirs();
    const previous={projectPath:memory.projectPath,request:api.requestModel};let calls=0;
    memory.projectPath=name=>path.join(data,name);
    api.requestModel=async()=>{calls++;return "### a.js\nRésumé explicitement demandé";};
    setUiBackend({...getUiBackend(),spinner:()=>({stop(){}})});
    try{
        await fs.writeFile(path.join(workspace,"a.js"),"const first = 1;\n");
        const first=await projectContext.load(workspace,{summarize:false});
        assert.equal(calls,0);assert.match(first.status,/aucun appel IA/);
        assert.match(projectContext.promptContext(),/const first = 1/);
        await fs.writeFile(path.join(workspace,"a.js"),"const updated = 2;\n");
        await projectContext.load(workspace,{summarize:false});assert.equal(calls,0);
        assert.match(projectContext.promptContext(),/const updated = 2/);
        await projectContext.load(workspace,{force:true});assert.equal(calls,1);
        await projectContext.load(workspace);assert.equal(calls,1);
        assert.match(projectContext.resumeText(),/Résumé explicitement demandé/);
    }finally{
        memory.projectPath=previous.projectPath;api.requestModel=previous.request;
        setUiBackend(null);projectContext.clear();await fs.rm(root,{recursive:true,force:true});
    }
});

test("project loading is local by default; explicit analysis reuses cache and updates changed files",async()=>{
    const {root,workspace,data}=await makeDirs();
    const previous={projectPath:memory.projectPath,request:api.requestModel};let calls=0;
    memory.projectPath=name=>path.join(data,name);api.requestModel=async()=>{calls++;return `### a.js\nAutomatic summary ${calls}`;};
    setUiBackend({...getUiBackend(),spinner:()=>({stop(){}})});
    try{
        await fs.writeFile(path.join(workspace,"a.js"),"const first = 1;");
        await projectContext.load(workspace);assert.equal(calls,0);
        assert.match(projectContext.resumeText(),/Index local pr[êe]t/);
        await projectContext.load(workspace,{summarize:true});assert.equal(calls,1);
        await projectContext.load(workspace,{summarize:true});assert.equal(calls,1);
        await fs.writeFile(path.join(workspace,"a.js"),"const changed = 2;");
        await projectContext.load(workspace,{summarize:true});assert.equal(calls,2);
        assert.match(projectContext.resumeText(),/Automatic summary 2/);
    }finally{memory.projectPath=previous.projectPath;api.requestModel=previous.request;setUiBackend(null);projectContext.clear();await fs.rm(root,{recursive:true,force:true});}
});

test("changer la taille des extraits invalide les résumés du cache", async () => {
    const {root, workspace, data} = await makeDirs();
    const {CONFIG} = require("../src/config");
    const oldLimit = CONFIG.contextFileChars;
    const oldPath = memory.projectPath;
    const oldRequest = api.requestModel;
    let calls = 0;
    memory.projectPath = name => path.join(data, name);
    api.requestModel = async () => {calls++; return "### a.js\nRésumé QA";};
    setUiBackend({...getUiBackend(), spinner:() => ({stop(){}})});
    try {
        await fs.writeFile(path.join(workspace, "a.js"), "const a = 'abcdefghijklmnopqrstuvwxyz';");
        CONFIG.contextFileChars = 10;
        await projectContext.load(workspace,{summarize:true});
        CONFIG.contextFileChars = 20;
        await projectContext.load(workspace,{summarize:true});
        assert.equal(calls, 2, "un extrait différent doit être résumé à nouveau");
    } finally {
        CONFIG.contextFileChars = oldLimit;
        memory.projectPath = oldPath;
        api.requestModel = oldRequest;
        setUiBackend(null);
        projectContext.clear();
        await fs.rm(root, {recursive:true, force:true});
    }
});

async function makeDirs() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "frst-ctx-"));
    const workspace = path.join(root, "ws");
    const data = path.join(root, "data");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(data, { recursive: true });
    return { root, workspace, data };
}

test("snapshot : l'empreinte ne change pas si seule la date change", async () => {
    const { root, workspace } = await makeDirs();

    try {
        const file = path.join(workspace, "a.js");
        await fs.writeFile(file, "const a = 1;\n");

        const first = await projectContext.snapshot(workspace);
        const later = new Date(Date.now() + 60_000);
        await fs.utimes(file, later, later);
        const touched = await projectContext.snapshot(workspace);
        assert.equal(touched.fingerprint, first.fingerprint);

        await fs.writeFile(file, "const a = 2;\n");
        const changed = await projectContext.snapshot(workspace);
        assert.notEqual(changed.fingerprint, first.fingerprint);
    } finally {
        await fs.rm(root, { recursive: true, force: true });
    }
});

test("splitSections découpe les sections ### et ignore les chemins inconnus", () => {
    const text = [
        "Intro",
        "### `src/a.js`",
        "Rôle de a",
        "### ./src/b.js",
        "Rôle de b",
        "### autre.js",
        "Ignoré"
    ].join("\n");

    const sections = projectContext.splitSections(text, ["src/a.js", "src/b.js"]);

    assert.equal(sections.size, 2);
    assert.equal(sections.get("src/a.js"), "### src/a.js\nRôle de a");
    assert.equal(sections.get("src/b.js"), "### src/b.js\nRôle de b");
});

test("load ne renvoie à l'IA que les fichiers modifiés", async () => {
    const { root, workspace, data } = await makeDirs();
    const saved = {
        projectPath: memory.projectPath,
        requestModel: api.requestModel
    };
    const sent = [];
    let version = 0;

    memory.projectPath = name => path.join(data, name);
    setUiBackend({
        ...getUiBackend(),
        spinner: () => ({ stop() {} })
    });
    api.requestModel = async prompt => {
        version++;
        const rels = [...prompt.matchAll(/=== FICHIER (\S+) \(/g)].map(m => m[1]);
        sent.push(rels);
        return rels.map(rel => `### ${rel}\nRésumé de ${rel} v${version}`).join("\n\n");
    };

    try {
        await fs.writeFile(path.join(workspace, "a.js"), "const a = 1;\n");
        await fs.writeFile(path.join(workspace, "b.js"), "const b = 1;\n");

        await projectContext.load(workspace,{summarize:true});
        assert.deepEqual(sent, [["a.js", "b.js"]]);

        await fs.writeFile(path.join(workspace, "b.js"), "const b = 2;\n");
        const second = await projectContext.load(workspace,{summarize:true});
        assert.deepEqual(sent[1], ["b.js"]);
        assert.match(second.status, /1 fichier\(s\) repris du cache/);

        const resume = projectContext.resumeText();
        assert.match(resume, /Résumé de a\.js v1/);
        assert.match(resume, /Résumé de b\.js v2/);

        await projectContext.load(workspace,{summarize:true});
        assert.equal(sent.length, 2);

        await projectContext.load(workspace, { force: true });
        assert.deepEqual(sent[2], ["a.js", "b.js"]);
    } finally {
        memory.projectPath = saved.projectPath;
        api.requestModel = saved.requestModel;
        setUiBackend(null);
        projectContext.clear();
        await fs.rm(root, { recursive: true, force: true });
    }
});
