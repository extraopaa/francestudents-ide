/* One plan surface, updated in place; transcript events remain in history/export. */
function workPlanItems(items) {
    return (Array.isArray(items) ? items : []).map(item => {
        const value = String(item || "").trim();
        const completed = /^(?:✓|✔|\[[xX]\])\s*/.test(value);
        const current = /^(?:◉|●|\[~\])\s*/.test(value);
        return { step: value.replace(/^(?:✓|✔|◉|●|○|\[[xX ~]?\])\s*/, ""), status: completed ? "completed" : current ? "in_progress" : "pending" };
    });
}
function renderWorkPlan(items, { status = "idle" } = {}) {
    const host = $("agent-live-plan"); if (!host) return;
    const steps = (Array.isArray(items) ? items : []).filter(step => step && typeof step.step === "string" && step.step.trim()).map(step => ({
        step: step.step.trim(), status: ["completed", "in_progress"].includes(step.status) ? step.status : "pending"
    }));
    const signature = JSON.stringify({ steps, status });
    if (host.dataset.signature === signature) return;
    host.dataset.signature = signature;
    if (!steps.length) { host.replaceChildren(); host.classList.add("hidden"); return; }
    const previous = host.querySelector("details"), wasFocused = previous?.querySelector("summary") === document.activeElement;
    const previousScroll = host.querySelector("ol")?.scrollTop || 0;
    const detail = document.createElement("details"); detail.open = previous ? previous.open : status !== "history";
    const done = steps.filter(step => step.status === "completed").length;
    const complete = done === steps.length;
    const label = complete ? "Terminé" : status === "interrupted" ? "Interrompu" : ["done", "failed"].includes(status) ? "À poursuivre" : status === "history" ? "Historique" : "En cours";
    host.dataset.state = complete ? "completed" : status;
    const summary = document.createElement("summary");
    const heading = document.createElement("span"); heading.className = "work-plan-heading";
    const title = document.createElement("strong"); title.textContent = "Plan de travail";
    const count = document.createElement("span"); count.className = "work-plan-count"; count.textContent = `${done}/${steps.length}`;
    const state = document.createElement("span"); state.className = "work-plan-state"; state.textContent = label;
    const chevron = document.createElement("span"); chevron.className = "work-plan-chevron";
    chevron.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4"/></svg>';
    heading.append(title, count, state, chevron);
    const progress = document.createElement("progress"); progress.max = steps.length; progress.value = done;
    progress.setAttribute("aria-label", `${done} étape${done > 1 ? "s" : ""} terminée${done > 1 ? "s" : ""} sur ${steps.length}`);
    summary.append(heading, progress);
    const list = document.createElement("ol"); list.className = "work-plan-steps";
    steps.forEach((step, index) => {
        const row = document.createElement("li"); row.dataset.status = step.status;
        if (step.status === "in_progress") row.setAttribute("aria-current", "step");
        const marker = document.createElement("span"); marker.className = "work-plan-marker"; marker.setAttribute("aria-hidden", "true");
        if (step.status === "completed") marker.innerHTML = '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-8"/></svg>';
        else marker.textContent = String(index + 1);
        const text = document.createElement("span"); text.className = "work-plan-step-text"; text.textContent = step.step;
        const accessibleStatus = document.createElement("span"); accessibleStatus.className = "work-plan-sr-status";
        accessibleStatus.textContent = step.status === "completed" ? "Terminée : " : step.status === "in_progress" ? "En cours : " : "À venir : ";
        row.append(marker, accessibleStatus, text); list.append(row);
    });
    detail.append(summary, list); host.replaceChildren(detail); host.classList.remove("hidden");
    list.scrollTop = previousScroll;
    if (wasFocused) summary.focus();
}
