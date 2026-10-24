"use strict";
const path = require("node:path");
const os = require("node:os");
const { execFile } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const settings = require("./settings");
function workspaceKey(workspace) {
    const resolved = path.resolve(workspace).replace(/[\\/]+$/, "");
    // Linux paths in UNC shares are case-sensitive, even on a Windows host.
    return /^\\\\(?:wsl\$|wsl\.localhost)\\/i.test(resolved) ? resolved.replace(/^\\\\([^\\]+)\\([^\\]+)/, (_, host, distro) => `\\\\${host.toLowerCase()}\\${distro.toLowerCase()}`) : resolved.toLowerCase();
}
function projectEnvironment(workspace) {
    if (process.platform !== "win32" || !workspace) return { mode: "native", distribution: "" };
    if (require("./state").state.motionDesign) return { mode: "native", distribution: "" };
    const value = settings.load().projectExecutionEnvironments?.[workspaceKey(workspace)];
    return value?.mode === "wsl" ? { mode: "wsl", distribution: String(value.distribution || ""), linuxRoot: String(value.linuxRoot || "") } : { mode: "native", distribution: "" };
}
function wslLocation(cwd, distribution = "") {
    const unc = /^\\\\(?:wsl\$|wsl\.localhost)\\([^\\]+)(\\.*)?$/i.exec(cwd);
    if (unc && distribution && distribution.toLowerCase() !== unc[1].toLowerCase()) throw new Error("Le dossier appartient à une autre distribution WSL. Modifie l’environnement du projet.");
    const distro = distribution || unc?.[1] || "";
    const args = distro ? ["--distribution", distro] : [];
    args.push("--cd", unc ? (unc[2] || "/").replace(/\\/g, "/") : cwd);
    return { file: path.win32.join(process.env.SystemRoot || "C:\\Windows", "System32", "wsl.exe"), args, cwd: os.homedir(), distribution: distro };
}
// Convert Windows absolute paths in structured argv inside Linux with wslpath,
// including custom mount roots. No interpolation of arguments into shell code.
const EXEC_ARGV = "command_name=$1; shift; convert() { case \"$1\" in [A-Za-z]:*|\\\\\\\\*) wslpath -u -- \"$1\" ;; *) printf \"%s\" \"$1\" ;; esac; }; command_name=$(convert \"$command_name\") || exit; converted=(); for arg in \"$@\"; do converted+=(\"$(convert \"$arg\")\") || exit; done; exec \"$command_name\" \"${converted[@]}\"";
function wslTarget(file, args, cwd, environment) {
    const location = wslLocation(cwd, environment.distribution);
    const token = `FRST_WSL_${randomBytes(12).toString("hex")}:`;
    let group = null, stopping = false, buffered = "";
    const script = `printf '${token}%s\\n' "$$" >&2; ${EXEC_ARGV}`;
    const target = { ...location, args: [...location.args, "--exec", "setsid", "--wait", "/bin/bash", "-lc", script, "frst", file, ...args], verbatim: false };
    const killGroup = () => {
        if (!group) return;
        const command = [...(location.distribution ? ["--distribution", location.distribution] : []), "--exec", "/bin/kill"];
        execFile(location.file, [...command, "-TERM", "--", `-${group}`], { windowsHide: true, timeout: 4000 }, () => {});
        const timer = setTimeout(() => execFile(location.file, [...command, "-KILL", "--", `-${group}`], { windowsHide: true, timeout: 4000 }, () => {}), 1000);
        timer.unref();
    };
    target.stop = child => {
        stopping = true; killGroup();
        const timer = setTimeout(() => { try { child?.kill(); } catch { /* Already closed. */ } }, 3500); timer.unref();
    };
    target.filterStderr = (text, final = false) => {
        buffered += text; let visible = "", newline;
        while ((newline = buffered.indexOf("\n")) >= 0) {
            const line = buffered.slice(0, newline + 1); buffered = buffered.slice(newline + 1);
            if (line.startsWith(token) && /^\d+\s*$/.test(line.slice(token.length))) {
                const pid = Number(line.slice(token.length)); if (Number.isSafeInteger(pid) && pid > 1) { group = pid; if (stopping) killGroup(); }
            } else visible += line;
        }
        if (final || buffered.length > 8192) { visible += buffered; buffered = ""; }
        return visible;
    };
    return target;
}
function targetForProject(file, args, cwd) {
    const { state } = require("./state");
    const environment = projectEnvironment(state.workspace);
    if (environment.mode !== "wsl") return null;
    return wslTarget(file, args, cwd, environment);
}
async function probe(workspace, distribution) {
    const location = wslLocation(workspace, distribution);
    const script = 'command -v setsid >/dev/null || exit 69; printf "FRST_PWD=%s\\nFRST_DISTRO=%s\\nFRST_SHELL=%s\\n" "$PWD" "$WSL_DISTRO_NAME" "$SHELL"; printf "FRST_NODE="; node --version 2>/dev/null || true; printf "FRST_NPM="; npm --version 2>/dev/null || true; printf "FRST_GIT="; git --version 2>/dev/null || true';
    return new Promise((resolve, reject) => execFile(location.file, [...location.args, "--exec", "/bin/bash", "-lc", script],
        { cwd: location.cwd, windowsHide: true, timeout: 15000, maxBuffer: 65536 }, (error, stdout) => {
            if (error) { reject(new Error("Impossible d’ouvrir ce projet dans WSL. Vérifie la distribution, son initialisation, le dossier et la présence de bash/setsid.")); return; }
            const values = {};
            for (const line of String(stdout).split(/\r?\n/)) { const match = /^FRST_(PWD|DISTRO|SHELL|NODE|NPM|GIT)=(.*)$/.exec(line); if (match) values[match[1]] = match[2]; }
            if (!values.PWD?.startsWith("/") || !values.DISTRO) { reject(new Error("WSL n’a pas confirmé le dossier du projet et sa distribution.")); return; }
            resolve({ linuxRoot: values.PWD, distribution: values.DISTRO, shell: values.SHELL || "/bin/bash", node: values.NODE || null, npm: values.NPM || null, git: values.GIT || null });
        }));
}
function hostPath(value, workspace) {
    const environment = projectEnvironment(workspace);
    const root = environment.linuxRoot?.replace(/\/$/, "");
    if (environment.mode !== "wsl" || !root || typeof value !== "string") return value;
    if (value === root) return workspace;
    return value.startsWith(root + "/") ? path.join(workspace, value.slice(root.length + 1)) : value;
}
module.exports = { workspaceKey, projectEnvironment, wslLocation, wslTarget, targetForProject, probe, hostPath };
