"use strict";
const fs = require("node:fs"), path = require("node:path"), { randomUUID } = require("node:crypto");

const ERROR_CATALOG = Object.freeze({
    "FST-001": { title: "Arrêt inattendu", reason: "La dernière session ne s’est pas fermée normalement. La cause exacte n’a pas pu être enregistrée.", advice: "Cela peut aussi suivre un arrêt forcé de Windows ou une coupure de courant.", crash: true },
    "FST-101": { title: "Interface interrompue", reason: "Le processus qui affiche l’interface s’est arrêté de manière inattendue.", advice: "Rouvre la conversation pour consulter les échanges enregistrés.", crash: true },
    "FST-102": { title: "Mémoire insuffisante", reason: "Electron a signalé un manque de mémoire ou une éviction mémoire du processus d’affichage.", advice: "Ferme les aperçus et applications inutilisés, puis reprends le travail.", crash: true },
    "FST-103": { title: "Contrôle d’intégrité Windows", reason: "Windows a refusé l’intégrité du processus d’affichage.", advice: "Réinstalle le paquet officiel correspondant à ton ordinateur.", crash: true },
    "FST-104": { title: "Démarrage de l’interface impossible", reason: "Le processus d’affichage n’a pas pu démarrer.", advice: "Vérifie l’installation et transmets ce diagnostic si le problème se répète.", crash: true },
    "FST-201": { title: "Processus graphique interrompu", reason: "Electron a signalé l’arrêt inattendu de son processus graphique.", advice: "Ce constat ne permet pas, à lui seul, d’identifier un problème de pilote." },
    "FST-202": { title: "Processus auxiliaire interrompu", reason: "Un processus auxiliaire d’Electron s’est arrêté.", advice: "Transmets le code et les détails techniques si le problème se répète." },
    "FST-301": { title: "Connexion du terminal interrompue", reason: "La connexion au terminal a rencontré une erreur.", advice: "Ouvre un nouveau terminal pour continuer ; l’IDE reste disponible." },
    "FST-401": { title: "Erreur du processus principal", reason: "Une exception non gérée a été détectée dans le processus principal.", advice: "Transmets le diagnostic pour identifier le chemin d’exécution concerné.", crash: true },
    "FST-402": { title: "Échec du démarrage", reason: "L’initialisation de l’application a échoué.", advice: "Relance l’application et transmets ce code si le problème persiste.", crash: true },
    "FST-501": { title: "Message d’interface non transmis", reason: "Un événement local n’a pas pu être envoyé à l’interface.", advice: "Le contenu des messages n’est pas inclus dans ce journal." }
});

function rendererCode(reason) {
    if (["oom", "memory-eviction"].includes(reason)) return "FST-102";
    if (reason === "integrity-failure") return "FST-103";
    if (reason === "launch-failed") return "FST-104";
    return "FST-101";
}

function createStabilityMonitor({ directory, version, platform = process.platform, arch = process.arch }) {
    const file = path.join(directory, "stability.json");
    let saved = { events: [], session: null, pending: null }, persisted = true;
    try {
        if (fs.statSync(file).size <= 128000) saved = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch { /* First launch or damaged diagnostic file: never block startup. */ }
    if (!saved || typeof saved !== "object") saved = {};
    const valid = event => event && ERROR_CATALOG[event.code] && typeof event.id === "string";
    saved.events = Array.isArray(saved.events) ? saved.events.filter(valid).slice(-50) : [];
    if (!valid(saved.pending)) saved.pending = null;
    function persist() {
        try {
            fs.mkdirSync(directory, { recursive: true });
            fs.writeFileSync(file + ".tmp", JSON.stringify(saved), { mode: 0o600 });
            fs.renameSync(file + ".tmp", file);
            persisted = true;
        } catch { persisted = false; }
    }
    function record(code, details = {}, context = { version, platform, arch }) {
        if (!ERROR_CATALOG[code]) throw new Error("Code de stabilité inconnu.");
        const event = { id: randomUUID(), sessionId: saved.session?.id, code, at: new Date().toISOString(), version: context.version, platform: context.platform, arch: context.arch };
        // Deliberately exclude exception messages, stacks, paths, prompts and tokens.
        for (const key of ["reason", "type", "errorCode", "errorName", "channel"]) {
            if (typeof details[key] === "string" && /^[a-zA-Z0-9_.-]{1,60}$/.test(details[key])) event[key] = details[key];
        }
        if (Number.isInteger(details.exitCode)) event.exitCode = details.exitCode;
        saved.events = [...saved.events, event].slice(-50);
        if (ERROR_CATALOG[code].crash) saved.pending = event;
        persist();
        return event;
    }
    function notice() {
        const event = saved.pending;
        if (!event) return null;
        const entry = ERROR_CATALOG[event.code];
        const related = saved.events.filter(item => item.sessionId === event.sessionId).slice(-5);
        const report = ["FranceStudent IDE — diagnostic de stabilité", `Code : ${event.code}`, `Raison : ${entry.reason}`,
            `Version : ${event.version}`, `Système : ${event.platform} ${event.arch}`, `Date du constat : ${event.at}`,
            ...["reason", "type", "exitCode", "errorCode", "errorName", "channel"].filter(key => event[key] !== undefined).map(key => `${key} : ${event[key]}`),
            ...(related.length > 1 ? ["Événements techniques récents (sans déduction de cause) :", ...related.map(item => `${item.at} ${item.code} ${item.reason || item.errorCode || ""}`)] : [])].join("\n");
        return { ...event, title: entry.title, reasonText: entry.reason, advice: entry.advice, report, persisted };
    }
    return {
        file, record, notice,
        start() {
            const previous = saved.session;
            if (previous?.active && (!saved.pending || saved.pending.sessionId !== previous.id)) {
                record("FST-001", { reason: "unclean-session" }, {
                    version: typeof previous.version === "string" && previous.version.length <= 60 ? previous.version : "inconnue",
                    platform: previous.platform || platform, arch: previous.arch || arch
                });
            }
            saved.session = { id: randomUUID(), active: true, startedAt: new Date().toISOString(), version, platform, arch };
            persist();
        },
        finish() { saved.session = { ...saved.session, active: false }; persist(); },
        acknowledge(id) {
            if (saved.pending?.id !== id) return false;
            saved.pending = null; persist(); return true;
        }
    };
}

function safeSend(window, channel, data, record) {
    try {
        if (!window || window.isDestroyed() || window.webContents.isDestroyed() || window.webContents.isCrashed?.()) return false;
        window.webContents.send("frst:event", { channel, data });
        return true;
    } catch (error) {
        record?.("FST-501", { channel, errorName: error.name, errorCode: error.code });
        return false;
    }
}

module.exports = { ERROR_CATALOG, rendererCode, createStabilityMonitor, safeSend };
