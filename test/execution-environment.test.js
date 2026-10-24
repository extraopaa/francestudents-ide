"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
// Isolated settings and mocked subprocesses: these tests never start WSL.
function fixture() {
    const state = { workspace: "C:\\projects\\demo", motionDesign: false }, settings = { projectExecutionEnvironments: {} }, calls = [];
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, "../src/execution-environment.js"), "utf8");
    vm.runInNewContext(source, {
        module, process: { platform: "win32", env: { SystemRoot: "C:\\Windows" } }, setTimeout: () => ({ unref() {} }),
        require(name) {
            if (name === "node:path") return path.win32;
            if (name === "node:os") return { homedir: () => "C:\\Users\\Test" };
            if (name === "node:child_process") return { execFile: (...args) => { calls.push(args); args.at(-1)?.(null, ""); } };
            if (name === "./settings") return { load: () => settings };
            if (name === "./state") return { state };
            return require(name);
        }
    });
    return { api: module.exports, state, settings, calls };
}
test("WSL project opt-in is scoped to the project and never leaks into Motion", () => {
    const { api, state, settings } = fixture();
    assert.equal(api.projectEnvironment(state.workspace).mode, "native");
    settings.projectExecutionEnvironments[api.workspaceKey(state.workspace)] = { mode: "wsl", distribution: "Ubuntu", linuxRoot: "/mnt/c/projects/demo" };
    assert.equal(api.projectEnvironment(state.workspace).mode, "wsl");
    assert.equal(api.projectEnvironment("C:\\another-project").mode, "native");
    state.motionDesign = true;
    assert.equal(api.projectEnvironment(state.workspace).mode, "native");
});
test("WSL project UNC selects its own distribution and rejects another one", () => {
    const { api } = fixture();
    const location = api.wslLocation("\\\\wsl.localhost\\Ubuntu\\home\\me\\mon projet");
    assert.equal(location.distribution, "Ubuntu");
    assert.equal(location.args.at(-1), "/home/me/mon projet");
    assert.throws(() => api.wslLocation("\\\\wsl$\\Ubuntu\\home\\me", "Debian"), /autre distribution/);
    assert.notEqual(api.workspaceKey("\\\\wsl$\\Ubuntu\\home\\me\\Repo"), api.workspaceKey("\\\\wsl$\\Ubuntu\\home\\me\\repo"));
});
test("WSL structured argv preserves literal arguments and keeps process marker out of output", () => {
    const { api, calls } = fixture();
    const target = api.wslTarget("npm", ["run", "name with spaces;$(echo no)"], "C:\\projects\\demo", { distribution: "Ubuntu" });
    assert.equal(target.args.at(-1), "name with spaces;$(echo no)");
    assert.ok(target.args.includes("--wait"));
    const script = target.args.find(value => value.includes("FRST_WSL_"));
    const token = /FRST_WSL_[a-f0-9]+:/.exec(script)[0];
    assert.equal(target.filterStderr(`${token}12`), "");
    assert.equal(target.filterStderr("34\nreal output\n"), "real output\n");
    target.stop({ kill() {} });
    assert.ok(calls.some(call => call[1].includes("-1234")));
    assert.ok(calls.every(call => !call[1].includes("--terminate") && !call[1].includes("--shutdown")));
});
test("WSL Linux cwd under the project maps back without guessing external paths", () => {
    const { api, state, settings } = fixture();
    settings.projectExecutionEnvironments[api.workspaceKey(state.workspace)] = { mode: "wsl", distribution: "Ubuntu", linuxRoot: "/custom/mount/demo" };
    assert.equal(api.hostPath("/custom/mount/demo/src", state.workspace), "C:\\projects\\demo\\src");
    assert.equal(api.hostPath("/home/another-project", state.workspace), "/home/another-project");
});
