"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const childProcess = require("node:child_process");
// Git discovery is unrelated to plan tracking; these fixtures are not repositories.
const originalExecFile = childProcess.execFile;
childProcess.execFile = (file, args, options, callback) => file === "git"
    ? queueMicrotask(() => callback(new Error("Not a Git fixture")))
    : originalExecFile(file, args, options, callback);
const { runAgent, parseAgentResponse } = require("../src/agent/agent");
childProcess.execFile = originalExecFile;
const { state, resetConversation } = require("../src/state");
const { setUiBackend } = require("../src/ui-bridge");
const { createDesktopBackend } = require("../desktop/backend");
const { TOOLS } = require("../src/tools/tools");
const api = require("../src/api/api");
const { validateProgress, progressPrompt } = require("../src/agent/plan-progress");

const plan = ["Examiner les données", "Vérifier le résultat"];
const tool = extra => ({ type: "tool", name: "list_directory", args: { path: "." }, reason: "Examiner les données", ...extra });
const final = extra => ({ type: "final", message: "Compte rendu", ...extra });

async function scenario(answers, { motion = false, eco = false, denied = false, stop = false } = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "frst-plan-test-"));
    const saved = { workspace: state.workspace, motionDesign: state.motionDesign, ecoMode: state.ecoMode, request: api.requestModel, list: TOOLS.list_directory.run, effect: TOOLS.effectcraft.run };
    const events = [], sent = [], executed = [];
    resetConversation(); state.workspace = dir; state.motionDesign = motion; state.ecoMode = eco;
    const backend = createDesktopBackend((name, payload) => { if (name === "agentActivity") events.push(payload); });
    setUiBackend(backend); backend.startRun("Suivre les étapes");
    TOOLS.list_directory.run = TOOLS.effectcraft.run = async args => { executed.push(args); return denied ? { denied: true, message: "Refus" } : { entries: [], message: "Données consultées" }; };
    api.requestModel = async message => {
        sent.push(message); state.chatIds.agent = "plan-test";
        assert.ok(answers.length, "unexpected extra model request");
        const answer = answers.shift();
        if (motion && answer.type === "tool" && answer.name !== "update_plan") {
            answer.name = "effectcraft"; answer.args = { method: "host.info", params: {} };
        }
        return JSON.stringify(answer);
    };
    try {
        await require("../src/project/memory").open(dir);
        const result = await runAgent("Examine les données et vérifie le résultat", { shouldStop: () => stop && executed.length > 0 });
        return { result, sent, executed, events, steps: structuredClone(state.agentPlan), activity: backend.activity() };
    } finally {
        api.requestModel = saved.request; TOOLS.list_directory.run = saved.list; TOOLS.effectcraft.run = saved.effect;
        resetConversation(); state.workspace = saved.workspace; state.motionDesign = saved.motionDesign; state.ecoMode = saved.ecoMode;
        setUiBackend(null); fs.rmSync(dir, { recursive: true, force: true });
    }
}

test("inline progress reaches desktop activity during code and motion work without extra requests", async () => {
    for (const motion of [false, true]) {
        const result = await scenario([
            tool({ plan }),
            tool({ args: { path: "next" }, plan_progress: ["completed", "in_progress"] }),
            final({ plan_progress: ["completed", "completed"] })
        ], { motion });
        assert.equal(result.sent.length, 3);
        assert.equal(result.executed.length, 2);
        assert.deepEqual(result.steps.map(step => step.status), ["completed", "completed"]);
        assert.ok(result.events.some(event => event?.steps?.[0]?.status === "completed" && event.steps[1].status === "in_progress"));
        assert.match(result.sent[1], /PLAN DE TRAVAIL ACTUEL/);
        assert.match(result.sent[2], /"step":"Examiner les données","status":"completed"/);
        assert.match(result.sent[2], /"step":"Vérifier le résultat","status":"in_progress"/);
    }
});

test("failures and interruption never auto-complete", async () => {
    const failed = await scenario([tool({ plan }), final({ completed: false, plan_progress: ["in_progress", "pending"] })], { denied: true });
    assert.equal(failed.result.completed, false);
    assert.equal(failed.steps.filter(step => step.status === "completed").length, 0);
    const interrupted = await scenario([tool({ plan })], { stop: true });
    assert.equal(interrupted.result.completed, false);
    assert.equal(interrupted.steps.filter(step => step.status === "completed").length, 0);
});

test("a false claim of missing project access triggers one local read and a concise retry", async () => {
    const recovered = await scenario([
        final({ message: "Je peux continuer à préparer les modifications, mais je n’ai pas accès à un outil permettant de lire ou modifier les fichiers du projet dans ce tour. Je ne peux donc pas poursuivre l’harmonisation directement ni vérifier son rendu." }),
        final({ message: "J’ai repris la demande à partir du dossier vérifié." })
    ]);
    assert.equal(recovered.sent.length, 2);
    assert.equal(recovered.executed.length, 1);
    assert.deepEqual(recovered.executed[0], { path: "." });
    assert.match(recovered.sent[1], /confirme l’accès à son contenu/);
});

test("alternative access denials trigger recovery without confusing an attachment limitation", async () => {
    for (const message of ["Je ne dispose pas des outils du projet.", "I do not have access to the project files.", "Je ne suis pas en mesure de lire les fichiers du projet.", "Je ne peux pas poursuivre l’inspection du projet avec les outils actuellement disponibles.", "Avec les outils disponibles, je ne peux pas examiner les fichiers du projet."]) {
        const result = await scenario([final({ message }), final({ message: "Dossier vérifié." })]);
        assert.equal(result.executed.length, 1);
        assert.equal(result.sent.length, 2);
    }
    const attachment = await scenario([final({ message: "Je ne peux pas lire la pièce jointe. Le projet reste inchangé.", completed: false })]);
    assert.equal(attachment.executed.length, 0);
    const unrelated = await scenario([final({ message: "Je ne peux pas consulter la pièce jointe avec les outils disponibles. Le projet reste inchangé.", completed: false })]);
    assert.equal(unrelated.sent.length, 1);
    assert.equal(unrelated.executed.length, 0);
});

test("local tool unavailability claims trigger a single safe recovery", async () => {
    for (const message of [
        "Les vérifications transmises indiquent que les 37 tests Electron passent avec une concurrence limitée. La suite unitaire a également réussi : 807 tests passés et 3 ignorés. Le lancement Electron sans limite de concurrence avait toutefois dépassé son délai.\n\nLa tâche reste inachevée : je ne peux pas exécuter les outils locaux ni vérifier le dépôt depuis cette interface. Je ne peux donc pas confirmer un push, une construction de release ou une publication. Il faut reprendre dans l’environnement du projet pour vérifier les changements, les pousser, puis construire et contrôler les fichiers avant publication.",
        "Je ne peux pas continuer l’exécution : les outils locaux nécessaires ne sont pas accessibles depuis cette conversation.",
        "Je ne peux donc pas utiliser les outils locaux."
    ]) {
        const recovered = await scenario([final({ message }), final({ message: "Dossier vérifié." })]);
        assert.equal(recovered.executed.length, 1);
        assert.equal(recovered.sent.length, 2);
        assert.deepEqual(recovered.executed[0], { path: "." });
        assert.match(recovered.sent[1], /confirme l’accès à son contenu/);
        assert.match(recovered.sent[1], /git status --short --branch/);
        assert.match(recovered.sent[1], /ne prouve ni que Git fonctionne ni que GitHub est connecté/);
        assert.match(recovered.sent[1], /Ne confirme aucun push, build ou publication sans résultat correspondant/);
    }
    const repeated = await scenario([
        final({ message: "Je ne peux pas exécuter les outils locaux." }),
        final({ message: "Je ne peux pas exécuter les outils locaux." })
    ]);
    assert.equal(repeated.executed.length, 1);
    assert.equal(repeated.result.completed, false);
    const denied = await scenario([final({ message: "Je ne peux pas exécuter les outils locaux." })], { denied: true });
    assert.equal(denied.executed.length, 1);
    assert.equal(denied.sent.length, 1);
    assert.equal(denied.result.completed, false);
    const attachment = await scenario([final({ message: "Je ne peux pas vérifier la pièce jointe avec les outils locaux.", completed: false })]);
    assert.equal(attachment.executed.length, 0);
});

test("a subsequent directory read is not treated as the recovery probe", async () => {
    const result = await scenario([
        final({ message: "Je n’ai pas accès aux fichiers du projet." }),
        tool({ args: { path: "next" } }),
        final({ message: "Terminé." })
    ]);
    assert.equal(result.executed.length, 2);
    assert.doesNotMatch(result.sent[2], /confirme l’accès à son contenu/);
});

test("a real user denial is never bypassed by workspace access recovery", async () => {
    const denied = await scenario([
        final({ message: "Je n’ai pas accès aux fichiers de ton projet." })
    ], { denied: true });
    assert.equal(denied.sent.length, 1);
    assert.equal(denied.executed.length, 1);
    assert.match(denied.result.message, /n’a pas abouti/);
    assert.match(denied.result.message, /aucun refus n’a été contourné/);
});

test("forgotten checkboxes cause no extra paid requests in normal or Eco mode", async () => {
    const ignored = await scenario([tool({ plan }), final()]);
    assert.equal(ignored.sent.length, 2);
    assert.equal(ignored.steps.filter(step => step.status === "completed").length, 0);
    const eco = await scenario([tool({ plan }), final()], { eco: true });
    assert.equal(eco.sent.length, 2);
    assert.equal(eco.steps.filter(step => step.status === "completed").length, 0);
});

test("progress stays inline without replaying tools or replacing the plan", async () => {
    const result = await scenario([
        tool({ plan }),
        tool({ plan: ["Ne pas remplacer le plan existant"], args: { path: "second" } }),
        tool({ args: { path: "third" } }),
        tool({ args: { path: "fourth" }, plan_progress: ["completed", "in_progress"] }),
        final({ plan_progress: ["completed", "completed"] })
    ]);
    assert.equal(result.sent.length, 5);
    assert.deepEqual(result.executed.map(args => args.path), [".", "second", "third", "fourth"]);
    assert.deepEqual(result.steps.map(step => step.step), plan);
    assert.match(result.sent[3], /PLAN DE TRAVAIL ACTUEL/);
});

test("legacy update_plan remains available and later initial-plan fields do not reset it", async () => {
    const result = await scenario([
        { type: "tool", name: "update_plan", args: { steps: plan.map((step, index) => ({ step, status: index ? "in_progress" : "completed" })) }, plan_progress: ["pending"] },
        tool({ plan: ["Ancien champ répété"] }),
        final({ plan_progress: ["completed", "completed"] })
    ]);
    assert.deepEqual(result.steps.map(step => step.step), plan);
    assert.equal(result.sent.length, 3);
});

test("a short plan checkpoint appears on requests 5 and 10, including protocol retries, without extra calls", async () => {
    const answers = Array.from({ length: 10 }, (_, index) => tool({ args: { path: `read-${index}` }, ...(index === 0 ? { plan } : {}) }));
    answers.splice(1, 0, { type: "tool", name: "unknown_tool", args: {} });
    answers.push(final({ plan_progress: ["completed", "completed"] }));
    const result = await scenario(answers);
    assert.equal(result.sent.length, 12);
    assert.equal(result.executed.length, 10);
    assert.deepEqual(result.sent.flatMap((prompt, index) => prompt.includes("POINT PLAN") ? [index + 1] : []), [5, 10]);
    assert.deepEqual(result.steps.map(step => step.status), ["completed", "completed"]);
});

test("protocol validates progress for tools, batches and final answers and includes it after context restart", () => {
    for (const action of [tool({}), { type: "tool", calls: [{ name: "list_directory", args: {} }] }, final()]) {
        assert.deepEqual(parseAgentResponse(JSON.stringify({ ...action, plan_progress: ["completed", "pending"] })).plan_progress, ["completed", "pending"]);
        assert.throws(() => parseAgentResponse(JSON.stringify({ ...action, plan_progress: ["invented"] })));
    }
    assert.throws(() => validateProgress(["completed"], plan));
    assert.throws(() => validateProgress(["in_progress", "in_progress"], plan));
    const { buildAgentPrompt } = require("../src/agent/prompt");
    const prompt = buildAgentPrompt({ workspace: null, task: "Continuer", history: [], observations: [], plan: plan.map(step => ({ step, status: "pending" })) });
    assert.match(prompt, /PLAN DE TRAVAIL ACTUEL/);
    assert.match(progressPrompt([]), /plan_progress/);
});
