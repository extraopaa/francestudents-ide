"use strict";

/**
 * Outil rojo_serve : démarre, arrête ou inspecte le serveur Rojo de synchronisation Studio.
 *
 * Actions :
 * - status : état courant (port réel, Studio connecté ou non, dernières lignes du serveur) ;
 * - start  : lance `rojo serve` sur le projet ouvert et réserve un port libre ;
 * - stop   : arrête le serveur ;
 * - connect: renvoie l'adresse exacte à saisir dans le plugin Rojo de Studio.
 *
 * Le serveur écoute uniquement sur 127.0.0.1 : il n'est pas exposé au réseau local.
 */

const { state } = require("../state");
const { ui } = require("../ui-bridge");
const rojo = require("./rojo-server");
const { findRojoProject } = require("./roblox-check");

const ACTIONS = ["status", "start", "stop", "connect"];
const trusted = new Set();

function checkArgs(args = {}) {
    const action = args.action === undefined ? "status" : args.action;
    if (!ACTIONS.includes(action)) throw new Error(`action doit valoir ${ACTIONS.join(", ")}.`);
    if (args.port !== undefined) {
        if (!Number.isInteger(args.port) || args.port < 1024 || args.port > 65535) {
            throw new Error("port doit être un entier entre 1024 et 65535.");
        }
    }
}

async function runRojoServe(args = {}) {
    const workspace = state.workspace;
    if (!workspace) throw new Error("Aucun projet sélectionné.");
    checkArgs(args);
    const action = args.action || "status";

    if (action === "stop") {
        const stopped = rojo.stopServer();
        return { ...rojo.statusOf(), stopped: Boolean(stopped), message: stopped ? "Serveur Rojo arrêté." : "Aucun serveur Rojo actif." };
    }

    if (action === "connect" || action === "status") {
        const info = rojo.studioConnectInfo(workspace);
        const status = rojo.statusOf();
        return {
            ...status,
            host: info.host,
            port: info.port,
            project: info.project,
            command: info.command,
            message: status.running
                ? status.connected
                    ? `Rojo synchronise le projet sur ${info.host}:${info.port} — Studio est connecté.`
                    : `Rojo écoute sur ${info.host}:${info.port}. Ouvre le plugin Rojo dans Studio et clique Connect.`
                : "Serveur Rojo arrêté. Lance action:\"start\" pour synchroniser Studio."
        };
    }

    // action: start
    const project = findRojoProject(workspace);
    if (!project) throw new Error("Aucun *.project.json : ce projet n'est pas encore un projet Rojo.");

    if (!trusted.has(workspace)) {
        const ok = await ui.confirm(`Démarrer le serveur Rojo sur ${project} ? Il écoute uniquement sur 127.0.0.1 et synchronise les fichiers du projet avec Roblox Studio.`);
        if (!ok) return { denied: true, running: false, message: "Démarrage du serveur Rojo refusé par l'utilisateur." };
        trusted.add(workspace);
    }

    const result = await rojo.startServer(workspace, { project, port: args.port });
    if (result.error) return { ...result, message: result.error };
    return {
        ...result,
        message: `Serveur Rojo démarré sur ${result.host}:${result.port} (projet ${result.project}). Dans Studio : plugin Rojo → Connect → ${result.host}:${result.port}.`
    };
}

function resetTrust() {
    trusted.clear();
}

module.exports = {
    name: "rojo_serve",
    run: runRojoServe,
    check: checkArgs,
    describe(a = {}) {
        const action = a.action || "status";
        return `Rojo ${action}`;
    },
    runRojoServe,
    checkArgs,
    resetTrust
};
