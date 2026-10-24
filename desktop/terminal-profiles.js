"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const settings = require("../src/settings");
const { execFile } = require("node:child_process");
const windows = process.platform === "win32";
const systemDir = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
function executable(name) {
    for (const dir of (process.env.PATH || "").split(path.delimiter)) {
        const full = path.join(dir.replace(/^"|"$/g, ""), name);
        if (fs.existsSync(full)) return full;
    }
    return null;
}
function profiles() {
    if (!windows) {
        const result = [{ id: "default", name: "Shell du système" }];
        for (const name of ["zsh", "bash", "sh"]) if (fs.existsSync(`/bin/${name}`)) result.push({ id: name, name });
        return result;
    }
    const result = [{ id: "default", name: "PowerShell Windows (par défaut)" }, { id: "cmd", name: "Invite de commandes (cmd)" }];
    if (executable("pwsh.exe")) result.push({ id: "pwsh", name: "PowerShell 7" });
    if (fs.existsSync(path.join(systemDir, "wsl.exe"))) result.push({ id: "wsl", name: "WSL · Linux" });
    return result;
}
async function distributions() {
    if (!windows || !profiles().some(item => item.id === "wsl")) return [];
    return new Promise((resolve, reject) => execFile(path.join(systemDir, "wsl.exe"), ["--list", "--quiet"],
        { encoding: "buffer", windowsHide: true, timeout: 8000, maxBuffer: 65536 }, (error, stdout) => {
            if (error) { reject(new Error("Impossible de lister WSL. Vérifie que WSL et une distribution sont installés.")); return; }
            const buffer = Buffer.from(stdout);
            const text = buffer.includes(0) ? buffer.toString("utf16le") : buffer.toString("utf8");
            resolve(text.replace(/\uFEFF/g, "").split(/\r?\n/).map(value => value.trim()).filter(value => value && !/[\x00-\x1f]/.test(value)));
        }));
}
async function preferences(action, payload = {}) {
    if (action === "distributions") return distributions();
    if (action === "save") {
        if (!profiles().some(item => item.id === payload.profile)) throw new Error("Ce terminal n’est pas disponible sur cet ordinateur.");
        const distribution = typeof payload.distribution === "string" ? payload.distribution : "";
        if (payload.profile === "wsl") {
            const installed = await distributions();
            if (!installed.length) throw new Error("Aucune distribution WSL installée.");
            if (distribution && !installed.includes(distribution)) throw new Error("Cette distribution WSL n’est plus installée.");
        }
        settings.save({ terminalProfile: payload.profile, terminalDistribution: payload.profile === "wsl" ? distribution : "" });
    } else if (action !== "get") throw new Error("Action de terminal inconnue.");
    const value = settings.load();
    return { profiles: profiles(), profile: value.terminalProfile || "default", distribution: value.terminalDistribution || "" };
}
function resolveTerminal(cwd, command) {
    const runtime = require("../src/execution-environment"), environment = runtime.projectEnvironment(require("../src/state").state.workspace);
    if (environment.mode === "wsl") {
        const location = runtime.wslLocation(cwd, environment.distribution);
        return { ...location, name: `WSL · ${location.distribution || "distribution du projet"}`, args: command === undefined ? location.args : [...location.args, "--exec", "/bin/bash", "-lc", command] };
    }
    const value = settings.load(), profile = value.terminalProfile || "default";
    if (!profiles().some(item => item.id === profile)) throw new Error("Le terminal choisi est introuvable. Choisis-en un autre dans Paramètres → Terminal.");
    let file, args = [], name;
    if (windows && profile === "wsl") {
        file = path.join(systemDir, "wsl.exe"); name = "WSL";
        const unc = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(\\.*)?$/i.exec(cwd);
        const distribution = value.terminalDistribution || unc?.[1] || "";
        if (unc && distribution.toLowerCase() !== unc[1].toLowerCase()) throw new Error("Le projet appartient à une autre distribution WSL. Sélectionne sa distribution dans Paramètres → Terminal.");
        if (distribution) { args.push("--distribution", distribution); name += ` · ${distribution}`; }
        args.push("--cd", unc ? (unc[2] || "/").replace(/\\/g, "/") : cwd);
        if (command !== undefined) args.push("--exec", "/bin/sh", "-lc", command);
        return { file, args, name, cwd: os.homedir() };
    }
    if (windows) {
        if (profile === "cmd") { file = path.join(systemDir, "cmd.exe"); name = "cmd"; args = command === undefined ? [] : ["/d", "/s", "/c", command]; }
        else {
            file = profile === "pwsh" ? executable("pwsh.exe") : path.join(systemDir, "WindowsPowerShell", "v1.0", "powershell.exe");
            name = profile === "pwsh" ? "PowerShell 7" : "PowerShell";
            args = command === undefined ? ["-NoLogo"] : ["-NoLogo", "-EncodedCommand", Buffer.from(command, "utf16le").toString("base64")];
        }
    } else {
        file = profile === "default" ? (process.env.SHELL && fs.existsSync(process.env.SHELL) ? process.env.SHELL : fs.existsSync("/bin/zsh") ? "/bin/zsh" : "/bin/bash") : `/bin/${profile}`;
        name = path.basename(file); args = command === undefined ? ["-l"] : ["-lc", command];
    }
    return { file, args, name, cwd };
}
module.exports = { profiles, distributions, preferences, resolveTerminal };
