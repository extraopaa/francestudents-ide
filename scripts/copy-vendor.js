#!/usr/bin/env node
"use strict";
// Copie les fichiers navigateur de xterm.js dans desktop/renderer/vendor/.
// La CSP du renderer n'autorise que 'self' : aucun CDN, tout doit être local.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEST = path.join(ROOT, "desktop", "renderer", "vendor");
const bundledPackages = new Set();
function recordPackages(result) {
  for(const file of Object.keys(result.metafile?.inputs||{})) {
    const parts=file.replace(/\\/g,"/").split("node_modules/").pop().split("/");
    if(!file.includes("node_modules"))continue;
    bundledPackages.add(parts[0].startsWith("@")?parts.slice(0,2).join("/"):parts[0]);
  }
}

const FILES = [
  ["@xterm/xterm", "lib/xterm.js", "xterm.js"],
  ["@xterm/xterm", "css/xterm.css", "xterm.css"],
  ["@xterm/addon-fit", "lib/addon-fit.js", "addon-fit.js"],
];

function packageDir(name) {
  try {
    return path.dirname(require.resolve(name + "/package.json", { paths: [ROOT] }));
  } catch {
    // Repli si le champ "exports" du paquet masque package.json.
    let dir = path.dirname(require.resolve(name, { paths: [ROOT] }));
    while (dir !== path.dirname(dir)) {
      const pkg = path.join(dir, "package.json");
      if (fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, "utf8")).name === name) return dir;
      dir = path.dirname(dir);
    }
    throw new Error("package.json introuvable pour " + name);
  }
}

function main() {
  fs.mkdirSync(DEST, { recursive: true });
  let copied = 0;
  for (const [pkg, rel, out] of FILES) {
    let src;
    try {
      src = path.join(packageDir(pkg), rel);
    } catch (err) {
      console.error(`[vendor] paquet introuvable : ${pkg} (lancer npm install) - ${err.message}`);
      process.exitCode = 1;
      return;
    }
    if (!fs.existsSync(src)) {
      console.error(`[vendor] fichier manquant : ${src}`);
      process.exitCode = 1;
      return;
    }
    const target = path.join(DEST, out);
    const data = fs.readFileSync(src);
    if (fs.existsSync(target) && fs.readFileSync(target).equals(data)) continue;
    fs.writeFileSync(target, data);
    copied++;
  }
  console.log(`[vendor] ${FILES.length} fichiers vérifiés, ${copied} copiés dans ${path.relative(ROOT, DEST)}`);
  buildCodemirror();
  buildStudio();
  copyLicenses();
}

function buildStudio() {
  const result = require("esbuild").buildSync({entryPoints:[path.join(__dirname,"studio-vendor-entry.mjs")],bundle:true,format:"iife",platform:"browser",target:"chrome120",minify:true,legalComments:"eof",write:false,metafile:true});
  recordPackages(result);
  const target = path.join(DEST,"studio.js");
  const data = Buffer.from(result.outputFiles[0].contents);
  if (!fs.existsSync(target) || !fs.readFileSync(target).equals(data)) fs.writeFileSync(target,data);
  console.log(`[vendor] studio.js vérifié (${Math.round(data.length/1024)} Ko)`);
}

function copyLicenses() {
  const packages = [...new Set(["@huggingface/transformers","onnxruntime-node","onnxruntime-web","prettier","sharp","electron-updater","node-pty","typescript","typescript-language-server","@xterm/xterm","@xterm/addon-fit",...bundledPackages])].sort();
  const notices = [];
  for (const name of packages) {
    const dir = packageDir(name);
    const pkg = JSON.parse(fs.readFileSync(path.join(dir,"package.json"),"utf8"));
    const texts = fs.readdirSync(dir).filter(file => /^(license|licence|notice|copyright)([.-]|$)/i.test(file) && fs.statSync(path.join(dir,file)).isFile()).map(file => fs.readFileSync(path.join(dir,file),"utf8"));
    if (!texts.length && ["onnxruntime-node", "onnxruntime-web"].includes(name)) {
      const license = `MIT License\n\nCopyright (c) Microsoft Corporation\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.`;
      texts.push(license);
    }
    if (!texts.length) throw new Error("Licence introuvable : " + name);
    notices.push(`## ${name} ${pkg.version} (${pkg.license})\n\n${texts.join("\n\n")}`);
  }
  notices.push("## Whisper base model — onnx-community/whisper-base\n\nCopyright 2022 OpenAI. Apache-2.0. This model is downloaded on demand and is not included in the installer. Model source and full license: https://huggingface.co/onnx-community/whisper-base");
  fs.writeFileSync(path.join(DEST,"OPEN_SOURCE_LICENSES.txt"),notices.join("\n\n------------------------\n\n"));
}

// Assemble CodeMirror 6 (modules ES) en un seul script qui expose window.CM.
function buildCodemirror() {
  let esbuild;
  try {
    esbuild = require("esbuild");
  } catch (err) {
    console.error(`[vendor] esbuild introuvable (lancer npm install) - ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const target = path.join(DEST, "codemirror.js");
  let result;
  try {
    result = esbuild.buildSync({
      entryPoints: [path.join(__dirname, "codemirror-entry.mjs")],
      bundle: true,
      format: "iife",
      platform: "browser",
      target: "chrome120",
      minify: true,
      metafile: true,
      legalComments: "none",
      write: false,
      logLevel: "silent"
    });
  } catch (err) {
    console.error(`[vendor] bundle CodeMirror impossible - ${err.message}`);
    process.exitCode = 1;
    return;
  }
  const data = Buffer.from(result.outputFiles[0].contents);
  recordPackages(result);
  if (fs.existsSync(target) && fs.readFileSync(target).equals(data)) {
    console.log("[vendor] codemirror.js à jour");
    return;
  }
  fs.writeFileSync(target, data);
  console.log(`[vendor] codemirror.js généré (${Math.round(data.length / 1024)} Ko)`);
}

if (require.main === module) main();
module.exports = { FILES, DEST, main };
