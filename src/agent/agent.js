"use strict";

const { CONFIG } = require("../config");
const { state, record, activateConversation } = require("../state");
const { ui } = require("../ui-bridge");
const api = require("../api/api");
const memory = require("../project/memory");
const profile = require("../project/profile");
const conversations = require("../project/conversations");
const projectContext = require("../project/project-context");
const { loadInstructions, INSTRUCTIONS_FILES } = require("../project/instructions");
const { buildAgentPrompt, buildFollowUpPrompt, buildResumePrompt } = require("./prompt");
const promptCache = require("./prompt-cache");
const { validateProgress, applyProgress } = require("./plan-progress");
const { updatePlan } = require("../tools/update-plan");
const {
    TOOLS,
    validateToolCall,
    describeCall,
    summarizeResult,
    readFile,
    listDirectory
} = require("../tools/tools");
const { execFile } = require("node:child_process");
function mcpAttemptKey(args){
    const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==="object"?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
    return JSON.stringify(canonical(args));
}

function git(args, cwd) {
    return new Promise(resolve => {
        execFile("git", args, { cwd, timeout: 3000, windowsHide: true }, (error, stdout) => {
            resolve(error ? null : String(stdout).trim());
        });
    });
}

const fsp = require("node:fs/promises");
const path = require("node:path");

// Ordre de priorité si plusieurs lockfiles sont présents.
const LOCKFILES = [
    ["pnpm-lock.yaml", "pnpm"],
    ["yarn.lock", "yarn"],
    ["package-lock.json", "npm"]
];

/** Gestionnaire de paquets (lockfile) et commande de test (package.json scripts.test). */
async function detectPackageInfo(workspace) {
    const info = { packageManager: null, testCommand: null, testScript: null };
    if (!workspace) return info;

    for (const [file, manager] of LOCKFILES) {
        const found = await fsp.access(path.join(workspace, file)).then(() => true, () => false);
        if (found) {
            info.packageManager = manager;
            break;
        }
    }

    try {
        const pkg = JSON.parse(await fsp.readFile(path.join(workspace, "package.json"), "utf8"));
        const script = pkg?.scripts?.test;
        if (typeof script === "string" && script.trim() && !/no test specified/i.test(script)) {
            info.testScript = script.trim();
            info.testCommand = `${info.packageManager || "npm"} test`;
        }
    } catch {
        // Pas de package.json, ou JSON invalide : commande de test inconnue.
    }

    return info;
}

/** Indices concrets sur le terminal, comme le bloc <env> de Claude Code. */
async function detectEnvironment(workspace) {
    const runtime = require("../execution-environment"), execution = runtime.projectEnvironment(workspace);
    if (execution.mode === "wsl") {
        const detected = await runtime.probe(workspace, execution.distribution);
        const { runProcess } = require("../tools/command/runner");
        const branch = await runProcess({ file: "git", args: ["branch", "--show-current"], cwd: workspace, timeoutMs: 5000, captureStdout: true });
        return { ...await detectPackageInfo(workspace), ...detected, execution: "wsl", git: Boolean(detected.git), branch: branch.exit_code === 0 ? branch.stdout.trim() : null };
    }
    const inside = await git(["rev-parse", "--is-inside-work-tree"], workspace);
    const branch = inside === "true" ? await git(["branch", "--show-current"], workspace) : null;

    return {
        git: inside === "true",
        branch,
        node: process.version,
        shell: process.platform === "win32"
            ? (process.env.PSModulePath ? "PowerShell" : "cmd")
            : (process.env.SHELL || null),
        ...(await detectPackageInfo(workspace))
    };
}

// Cache par workspace : environnement, instructions et contexte projet.
// Une entrée est invalidée si le mtime de package.json, .git/HEAD ou FRSTCLI.md change, ou après 60 s.
const AGENT_CONTEXT_TTL_MS = 60_000;
const agentContextCache = new Map();

async function mtimeOf(file) {
    try {
        return (await fsp.stat(file)).mtimeMs;
    } catch {
        return null;
    }
}

async function agentContextStamp(workspace) {
    if (!workspace) return "";

    const files = ["package.json", path.join(".git", "HEAD"), ...INSTRUCTIONS_FILES];
    const stamps = await Promise.all(files.map(file => mtimeOf(path.join(workspace, file))));

    return stamps.join("|");
}

async function loadAgentContext(workspace, now = Date.now()) {
    const key = workspace || "";
    const stamp = await agentContextStamp(workspace) + JSON.stringify(require("../execution-environment").projectEnvironment(workspace));
    const cached = agentContextCache.get(key);

    if (cached && cached.stamp === stamp && now - cached.at < AGENT_CONTEXT_TTL_MS) {
        return cached.value;
    }

    const value = {
        projectText: projectContext.promptContext(CONFIG.agentContextChars),
        env: await detectEnvironment(workspace),
        instructions: await loadInstructions(workspace)
    };

    agentContextCache.set(key, { stamp, at: now, value });
    return value;
}

function clearAgentContextCache() {
    agentContextCache.clear();
}

const fmt = n => Number(n).toLocaleString("fr-FR");

function clip(text, max) {
    const value = String(text);
    return value.length <= max ? value : `${value.slice(0, max)}\n... [tronqué]`;
}

/** Résumé du volume envoyé depuis `before` (snapshot de api.usage). */
function reportUsage(before) {
    const requests = api.usage.requests - before.requests;
    const chars = api.usage.chars - before.chars;

    if (requests <= 0) return;

    const reported = (api.usage.reported ?? 0) - (before.reported ?? 0);
    let tokens;

    if (reported > 0) {
        const input = (api.usage.inputTokens ?? 0) - (before.inputTokens ?? 0);
        const output = (api.usage.outputTokens ?? 0) - (before.outputTokens ?? 0);
        const cached = (api.usage.cachedTokens ?? 0) - (before.cachedTokens ?? 0);
        tokens =
            `${fmt(input)} tokens en entrée` +
            `${cached > 0 ? ` dont ${fmt(cached)} en cache` : ""}, ${fmt(output)} en sortie` +
            `${reported < requests ? ` ; usage fourni pour ${reported}/${requests} réponse(s)` : ""}`;
    } else {
        tokens = `≈ ${fmt(Math.round(chars / 3.5))} tokens`;
    }

    ui.info(
        `Coût de la demande : ${requests} requête(s), ${fmt(chars)} caractères envoyés (${tokens})`
    );
}

/* ---------- Analyse de la réponse du modèle ---------- */

function extractJsonObject(text) {
    const raw = String(text).trim();
    const candidates = [raw];

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) candidates.push(fenced[1].trim());

    for (const start of [...raw.matchAll(/\{/g)].map(m => m.index)) {
        let depth = 0;
        let inString = false;
        let escaped = false;

        for (let i = start; i < raw.length; i++) {
            const ch = raw[i];

            if (inString) {
                if (escaped) escaped = false;
                else if (ch === "\\") escaped = true;
                else if (ch === '"') inString = false;
                continue;
            }

            if (ch === '"') inString = true;
            else if (ch === "{") depth++;
            else if (ch === "}") {
                depth--;

                if (depth === 0) {
                    candidates.push(raw.slice(start, i + 1));
                    break;
                }
            }
        }
    }

    for (const candidate of candidates) {
        try {
            const parsed = JSON.parse(candidate);

            if (
                parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed) &&
                (parsed.type === "tool" || parsed.type === "final" || parsed.type === "question")
            ) {
                return parsed;
            }
        } catch {
            // candidat suivant
        }
    }

    return null;
}

function parseAgentResponse(text) {
    let action = extractJsonObject(text);

    if (!action) {
        throw new Error('Aucun objet JSON {"type":"tool"|"final"} trouvé.');
    }
    if (action.type === "question") {
        action = { type: "tool", name: "ask_user", reason: "Demander une précision à l’utilisateur", plan: action.plan, plan_progress: action.plan_progress, args: { question: action.question, options: action.options, multiple: action.multiple, placeholder: action.placeholder } };
    }

    if (action.plan_progress !== undefined) validateProgress(action.plan_progress);

    if (action.type === "final") {
        if (typeof action.message !== "string") {
            throw new Error("message doit être une chaîne.");
        }
        if (action.completed !== undefined && typeof action.completed !== "boolean") throw new Error("completed doit être un booléen.");
        return action;
    }

    if (action.calls !== undefined) {
        // Lecture en lot : jusqu'à MAX_BATCH_CALLS appels en lecture seule dans un seul tour.
        const MAX_BATCH_CALLS = 5;
        const BATCH_TOOLS = new Set(["list_directory", "read_file", "search_files"]);

        if (!Array.isArray(action.calls) || action.calls.length < 1 || action.calls.length > MAX_BATCH_CALLS) {
            throw new Error(`calls doit être une liste de 1 à ${MAX_BATCH_CALLS} appels.`);
        }

        action.calls = action.calls.map(call => {
            if (!call || typeof call !== "object" || !BATCH_TOOLS.has(call.name)) {
                throw new Error(`calls n'accepte que ${[...BATCH_TOOLS].join(", ")}.`);
            }

            const single = { type: "tool", name: call.name, args: call.args ?? {} };
            validateToolCall(single);
            return { name: single.name, args: single.args };
        });
    } else {
        validateToolCall(action);
    }

    if (action.plan !== undefined) {
        action.plan = Array.isArray(action.plan)
            ? action.plan.map(item => typeof item === "string"
                ? item.trim()
                : (item && typeof item.step === "string" ? item.step.trim() : ""))
                .filter(item => item && item.length <= 300).slice(0, 8)
            : undefined;
    }

    action.reason = typeof action.reason === "string"
        ? action.reason.trim().slice(0, 200)
        : undefined;

    return action;
}

/* ---------- Prompt ---------- */

/**
 * Résume en une seule observation les résultats d'outils trop anciens pour le
 * prompt : outil, arguments et succès, sans le contenu. Le modèle garde ainsi la
 * trace de ce qu'il a déjà fait (après un 409 ou sans conversation serveur).
 */
function compactObservations(list, maxEntries = 60) {
    const lines = list.slice(-maxEntries).map(o => {
        const args = JSON.stringify(o.args ?? {}).slice(0, 160);
        return `${o.tool} ${args} : ${o.ok ? "ok" : `erreur${o.error ? ` (${String(o.error).slice(0, 80)})` : ""}`}`;
    });

    return {
        tool: "historique_compacté",
        args: { actions: list.length },
        ok: true,
        result: {
            note: "Résultats plus anciens retirés du prompt (contenu omis). Relis un fichier si tu en as besoin.",
            omitted_before: Math.max(list.length - maxEntries, 0),
            actions: lines
        }
    };
}

const OBSERVATION_BUDGET_CHARS = 60_000;

/**
 * Nombre d'observations récentes gardées en entier : au plus maxKeep, et tant
 * que leur taille cumulée reste sous le budget (la plus récente est toujours gardée).
 */
function keepWithinBudget(list, maxKeep, budget = OBSERVATION_BUDGET_CHARS) {
    let total = 0;
    let keep = 0;

    for (let i = list.length - 1; i >= 0 && keep < maxKeep; i--) {
        const size = Math.min(JSON.stringify(list[i] ?? null).length, CONFIG.maxObservationChars);
        if (keep > 0 && total + size > budget) break;
        total += size;
        keep++;
    }

    return keep;
}

/**
 * Construit le prompt : les observations récentes en entier, les plus anciennes
 * résumées par compactObservations au lieu d'être perdues.
 */
function fitPrompt(context) {
    const all = context.observations;
    let keep = keepWithinBudget(all, Math.min(all.length, CONFIG.maxObservationsInPrompt));

    const build = () => {
        const dropped = all.slice(0, all.length - keep);
        const observations = [
            ...(dropped.length ? [compactObservations(dropped)] : []),
            ...all.slice(all.length - keep)
        ];
        return buildAgentPrompt({ ...context, observations });
    };

    let prompt = build();

    while (prompt.length > CONFIG.messageBudget && keep > 1) {
        keep--;
        prompt = build();
    }

    if (prompt.length > CONFIG.messageBudget) {
        throw new Error(
            `Contexte trop volumineux pour la limite de ${fmt(CONFIG.messageBudget)} caractères.`
        );
    }

    return prompt;
}

/** Ne garde dans l'historique des résultats que l'essentiel des arguments. */
function recordArgs(args) {
    const copy = { ...args };

    for (const key of ["content", "old_string", "new_string"]) {
        if (typeof copy[key] === "string") copy[key] = `<${copy[key].length} caractères>`;
    }

    return copy;
}

/* ---------- Pré-chargement ---------- */

async function preloadContext(task, observations) {
    const mentioned = [
        ...new Set(
            (task.match(/[\w@.\-/\\]+\.[A-Za-z0-9]{1,6}(?![\w])/g) || [])
                .map(p => p.replace(/^[.\\/]+(?=[^.\\/])/, ""))
        )
    ];

    // Le fichier affiché dans l'éditeur est relu en premier : c'est la cible la
    // plus probable quand l'utilisateur dit « ce fichier » sans le nommer.
    if (!state.chatIds.agent && state.activeFile && !mentioned.includes(state.activeFile)) {
        mentioned.unshift(state.activeFile);
    }

    for (const file of mentioned.slice(0, CONFIG.maxPreloadFiles)) {
        try {
            const result = await require("../tools/action-control").run("read_file", file, () => readFile({ path: file,start_line:1,end_line:160 }));

            ui.tool("read_file", file);
            ui.result(summarizeResult("read_file", result));

            observations.push({ tool: "read_file", args: { path: file,start_line:1,end_line:160 }, ok: true, result });
        } catch (error) {
            if (error.code === "ACTION_CANCELED") observations.push({ tool: "read_file", args: { path: file }, ok: false, error: "Préchargement annulé par l’utilisateur. Ne relis pas ce fichier sans nouvelle demande." });
            // Pas un fichier lisible : le modèle décidera.
        }
    }

    if (!observations.length && !state.chatIds.agent) {
        try {
            const result = await require("../tools/action-control").run("list_directory", ".", () => listDirectory({ path: "." }));

            ui.tool("list_directory", ".");
            ui.result(summarizeResult("list_directory", result));

            observations.push({ tool: "list_directory", args: { path: "." }, ok: true, result });
        } catch {
            // ignoré
        }
    }
}

/* ---------- Repli : réponse finale locale, sans requête supplémentaire ---------- */

function protocolFallbackMessage(observations, changedCount) {
    const lastError = observations.findLast?.(item => item.error)?.error || "réponse incompatible avec le protocole d’outils";
    const evidence = observations.length
        ? `\n\nL’agent avait déjà reçu ${observations.length} résultat(s) d’outil.`
        : "";
    const changes = changedCount > 0
        ? ` Les modifications réalisées pendant cette demande (${changedCount}) sont conservées.`
        : " Aucune modification locale n’a été exécutée après cette erreur.";
    return `Je n’ai pas pu poursuivre cette demande car le modèle a renvoyé une réponse que l’IDE ne peut pas interpréter (${clip(lastError, 240)}).${evidence}${changes} Tu peux réessayer dans cette conversation ou choisir un autre modèle.`;
}

function deniesWorkspaceAccess(message) {
    const text=String(message||"");
    const denial=/(?:i\s*(?:do not|don't|cannot|can't)\s+(?:access|read|modify|change|run)|(?:je\s+)?n['’]ai\s+(?:pas|aucun|plus)\s+(?:d['’]?\s*)?acc[eè]s|je\s+ne\s+peux\s+pas\s+(?:(?:moi-même|directement)\s+)?(?:lire|modifier|acc[eè]der|lancer|d[eé]clencher|utiliser))/i.test(text);
    return denial&&/(?:files?|folders?|project|repository|code|commands?|terminal|tools?|fichiers?|dossiers?|projet|commandes?|outils?)/i.test(text);
}

function hasExplicitWorkspaceBlock(observations) {
    return observations.some(item=>{
        const error=String(item.error||item.result?.error||item.result?.message||"");
        return item.result?.denied===true||item.result?.cancelled===true||
            /ACTION_CANCELED|EACCES|EPERM|permission denied|access denied|refus[eé]e? par l'utilisateur|annul[eé]e? par l'utilisateur/i.test(error)||
            item.tool==="batch"&&hasExplicitWorkspaceBlock(item.result?.results||[]);
    });
}

/* ---------- Boucle agent ---------- */

async function runAgent(task, options = {}) {
    activateConversation("agent");
    state.agentPlan = [];
    if (task.length > CONFIG.messageBudget / 2) {
        throw new Error(
            `Demande trop longue : ${fmt(task.length)} caractères ` +
            `(limite ${fmt(CONFIG.maxMessageChars)} par message).`
        );
    }

    const usageBefore = { ...api.usage };

    const observations = [];
    let recoveredUnsupportedTool = false;
    let recoveredWorkspaceAccess = false;
    const changesBefore = memory.sessionChanges();

    // Point de reprise : /rewind peut annuler d'un coup tout ce que cette demande a modifié.
    if (state.workspace && !state.motionDesign && !options.readOnly) {
        try {
            require("../project/checkpoints").addCheckpoint({
                task,
                workspace: state.workspace,
                historyLength: state.history.length
            });
        } catch (error) {
            ui.debug(`Point de reprise non enregistré : ${error.message}`);
        }
    }
    const signatures = new Map();
    const uncertainMcpCalls=new Set();
    const readDelivery=require("./token-economy").createReadDeliveryCache();
    const { projectText: codeProjectText, env, instructions } = state.motionDesign
        ? {projectText:"",env:{},instructions:""}
        : await loadAgentContext(state.workspace);
    const projectText = state.motionDesign
        ? "Espace Motion design : le projet actif est dans EffectCraft. Inspecte-le avec effectcraft project.summary ; les fichiers de code ouverts ne décrivent pas cette composition."
        : codeProjectText;

    // Pré-prompt utilisateur/projet et faits appris (vide si rien n'est configuré).
    // Il n'entre que dans le message complet (fullPrompt), pas dans les relances de suivi.
    let preprompt = "";
    try {
        preprompt = state.motionDesign ? "" : profile.buildPreprompt();
    } catch {
        preprompt = "";
    }

    // Outils MCP (mcp.json) : serveurs démarrés une seule fois, catalogue injecté dans le message complet.
    let mcpCatalog = "";
    try {
        const mcp = require("../mcp/manager").manager;
        const reloadsBefore = mcp.reloadCount();
        const servers = state.motionDesign ? [] : await mcp.ensureStarted();
        if (mcp.reloadCount() > reloadsBefore) ui.info("mcp.json modifié : serveurs MCP redémarrés.");
        for (const server of servers) {
            if (server.status === "failed") ui.warn(`MCP ${server.name} : ${server.error}`);
        }
        mcpCatalog = state.motionDesign ? "" : mcp.catalog();
    } catch (error) {
        ui.warn(`MCP indisponible : ${error.message}`);
    }

    // Skills (SKILL.md utilisateur et projet) : catalogue injecté dans le message complet.
    let skillsCatalog = "";
    try {
        skillsCatalog = await require("../skills").catalog(state.motionDesign ? require("../motion-workspace").motionWorkspace() : state.workspace || null, state.motionDesign ? "effectcraft" : "code");
    } catch (error) {
        ui.warn(`Skills indisponibles : ${error.message}`);
    }

    // Réglage extensionsMode : "auto" = l'agent décide seul d'utiliser un skillou un MCP ;
    // "manual" = seuls les skills / serveurs / outils MCP nommés dans la demande restent proposés.
    try {
        const mode = require("../settings").extensionsMode();
        ({ mcpCatalog, skillsCatalog } = require("./extensions").selectExtensions({
            mode,
            task,
            mcpCatalog,
            skillsCatalog
        }));
        } catch (error) {
        ui.warn(`Réglage skills/MCP illisible : ${error.message}`);
    }

    // Hooks (hooks.json utilisateur et .frst/hooks.json du projet) : scripts lancés autour des outils.
    const hooks = require("./hooks");
    let hookConfig = null;
    try {
        hookConfig = state.motionDesign ? null : await hooks.loadHooks({ workspace: state.workspace, ui });
    } catch (error) {
        ui.warn(`Hooks indisponibles : ${error.message}`);
    }

    let stuck = 0;

    async function saveConversation() {
        if (!state.chatIds.agent) return;

        const settings = {
            model: state.model,
            webSearch: state.webSearch,
            private: state.private,
            incognito: state.incognito,
            autoApprove: state.autoApprove,
            motionDesign:!!state.motionDesign,
        };

        state.conversationSettings.agent = settings;
        await conversations.touch({
            id: state.chatIds.agent,
            firstMessage: task,
            model: state.model,
            workspace: state.motionDesign ? require("../motion-workspace").motionWorkspace() : state.workspace,
            mode: "agent",
            settings,
        });
    }

    async function finish(message, title) {
        ui.assistant(message);
        record("user", task);
        record("assistant", message);
        await saveConversation();
        if(typeof title==="string" && title.trim() && title.length<=100 && state.chatIds.agent)await conversations.rename(state.chatIds.agent,title,"ai");

        reportUsage(usageBefore);

        const changed = memory.sessionChanges() - changesBefore;

        if (changed > 0) {
            ui.info(
                `${changed} modification(s) enregistrée(s) | /undo annule la dernière | /changes en liste l'historique`
            );
        }
    }

    if (!state.motionDesign) await preloadContext(task, observations);

    // Mode normal sans plafond ; Éco borne le travail automatique à quatre tours.
    const maxTurns = state.ecoMode ? 4 : 0;
    let deferredSteering = [];
    let requestNumber = 0;
    let recoveredMcpDenial = false;

    for (let turn = 1; ; turn++) {
        if (maxTurns && turn > maxTurns) {
            const message = "Limite du mode Éco atteinte (4 tours). Le travail peut être incomplet ; les modifications déjà effectuées sont conservées. Désactive le mode Éco ou envoie une nouvelle demande pour continuer.";
            await finish(message);
            return { completed: false, message };
        }
        if (options.shouldStop?.()) {
            await finish("Tâche interrompue. Les tâches suivantes restent en attente.");
            return { completed: false, message: "Tâche interrompue." };
        }
        const steering = [...deferredSteering, ...(options.drainSteering?.() || [])];
        deferredSteering = [];
        if (steering.length) {
            task += `\n\nCONSIGNES SUPPLÉMENTAIRES DE L’UTILISATEUR\n${steering.join("\n\n")}`;
            ui.info("Nouvelle consigne reçue : prise en compte à cette étape.");
        }
        let action = null;
        let correction = null;
        let lastResponse;
        let protocolFailure=null;

        const spin = ui.spinner(turn === 1 ? "Réflexion" : `Réflexion (tour ${turn})`);

        try {
            for (let attempt = 1; attempt <= (state.ecoMode ? 1 : CONFIG.maxProtocolAttempts); attempt++) {
                requestNumber++;
                // Message complet : instructions, projet, demande, résultats d'outils.
                const fullPrompt = withProject => fitPrompt({
                    workspace: state.motionDesign ? null : state.workspace,
                    env,
                    task,
                    history: state.history.slice(-6),
                    memorySummary: state.motionDesign ? "" : memory.summary(),
                    projectContext: withProject ? (state.ecoMode && projectText.length > 20000 ? projectText.slice(0, 20000) + "\n[Mode Éco : contexte projet réduit. Lire les fichiers nécessaires avec les outils.]" : projectText) : "",
                    projectOmitted: !withProject,
                    instructions,
                    preprompt,
                    mcpCatalog,
                    skillsCatalog,
                    observations,
                    plan: state.agentPlan,
                    requestNumber,
                    turn,
                    maxTurns,
                    correction,
                    activeFile: state.motionDesign ? null : state.activeFile,
                    editorFiles: state.motionDesign ? [] : state.openFiles
                });

                // Une conversation agent existe côté serveur (identifiant reçu) : elle garde
                // l'historique. Le contexte projet n'est donc envoyé qu'à son premier message,
                // et les tours 2 et suivants n'envoient que le dernier résultat d'outil.
                // Sans conversation (aucun identifiant reçu), on renvoie tout, projet compris.
                const hasConversation = Boolean(state.chatIds.agent);
                const signature=promptCache.fingerprint({
                    workspace:state.motionDesign?null:state.workspace,model:state.model,motion:!!state.motionDesign,
                    env,instructions,preprompt,mcpCatalog,skillsCatalog,
                    fullAccess:state.fullAccess,autoApprove:state.autoApprove,autoApproveCommands:state.autoApproveCommands,
                    eco:state.ecoMode,web:state.webSearch,automaticWeb:state.automaticWeb
                });
                const originalChat=state.chatIds.agent;
                let startedFreshConversation=false;
                const deliveryScope={id:originalChat,model:state.model,workspace:state.workspace,motion:Boolean(state.motionDesign)};
                const lastObservation=observations[observations.length-1];
                const reuseInstructions=promptCache.has(originalChat,signature);
                const prompt = turn > 1 && hasConversation && reuseInstructions
                    ? buildFollowUpPrompt({
                        lastObservation: readDelivery.delivery(lastObservation,deliveryScope,CONFIG.maxObservationChars),
                        turn,
                        maxTurns,
                        correction,
                        steering,
                        plan: state.agentPlan,
                        requestNumber
                    })
                    : reuseInstructions
                        ? buildResumePrompt({task,observations,activeFile:state.motionDesign?null:state.activeFile,
                            editorFiles:state.motionDesign?[]:state.openFiles,plan:state.agentPlan,requestNumber,correction,mcpCatalog:state.motionDesign?"":mcpCatalog})
                        : fullPrompt(!hasConversation);

                try{lastResponse = await api.requestModel(prompt, {
                    conversationMode: "agent",
                    // Si un 409 impose un nouveau fil, le serveur n'a plus son historique.
                    // On renvoie donc la tâche, les observations et l'historique récent, mais
                    // pas tout l'index projet : l'agent peut relire les fichiers utiles.
                    freshMessage: () => { startedFreshConversation=true; return fullPrompt(false); }
                });}catch(error){
                    if(!error.localToolProtocol)throw error;
                    protocolFailure=error;
                    correction={error:String(error.message).slice(0,800)};
                    ui.debug("Réponse d’outil invalide : correction bornée au protocole, sans exécution ni relance réseau automatique.");
                    continue;
                }
                // Only cache a known full bootstrap; a compacted/replaced conversation must bootstrap again.
                const knownBootstrap=!originalChat||originalChat===state.chatIds.agent||startedFreshConversation;
                if(knownBootstrap)readDelivery.remember(lastObservation,{...deliveryScope,id:state.chatIds.agent},CONFIG.maxObservationChars);
                if(!reuseInstructions&&knownBootstrap){
                    promptCache.remember(state.chatIds.agent,signature);
                }

                try {
                    action = parseAgentResponse(lastResponse);
                    if (action.plan_progress !== undefined && action.name !== "update_plan") {
                        validateProgress(action.plan_progress, state.agentPlan.length ? state.agentPlan : action.plan || []);
                    }
                    break;
                } catch (error) {
                    action = null;
                    ui.debug(
                        `Réponse invalide (${attempt}/${CONFIG.maxProtocolAttempts}) : ` +
                        `${error.message}\n${lastResponse.slice(0, 400)}`
                    );

                    correction = {
                        error: error.message,
                        previousResponse: lastResponse.slice(0, 300)
                    };
                }
            }
        } finally {
            spin.stop();
        }

        if (options.shouldStop?.()) {
            await finish("Tâche interrompue. Les tâches suivantes restent en attente.");
            return { completed: false, message: "Tâche interrompue." };
        }
        if (!action) {
            if(protocolFailure){
                // A provider can reject a native tool envelope even though the
                // model response itself is still usable. Do not present this
                // transport detail as a hard suspension: keep the results
                // already received and offer a concise local retry message.
                const message = protocolFallbackMessage(observations, memory.sessionChanges() - changesBefore);
                await finish(message);
                return { completed: false, message };
            }
            if (state.ecoMode) {
                const message = protocolFallbackMessage(observations, memory.sessionChanges() - changesBefore);
                await finish(message);
                return { completed: false, message };
            }
            record("user", task);
            const message = protocolFallbackMessage(observations, memory.sessionChanges() - changesBefore);
            ui.assistant(message);
            record("assistant", message);
            await saveConversation();
            reportUsage(usageBefore);
            return { completed: false, message: "La réponse de l’agent n’a pas suivi le protocole d’outils." };
        }

        if (action.type === "tool" && action.plan?.length && !state.agentPlan.length) {
            updatePlan({ steps: action.plan.map((step, index) => ({ step, status: index === 0 ? "in_progress" : "pending" })) });
        }

        if (action.type === "final"&&!state.motionDesign&&!recoveredMcpDenial&&!state.ecoMode&&!options.readOnly&&
            require("./mcp-access").untestedMcpDenial(action.message,mcpCatalog,observations,task)) {
            const candidate=require("./mcp-access").selectMcpTool(mcpCatalog,task+" "+action.message);
            if(candidate){
                recoveredMcpDenial=true;
                observations.push({tool:"local_mcp_protocol",ok:false,error:
                    "L’IDE fournit ci-dessous le schéma réel d’un outil du catalogue MCP local, sans appel à l’application. Utilise les outils disponibles pour vérifier la connexion demandée ; ce schéma seul ne prouve pas que l’application répond. Respecte les refus/annulations et explique tout échec réel. Cette récupération n’est tentée qu’une fois."});
                // Go through the normal tool path: validation, hooks, cancellation, UI and observations.
                // describe:true only reads registered schema; it never executes an application command.
                action={type:"tool",name:"mcp_call",args:{...candidate,describe:true},reason:"Découvrir les arguments du connecteur MCP disponible"};
                validateToolCall(action);
            }
        }

        if(action.type==="final"&&!recoveredWorkspaceAccess&&!state.motionDesign&&state.workspace&&
            deniesWorkspaceAccess(action.message)&&!hasExplicitWorkspaceBlock(observations)){
            recoveredWorkspaceAccess=true;
            action={type:"tool",name:"list_directory",args:{path:"."},reason:"Vérifier l’accès local au dossier de projet sélectionné"};
            validateToolCall(action);
            ui.info("Je vérifie l’accès au dossier de projet sélectionné, puis l’agent reprend la demande.");
        }

        if (action.type === "final") {
            if (recoveredWorkspaceAccess && deniesWorkspaceAccess(action.message) && !hasExplicitWorkspaceBlock(observations)) {
                action.message = "L’IDE a pu vérifier le dossier du projet, mais le modèle affirme encore ne pas pouvoir accéder aux outils ou aux fichiers. La demande reste incomplète ; tu peux réessayer ou choisir un autre modèle.";
                action.completed = false;
            }
            if (!recoveredUnsupportedTool && /Unsupported tool ignored by the backend/i.test(action.message) &&
                !observations.some(o => ["write_file", "run_command"].includes(o.tool) && (!o.ok || o.result?.denied))) {
                recoveredUnsupportedTool = true;
                observations.push({ tool: "local_tool_protocol", ok: false,
                    error: state.motionDesign ? "Le backend ne pilote pas les outils locaux. Utilise le catalogue EffectCraft et un objet JSON de type tool dans le texte de ta reponse. Les outils du projet code ne sont pas disponibles dans cet espace." : "Le backend n’exécute pas les outils locaux. Aucun échec local de write_file ou run_command n’a été reçu. Reprends la tâche : renvoie dans le TEXTE un objet JSON {\"type\":\"tool\",\"name\":\"write_file\",\"args\":{\"path\":\"...\",\"content\":\"...\"},\"reason\":\"...\"}, ou un autre outil du catalogue. N’utilise pas les appels natifs du fournisseur. L’application validera puis exécutera l’outil avec les permissions existantes. Ne prétends pas avoir créé un fichier avant le résultat local." });
                continue;
            }
            const lateSteering = options.drainSteering?.() || [];
            if (lateSteering.length) {
                deferredSteering = lateSteering;
                continue;
            }
            if (action.plan_progress !== undefined) applyProgress(state.agentPlan, action.plan_progress);
            await finish(action.message, action.conversation_title);
            return { completed: action.completed !== false, message: action.message };
        }

        if (action.plan_progress !== undefined && action.name !== "update_plan") applyProgress(state.agentPlan, action.plan_progress);

        if (state.ecoMode && action.name === "task") {
            const message = "Le mode Éco ne lance pas de sous-agents pour limiter les appels IA. Désactive-le pour poursuivre cette exploration.";
            await finish(message);
            return { completed: false, message };
        }
        if (action.reason) ui.reason(action.reason);

        // Garde-fou : la même action, ou le même lot de lectures, répétée en boucle n'est plus exécutée.
        const signature = action.calls
            ? `calls:${JSON.stringify(action.calls)}`
            : `${action.name}:${JSON.stringify(action.args)}`;
        const seen = (signatures.get(signature) || 0) + 1;

        signatures.set(signature, seen);

        if (seen >= 3) {
            stuck++;
            ui.result("Action répétée : ignorée", { tone: "error" });

            observations.push({
                tool: action.calls ? "batch" : action.name,
                args: action.calls ? { calls: action.calls.length } : recordArgs(action.args),
                ok: false,
                error: "Action déjà exécutée plusieurs fois avec les mêmes arguments. Change de démarche ou termine avec final."
            });

            if (stuck >= 2) {
                await finish("Je tourne en rond : j'arrête ici. Précise ta demande ou le fichier concerné.");
                return { completed: false, message: "L’agent s’est arrêté car il répétait les mêmes actions." };
            }

            continue;
        }

        const mcpKey=action.name==="mcp_call"&&action.args.describe!==true?mcpAttemptKey(action.args):null;
        if(mcpKey&&uncertainMcpCalls.has(mcpKey)){
            observations.push({tool:action.name,args:recordArgs(action.args),ok:false,error:"Cet appel MCP a déjà été envoyé sans résultat confirmé. Il n’est pas relancé pour éviter une action en double. Vérifie l’état avec un autre outil de lecture, ou explique le blocage."});
            ui.result("Appel MCP non répété : résultat précédent incertain.",{tone:"error"});
            if(++stuck>=2){
                const message="L’agent insiste sur une action MCP dont le résultat est incertain. La tâche est suspendue pour éviter une exécution en double et des requêtes inutiles. Les modifications déjà effectuées sont conservées.";
                await finish(message);return {completed:false,message};
            }
            continue;
        }
        if (action.calls) {
            // Lectures seules : exécutées en parallèle, observations et affichage dans l'ordre des appels.
            // Hooks preToolUse lancés avant chaque appel, dans l'ordre : un appel bloqué n'est pas exécuté.
            const useHooks = Boolean(hookConfig && hooks.hasHooks(hookConfig));
            const blocked = [];

            for (const call of action.calls) {
                let reason = null;

                if (useHooks) {
                    try {
                        const pre = await hooks.runPreToolHooks(hookConfig, {
                            tool: call.name,
                            args: call.args,
                            workspace: state.workspace,
                            ui
                        });
                        if (pre.blocked) reason = pre.message;
                    } catch (error) {
                        reason = error.message;
                    }
                }

                blocked.push(reason);
            }

            const settled = await Promise.allSettled(
                action.calls.map((call, index) => Promise.resolve().then(async () => {
                    if (blocked[index]) throw new Error(blocked[index]);

                    const result = await require("../tools/action-control").run(call.name, describeCall(call), () => TOOLS[call.name].run(call.args));

                    // Hooks postToolUse : leur sortie est jointe au résultat de l'appel.
                    if (useHooks && result && typeof result === "object" && !result.denied) {
                        const reports = await hooks.runPostToolHooks(hookConfig, {
                            tool: call.name,
                            args: call.args,
                            workspace: state.workspace,
                            ui
                        });
                        if (reports.length) result.hooks = reports;
                    }

                    return result;
                }))
            );

            const results = action.calls.map((call, index) => {
                const outcome = settled[index];

                ui.tool(call.name, describeCall(call));

                if (outcome.status === "fulfilled") {
                    ui.result(summarizeResult(call.name, outcome.value));
                    return { tool: call.name, args: recordArgs(call.args), ok: true, result: outcome.value };
                }

                const message = outcome.reason?.message ?? String(outcome.reason);

                ui.result(message, { tone: "error" });
                return { tool: call.name, args: recordArgs(call.args), ok: false, error: message };
            });

            observations.push({
                tool: "batch",
                args: { calls: action.calls.length },
                ok: results.every(item => item.ok),
                result: { results }
            });

            continue;
        }

        // Mode plan (/plan) : lecture seule, toute autre action est refusée sans être exécutée.
        if (options.readOnly && !["list_directory", "read_file", "read_attachment", "search_files", "task", "semantic_search", "web_search", "web_search_result", "web_fetch", "update_plan", "ask_user"].includes(action.name)) {
            ui.result(`Mode plan : ${action.name} refusé (lecture seule)`, { tone: "error" });
            observations.push({
                tool: action.name,
                args: recordArgs(action.args),
                ok: false,
                error: "Mode plan : seuls les outils de lecture, de recherche et de suivi du plan sont permis. Termine avec final et le plan détaillé."
            });
            continue;
        }

        ui.tool(action.name, describeCall(action));

        const recorded = action.name === "ask_user" ? { question: action.args.question } : recordArgs(action.args);

        try {
            // Hooks preToolUse : un code de sortie non nul bloque l'outil.
            if (hookConfig && hooks.hasHooks(hookConfig)) {
                const pre = await hooks.runPreToolHooks(hookConfig, {
                    tool: action.name,
                    args: action.args,
                    workspace: state.workspace,
                    ui
                });
                if (pre.blocked) throw new Error(pre.message);
            }

            const result = await require("../tools/action-control").run(action.name, describeCall(action), () => TOOLS[action.name].run(action.args));

            // Hooks postToolUse (formatage, lint...) : leur sortie est jointe au résultat pour l'agent.
            if (hookConfig && hooks.hasHooks(hookConfig) && result && !result.denied) {
                const reports = await hooks.runPostToolHooks(hookConfig, {
                    tool: action.name,
                    args: action.args,
                    workspace: state.workspace,
                    ui
                });
                if (reports.length && typeof result === "object") result.hooks = reports;
            }

            const sources = action.name === "web_fetch" && result.status >= 200 && result.status < 300
                ? [{ url: result.final_url || result.url, title: result.title || result.final_url || result.url, consulted: true }]
                : ["web_search","web_search_result"].includes(action.name) ? (result.results || []).map(s => ({ url: s.url, title: s.title, consulted: false })) : [];
            ui.result(summarizeResult(action.name, result), { sources, tone: result.denied || result.interrupted || result.is_error || (typeof result.exit_code === "number" && result.exit_code !== 0) ? "error" : null });

            observations.push({
                tool: action.name,
                args: recorded,
                ok: !result.denied&&!result.interrupted&&!result.is_error&&!(typeof result.exit_code==="number"&&result.exit_code!==0),
                result
            });
            if(action.name==="list_directory"&&recoveredWorkspaceAccess&&(result.denied||result.interrupted||result.is_error||result.error)){
                const detail=result.message||result.error||"l’accès a été refusé ou interrompu";
                const message=`La vérification locale du dossier de projet n’a pas abouti : ${clip(detail,240)}. Je n’ai pas relancé l’agent et aucun refus n’a été contourné.`;
                await finish(message);return {completed:false,message};
            }
            if(action.name==="list_directory"&&recoveredWorkspaceAccess&&!result.denied&&!result.interrupted&&!result.is_error){
                deferredSteering.push("L’IDE vient de vérifier localement le dossier de projet sélectionné : le résultat list_directory ci-joint confirme l’accès à son contenu. Poursuis la demande avec les outils locaux adaptés. Ne répète pas une affirmation générale d’absence d’accès ; si une action précise échoue, base-toi sur son erreur réelle.");
            }
        } catch (error) {
            ui.result(error.message, { tone: "error" });

            if(action.name==="list_directory"&&recoveredWorkspaceAccess){
                const message=`La vérification locale du dossier de projet a échoué : ${clip(error.message,240)}. Je n’ai pas relancé l’agent et aucun refus n’a été contourné.`;
                await finish(message);return {completed:false,message};
            }

            if(mcpKey&&error.executionUncertain)uncertainMcpCalls.add(mcpKey);

            observations.push({
                tool: action.name,
                args: recorded,
                ok: false,
                error: error.message
            });
        }
    }
}

module.exports = {
    runAgent,
    parseAgentResponse,
    extractJsonObject,
    fitPrompt,
    compactObservations,
    loadAgentContext,
    clearAgentContextCache,
    keepWithinBudget
};
