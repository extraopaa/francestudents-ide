"use strict";

// Bêta fournisseur personnel : profils séparés du compte FranceStudent.
// Les secrets sont toujours chiffrés par le coffre système de l’application.
const secretStorage = require("./secret-storage");
const settings = require("./settings");

const PROVIDERS = new Set(["openai", "anthropic", "gemini", "openai-compatible"]);
const MAX_PROFILES = 20;

function clean(value, max) { return String(value ?? "").trim().slice(0, max); }

function read() {
    const value = settings.load().customProviders;
    return Array.isArray(value) ? value.filter(item => item && typeof item === "object").slice(0, MAX_PROFILES) : [];
}

function publicProfile(item) {
    return { id: item.id, name: item.name, provider: item.provider, baseUrl: item.baseUrl, model: item.model, enabled: item.enabled === true, hasKey: Boolean(item.secret) };
}

function list() { return read().map(publicProfile); }

function saveProfile(input) {
    if (!secretStorage.available()) throw new Error("Le coffre sécurisé du système n’est pas disponible sur cet ordinateur.");
    const provider = clean(input?.provider, 32).toLowerCase();
    if (!PROVIDERS.has(provider)) throw new Error("Fournisseur personnalisé invalide.");
    const name = clean(input?.name, 80);
    const model = clean(input?.model, 160);
    const key = String(input?.apiKey || "").trim();
    if (!name || !model || !key || key.length > 4096) throw new Error("Nom, modèle et clé API sont obligatoires.");
    const baseUrl = clean(input?.baseUrl || "", 500);
    if (provider === "openai-compatible" && !/^https:\/\//i.test(baseUrl)) throw new Error("L’URL personnalisée doit commencer par https://.");
    const profiles = read();
    const id = clean(input?.id, 80) || `custom-${Date.now().toString(36)}`;
    const next = { id, name, provider, baseUrl, model, enabled: input?.enabled !== false, secret: secretStorage.protect(key) };
    const index = profiles.findIndex(item => item.id === id);
    if (index >= 0) profiles[index] = next; else profiles.push(next);
    settings.save({ customProviders: profiles.slice(-MAX_PROFILES), customProvidersBeta: true });
    return publicProfile(next);
}

function remove(id) {
    const profiles = read();
    const next = profiles.filter(item => item.id !== clean(id, 80));
    settings.save({ customProviders: next });
    return next.length !== profiles.length;
}

function get(id) {
    const item = read().find(value => value.id === clean(id, 80));
    if (!item) return null;
    const key = secretStorage.unprotect(item.secret);
    return key ? { ...publicProfile(item), apiKey: key } : null;
}

module.exports = { PROVIDERS: [...PROVIDERS], list, saveProfile, remove, get };
