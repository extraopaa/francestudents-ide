"use strict";
const { Worker } = require("node:worker_threads");
const path = require("node:path");
let active = null;

function encode(pcm, signal) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, "dictation-encoder.js"), { workerData: pcm.slice().buffer });
        const abort = () => { worker.terminate(); reject(new Error("Dictée annulée.")); };
        signal.addEventListener("abort", abort, { once: true });
        const cleanup = () => signal.removeEventListener("abort", abort);
        worker.once("message", data => { cleanup(); resolve(data); worker.terminate(); });
        worker.once("error", error => { cleanup(); reject(error); });
        worker.once("exit", code => { cleanup(); if (code) reject(new Error("Encodage audio interrompu.")); });
        if (signal.aborted) abort();
    });
}

async function dictate(action, payload) {
    if (action === "cancel") { active?.abort(); return null; }
    if (action !== "transcribe") throw new Error("Action de dictée inconnue.");
    if (active) throw new Error("Une transcription est déjà en cours.");
    if (!(payload instanceof Int16Array) || payload.length < 1600 || payload.length > 16000 * 120)
        throw new Error("La dictée doit durer entre 0,1 et 120 secondes.");
    const controller = new AbortController(); active = controller;
    const deadline = setTimeout(() => controller.abort(), 180000);
    const { CONFIG } = require("../src/config");
    const { auth, getAccessToken } = require("../src/api/auth");
    async function request(route, options = {}, retried = false) {
        const response = await fetch(`${CONFIG.apiUrl}${route}`, {
            ...options, signal: controller.signal,
            headers: { Authorization: `Bearer ${await getAccessToken(retried)}`, Accept: "application/json",
                "francestudent-device-id": auth.deviceId, "User-Agent": CONFIG.userAgent,
                "francestudent-client-platform": CONFIG.clientPlatform, "francestudent-client-version": CONFIG.clientVersion,
                Origin: CONFIG.origin, Referer: `${CONFIG.origin}/` }
        });
        if (response.status === 401 && !retried) return request(route, options, true);
        if (!response.ok) throw new Error(`Transcription indisponible (HTTP ${response.status}).`);
        return response.json();
    }
    try {
        const mp3 = await encode(payload, controller.signal), form = new FormData();
        form.append("file", new Blob([mp3], { type: "audio/mpeg" }), "dictee.mp3");
        const job = await request("/transcript/upload", { method: "POST", body: form });
        const id = job.uuid;
        if (typeof id !== "string" || !/^[\da-f-]{36}$/i.test(id)) throw new Error("Identifiant de transcription invalide.");
        while (!controller.signal.aborted) {
            const detail = await request(`/transcript/${encodeURIComponent(id)}`);
            if (detail.status === "COMPLETED") return String(detail.transcriptText || "").slice(0, 20000);
            if (detail.status === "ERROR") throw new Error("FranceStudent n’a pas pu transcrire cet enregistrement.");
            await require("node:timers/promises").setTimeout(2000, null, { signal: controller.signal });
        }
        throw new Error("Dictée annulée.");
    } finally { clearTimeout(deadline); if (active === controller) active = null; }
}
module.exports = { dictate };
