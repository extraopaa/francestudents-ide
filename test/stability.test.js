"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { ERROR_CATALOG, rendererCode, createStabilityMonitor, safeSend } = require("../desktop/stability");
function fixture() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "frst-stability-"));
    return { directory, open: () => createStabilityMonitor({ directory, version: "test-version", platform: "win32", arch: "x64" }), remove: () => fs.rmSync(directory, { recursive: true, force: true }) };
}

test("normal shutdown is silent; an unclean restart shows an honest unknown-cause diagnostic until acknowledged", () => {
    const f = fixture();
    try {
        const first = f.open(); first.start(); assert.equal(first.notice(), null); first.finish();
        const second = f.open(); second.start(); assert.equal(second.notice(), null);
        const restarted = f.open(); restarted.start(); const notice = restarted.notice();
        assert.equal(notice.code, "FST-001"); assert.match(notice.reasonText, /cause exacte/);
        assert.equal(restarted.acknowledge("outdated-notice"), false);
        assert.equal(restarted.acknowledge(notice.id), true); restarted.finish();
        const clean = f.open(); clean.start(); assert.equal(clean.notice(), null); clean.finish();
    } finally { f.remove(); }
});

test("recognized crashes survive restart, reports contain no exception text, and recoverable terminal errors do not claim an app crash", () => {
    const f = fixture();
    try {
        const monitor = f.open(); monitor.start();
        monitor.record("FST-201", { reason: "crashed", type: "GPU" });
        monitor.record(rendererCode("oom"), { reason: "oom", exitCode: -1, message: "SECRET_PROMPT", stack: "SECRET_PATH", token: "SECRET_TOKEN" });
        monitor.finish();
        const restarted = f.open(); restarted.start(); const notice = restarted.notice();
        assert.equal(notice.code, "FST-102"); assert.match(notice.report, /test-version/); assert.match(notice.report, /win32 x64/);
        assert.match(notice.report, /FST-201/);
        assert.doesNotMatch(fs.readFileSync(monitor.file, "utf8"), /SECRET/);
        restarted.acknowledge(notice.id); restarted.record("FST-301", { errorCode: "ECONNRESET" }); restarted.finish();
        const next = f.open(); next.start(); assert.equal(next.notice(), null); next.finish();
    } finally { f.remove(); }
});

test("diagnostics are bounded and damaged or unwritable storage cannot crash the app", () => {
    const f = fixture();
    try {
        fs.writeFileSync(path.join(f.directory, "stability.json"), "invalid json");
        const monitor = f.open(); monitor.start();
        for (let i = 0; i < 75; i++) monitor.record("FST-501", { channel: "status" });
        assert.equal(JSON.parse(fs.readFileSync(monitor.file, "utf8")).events.length, 50);
        assert.ok(fs.statSync(monitor.file).size < 64000);
        const blocked = path.join(f.directory, "not-a-directory"); fs.writeFileSync(blocked, "fixture");
        const unavailable = createStabilityMonitor({ directory: blocked, version: "test" });
        assert.doesNotThrow(() => { unavailable.start(); unavailable.record("FST-401"); });
        assert.equal(unavailable.notice().persisted, false);
    } finally { f.remove(); }
});

test("restart diagnostics retain the crashed version and never reuse the cause from an older session", () => {
    const f = fixture();
    try {
        const first = f.open(); first.start(); first.record("FST-102"); first.finish();
        const second = f.open(); second.start(); assert.equal(second.notice().code, "FST-102");
        // Another abrupt exit without a diagnosed cause must not blame the old OOM.
        const upgraded = createStabilityMonitor({ directory: f.directory, version: "new-version" }); upgraded.start();
        assert.equal(upgraded.notice().code, "FST-001");
        assert.equal(upgraded.notice().version, "test-version");
    } finally { f.remove(); }
});

test("destroyed windows and failed UI sends never escape into a terminal callback", () => {
    const records = [], record = (...args) => records.push(args);
    assert.equal(safeSend(null, "status", {}, record), false);
    assert.equal(safeSend({ isDestroyed: () => true }, "status", {}, record), false);
    const dead = { isDestroyed: () => false, webContents: { isDestroyed: () => true } };
    assert.equal(safeSend(dead, "status", {}, record), false); assert.equal(records.length, 0);
    const broken = { isDestroyed: () => false, webContents: { isDestroyed: () => false, send: () => { throw new Error("Object has been destroyed: SECRET"); } } };
    assert.equal(safeSend(broken, "ptyData", { data: "SECRET" }, record), false);
    assert.equal(records[0][0], "FST-501"); assert.doesNotMatch(JSON.stringify(records), /SECRET/);
});

test("every diagnostic code has an entry in the AI-readable reference", () => {
    const reference = fs.readFileSync(path.join(__dirname, "../docs/error-codes.md"), "utf8");
    for (const code of Object.keys(ERROR_CATALOG)) assert.ok(reference.includes(code), `Missing documentation for ${code}`);
    assert.equal(rendererCode("integrity-failure"), "FST-103"); assert.equal(rendererCode("launch-failed"), "FST-104");
});
