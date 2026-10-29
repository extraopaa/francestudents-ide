"use strict";
const { OBSERVED_IDS } = require("./model-context");
// Known model capabilities; other GPT models use a conservative account-level fallback.
const COMMON = ["none", "low", "medium", "high", "xhigh"];
const GPT_FALLBACK = ["low", "medium", "high"];
const LEVELS = {
    "gpt-6.1-sol": ["low", "medium", "high", "xhigh"],
    "gpt-6.1-terra": COMMON, "gpt-6-sol": COMMON, "gpt-6-luna": COMMON,
    "gpt-5.6-sol": COMMON, "gpt-5.6-luna": COMMON, "gpt-5.6-terra": COMMON
};
function capabilities(agent) {
    const candidates = [agent?.model, agent?.contextModel, agent?.name, OBSERVED_IDS[agent?.id]];
    const models = candidates.map(value => String(value || "").toLowerCase().trim().replace(/\s+/g, "-").replace(/-\d{4}-\d{2}-\d{2}$/, ""));
    for (const model of models) {
        if (LEVELS[model]) return { model, levels: [...LEVELS[model]] };
    }
    const model = models.find(value => /^gpt(?:-|$)/.test(value));
    return model ? { model, levels: [...GPT_FALLBACK] } : { model: null, levels: [] };
}
async function readPreference() {
    const dto = await require("./account").getJson("/user/instructions");
    return typeof dto?.gptReasoning === "string" ? dto.gptReasoning : null;
}
async function savePreference(level, retried = false) {
    if (!["none", "minimal", "low", "medium", "high", "xhigh"].includes(level)) throw new Error("Niveau de réflexion invalide.");
    const { CONFIG } = require("../config"), { auth, getAccessToken } = require("./auth");
    const response = await fetch(`${CONFIG.apiUrl}/user/instructions`, {
        method: "PATCH", signal: AbortSignal.timeout(15000),
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${await getAccessToken(retried)}`,
            "User-Agent": CONFIG.userAgent, "francestudent-device-id": auth.deviceId,
            "francestudent-client-platform": CONFIG.clientPlatform, "francestudent-client-version": CONFIG.clientVersion,
            Origin: CONFIG.origin, Referer: `${CONFIG.origin}/` },
        body: JSON.stringify({ gptReasoning: level })
    });
    if (response.status === 401 && !retried) return savePreference(level, true);
    if (!response.ok) throw new Error(`FranceStudent a refusé le réglage de réflexion (HTTP ${response.status}).`);
    // Read back the account preference instead of assuming the PATCH was applied.
    const saved = await readPreference();
    if (saved !== level) throw new Error("Le réglage n’a pas pu être confirmé par FranceStudent. Actualise pour vérifier sa valeur.");
    return saved;
}
module.exports = { capabilities, readPreference, savePreference };
