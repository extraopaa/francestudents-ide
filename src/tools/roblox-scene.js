"use strict";

/**
 * Outil roblox_scene : graphe de scène du jeu Roblox (lecture seule, sans confirmation).
 *
 * Renvoie où va chaque script, les remotes émis/écoutés, les tags, les services,
 * les modules orphelins et les points à vérifier (remote sans écoute serveur, boucles).
 */

const { state } = require("../state");
const { buildGraph, summarizeGraph, buildStudioTree } = require("./roblox-graph");

function checkArgs(args = {}) {
    if (args.detail !== undefined && typeof args.detail !== "boolean") {
        throw new Error("detail doit être true ou false.");
    }
    if (args.tree !== undefined && typeof args.tree !== "boolean") {
        throw new Error("tree doit être true ou false.");
    }
}

/** Arête de l'arbre affiché dans la barre latérale : services → Instances → fichiers. */
function compactTree(nodes, depth = 0) {
    return nodes.slice(0, 200).map(node => ({
        name: node.name,
        className: node.className,
        path: node.path || null,
        ...(node.init ? { init: node.init } : {}),
        ...(node.children && node.children.length && depth < 8 ? { children: compactTree(node.children, depth + 1) } : {})
    }));
}

async function runRobloxScene(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    checkArgs(args);

    if (args.tree === true) {
        const studio = buildStudioTree(workspace);
        return {
            roblox: Boolean(studio.project),
            project: studio.project,
            tree: compactTree(studio.services),
            warnings: studio.warnings,
            message: studio.project
                ? `Arbre Roblox Studio : ${studio.services.length} service(s) depuis ${studio.project}.`
                : "Aucun projet Rojo détecté (*.project.json absent)."
        };
    }

    const graph = buildGraph(workspace);
    const summary = summarizeGraph(graph, args.detail === false ? 0 : 60);
    const message = graph.roblox
        ? `Graphe Roblox : ${graph.counts.files} fichier(s) Luau, ${graph.remotes.length} remote(s), ${graph.problems.length} point(s) à vérifier.`
        : "Aucun projet Rojo détecté (*.project.json absent).";

    return {
        roblox: graph.roblox,
        project: graph.project,
        counts: graph.counts,
        scripts: args.detail === false ? graph.scripts.map(item => item.file) : graph.scripts,
        remotes: graph.remotes,
        tags: graph.tags,
        services: graph.services,
        modules: graph.modules,
        problems: graph.problems,
        summary,
        message
    };
}

module.exports = {
    name: "roblox_scene",
    run: runRobloxScene,
    check: checkArgs,
    describe: (a) => (a.tree === true ? "Arbre Roblox Studio" : a.detail === false ? "Graphe Roblox (résumé)" : "Graphe Roblox complet"),
    runRobloxScene,
    compactTree
};
