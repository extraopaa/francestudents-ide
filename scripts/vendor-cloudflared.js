"use strict";

// Prépare uniquement les binaires de release officiels, hors de Git.
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const tar = require("tar-stream");

const version = "2026.10.5";
const targets = {
    win: { asset: "cloudflared-windows-amd64.exe", hash: "db4e4c413612a0916f3e1679d3caaf376f94911952d163028fb726fb2e0516a9", output: "cloudflared.exe" },
    mac: { asset: "cloudflared-darwin-arm64.tgz", hash: "184c7d4f5f977348243a6d7ca8f6cf6073b9b2746cfe8c1fe15aa59e9a522bf0", output: "cloudflared" }
};
const root = path.resolve(__dirname, "..", "release", "vendor-cloudflared");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

async function download(url, maxBytes) {
    const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) throw new Error(`Téléchargement impossible : HTTP ${response.status}`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error("Fichier téléchargé trop volumineux.");
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}
function extractBinary(archive) {
    return new Promise((resolve, reject) => {
        const extract = tar.extract(); let binary = null;
        extract.on("entry", (header, stream, next) => {
            if (header.type !== "file" || !/^(?:\.\/)?cloudflared$/.test(header.name) || binary) {
                stream.resume(); stream.on("end", next); return;
            }
            if (header.size > 100 * 1024 * 1024) { stream.destroy(new Error("Exécutable trop volumineux.")); return; }
            const chunks = []; stream.on("data", chunk => chunks.push(chunk));
            stream.on("error", reject);
            stream.on("end", () => { binary = Buffer.concat(chunks); next(); });
        });
        extract.on("error", reject);
        extract.on("finish", () => binary ? resolve(binary) : reject(new Error("Exécutable cloudflared absent de l’archive.")));
        const gunzip = zlib.createGunzip(); gunzip.on("error", reject); gunzip.pipe(extract); gunzip.end(archive);
    });
}
async function main() {
    const requested = process.argv[2];
    const platform = requested === "auto" ? (process.platform === "win32" && process.arch === "x64" ? "win" : process.platform === "darwin" && process.arch === "arm64" ? "mac" : "") : requested;
    const target = targets[platform];
    if (!target) throw new Error("Cible non prise en charge : utilise win (Windows x64) ou mac (macOS arm64).");
    const url = `https://github.com/cloudflare/cloudflared/releases/download/${version}/${target.asset}`;
    const archive = await download(url, 80 * 1024 * 1024);
    if (hash(archive) !== target.hash) throw new Error("Empreinte cloudflared incorrecte : distribution annulée.");
    const binary = platform === "mac" ? await extractBinary(archive) : archive;
    const license = await download(`https://raw.githubusercontent.com/cloudflare/cloudflared/${version}/LICENSE`, 100 * 1024);
    if (hash(license) !== "58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd") throw new Error("Empreinte de la licence cloudflared incorrecte : distribution annulée.");
    const directory = path.join(root, platform);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "LICENSE-cloudflared.txt"), license);
    await fs.writeFile(path.join(directory, target.output), binary, { mode: 0o755 });
    await fs.chmod(path.join(directory, target.output), 0o755);
    console.log(`cloudflared ${version} vérifié pour ${platform}.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
