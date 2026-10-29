"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parseAgentResponse, extractJsonObject } = require("../src/agent/agent");
const { repairJsonText, normalizeActionShape, proseFinalAction, describeJsonFailure } = require("../src/agent/json-repair");
const { normalizeProgress, fitProgress, applyProgress } = require("../src/agent/plan-progress");

const fence = "\u0060\u0060\u0060";

test("une virgule finale et des retours à la ligne bruts sont réparés", () => {
    const text = '{"type":"tool","name":"list_directory","args":{"path":".",},"reason":"Lister\nle dossier",}';
    const action = parseAgentResponse(text);
    assert.equal(action.name, "list_directory");
    assert.equal(action.reason, "Lister\nle dossier");
});

test("les guillemets typographiques hors chaîne sont acceptés", () => {
    const action = extractJsonObject('{“type”:“final”,“message”:“ok”}');
    assert.equal(action.type, "final");
    assert.equal(action.message, "ok");
});

test("un final tronqué est fermé et marqué, un outil tronqué est refusé", () => {
    const truncatedFinal = extractJsonObject('{"type":"final","message":"Compte rendu coup');
    assert.equal(truncatedFinal.type, "final");
    assert.equal(truncatedFinal.truncated_response, true);
    assert.match(truncatedFinal.message, /Compte rendu/);

    const truncatedTool = extractJsonObject('{"type":"tool","name":"write_file","args":{"path":"a.js","content":"const a = ');
    assert.equal(truncatedTool, null);
    assert.match(describeJsonFailure('{"type":"tool","name":"write_file","args":{"path":"a.js","content":"const a = '), /tronqué/);
});

test("les alias de clés (tool, arguments, final_answer, content) sont normalisés", () => {
    const tool = parseAgentResponse('{"tool":"list_directory","arguments":{"path":"."}}');
    assert.equal(tool.type, "tool");
    assert.equal(tool.name, "list_directory");
    assert.deepEqual(tool.args, { path: "." });

    const final = parseAgentResponse('{"type":"final_answer","content":"Terminé","completed":"true"}');
    assert.equal(final.type, "final");
    assert.equal(final.message, "Terminé");
    assert.equal(final.completed, true);

    const batch = parseAgentResponse('{"calls":[{"tool":"read_file","arguments":{"path":"README.md"}}]}');
    assert.deepEqual(batch.calls, [{ name: "read_file", args: { path: "README.md" } }]);
});

test("un objet enveloppé, un tableau à un élément ou un bloc de code mal fermé sont lus", () => {
    assert.equal(extractJsonObject('{"action":{"type":"final","message":"ok"}}').message, "ok");
    assert.equal(extractJsonObject('[{"type":"final","message":"ok"}]').message, "ok");
    assert.equal(extractJsonObject(`${fence}json\n{"type":"final","message":"ok"}`).message, "ok");
});

test("un résultat d'outil recopié n'est pas pris pour une action", () => {
    assert.equal(extractJsonObject('{"tool":"read_file","ok":true,"result":{"content":"x"}}'), null);
    assert.equal(normalizeActionShape({ ok: false, error: "x" }).type, undefined);
});

test("une réponse strictement valide est lue exactement comme avant", () => {
    const text = JSON.stringify({ type: "tool", name: "read_file", args: { path: "a" }, reason: "Lire {\"x\":1}" });
    assert.deepEqual(extractJsonObject(text), JSON.parse(text));
    assert.deepEqual(repairJsonText(text), { text, truncated: false });
});

test("les erreurs de parse restent explicites pour la correction", () => {
    assert.match(describeJsonFailure(""), /vide/);
    assert.match(describeJsonFailure("Je vais lire le fichier."), /texte libre/);
    assert.throws(() => parseAgentResponse("pas de json"), /Aucun objet JSON/);
});

test("proseFinalAction ne s'applique qu'au texte libre sans accolade ni bloc de code", () => {
    assert.deepEqual(proseFinalAction("  Voici mon analyse.  "), { type: "final", message: "Voici mon analyse.", completed: false, unverified: true });
    assert.equal(proseFinalAction('Voici {"type":"tool"'), null);
    assert.equal(proseFinalAction(`${fence}js\nconsole.log(1)\n${fence}`), null);
    assert.equal(proseFinalAction(""), null);
});

test("plan_progress tolère les synonymes, objets, chaînes et doublons in_progress", () => {
    assert.deepEqual(normalizeProgress(["done", "En cours", "à faire"]), ["completed", "in_progress", "pending"]);
    assert.deepEqual(normalizeProgress([{ step: "a", status: "completed" }, { status: "todo" }]), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress('["completed","pending"]'), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress("completed, in_progress"), ["completed", "in_progress"]);
    assert.deepEqual(normalizeProgress([true, false]), ["completed", "pending"]);
    assert.deepEqual(normalizeProgress(["in_progress", "in_progress", "pending"]), ["pending", "in_progress", "pending"]);
    assert.equal(normalizeProgress(["invented"]), undefined);
    assert.equal(normalizeProgress([]), undefined);
    assert.equal(normalizeProgress(42), undefined);
});

test("fitProgress ajuste la taille au plan courant sans jamais lever", () => {
    const plan = [{ step: "a", status: "completed" }, { step: "b", status: "in_progress" }, { step: "c", status: "pending" }];
    assert.deepEqual(fitProgress(["completed", "completed"], plan), ["completed", "completed", "pending"]);
    assert.deepEqual(fitProgress(["completed", "completed", "in_progress", "pending"], plan), ["completed", "completed", "in_progress"]);
    assert.equal(fitProgress(["completed"], []), undefined);
    assert.equal(fitProgress(["bogus"], plan), undefined);
    assert.doesNotThrow(() => applyProgress(plan, ["bogus"]));
    assert.doesNotThrow(() => applyProgress([], ["completed"]));
});

test("parseAgentResponse ne rejette plus une action à cause d'un plan_progress illisible", () => {
    const action = parseAgentResponse('{"type":"tool","name":"list_directory","args":{"path":"."},"plan_progress":{"weird":true}}');
    assert.equal(action.name, "list_directory");
    assert.equal(action.plan_progress, undefined);
});
