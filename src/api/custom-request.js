"use strict";
const providers = require("../custom-providers");

async function request(modelId, prompt, { signal } = {}) {
    const id = String(modelId || "");
    const profile = providers.get(id.replace(/^custom:/, ""));
    if (!profile) throw new Error("Fournisseur personnalisé introuvable ou clé indisponible.");
    const base = profile.baseUrl || (profile.provider === "openai" ? "https://api.openai.com/v1" : "");
    if (!base) throw new Error("URL API manquante pour ce fournisseur personnalisé.");
    const url = `${base.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${profile.apiKey}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ model: profile.model, messages: [{ role: "user", content: prompt }], stream: false }), signal });
    const text = await response.text();
    if (!response.ok) throw new Error(`Fournisseur personnalisé HTTP ${response.status}: ${text.slice(0, 500)}`);
    let data; try { data = JSON.parse(text); } catch { throw new Error("Réponse JSON invalide du fournisseur personnalisé."); }
    const content = data?.choices?.[0]?.message?.content ?? data?.output?.[0]?.content?.[0]?.text;
    if (typeof content !== "string" || !content.trim()) throw new Error("Réponse vide du fournisseur personnalisé.");
    return content;
}
module.exports = { request };
