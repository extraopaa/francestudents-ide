"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const auth = require("../src/api/auth"), { dictate } = require("../desktop/dictation");
test("dictation really encodes MP3 in a worker, uploads it once and returns only transcribed text", async () => {
    const oldFetch = global.fetch, oldToken = auth.getAccessToken, calls = [];
    auth.getAccessToken = async () => "test-token";
    global.fetch = async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith("/transcript/upload")) {
            assert.equal(options.method, "POST");
            const audio = options.body.get("file"); assert.equal(audio.type, "audio/mpeg");
            const bytes = new Uint8Array(await audio.arrayBuffer());
            assert.ok(bytes.length > 50); assert.equal(bytes[0], 255); assert.equal(bytes[1] & 224, 224);
            return new Response(JSON.stringify({ uuid: "12345678-1234-1234-1234-123456789abc" }));
        }
        return new Response(JSON.stringify({ status: "COMPLETED", transcriptText: "Bonjour mon projet" }));
    };
    try {
        const pcm = Int16Array.from({ length: 16000 }, (_, i) => Math.round(Math.sin(i / 10) * 8000));
        assert.equal(await dictate("transcribe", pcm), "Bonjour mon projet");
        assert.equal(calls.length, 2);
        assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
    } finally { global.fetch = oldFetch; auth.getAccessToken = oldToken; }
});
test("dictation rejects oversized or non-PCM audio before any upload", async () => {
    await assert.rejects(dictate("transcribe", "not audio"), /120 secondes/);
    await assert.rejects(dictate("transcribe", new Int16Array(16000 * 120 + 1)), /120 secondes/);
    assert.equal(await dictate("cancel"), null);
});
