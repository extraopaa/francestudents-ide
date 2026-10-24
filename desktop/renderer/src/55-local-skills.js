/* Local file selection is performed by the native dialog, never by agent paths. */
for (const [kind, label] of [["file", "Importer un fichier"], ["directory", "Importer un dossier"]]) {
    const button = document.createElement("button"); button.type = "button";
    button.id = `btn-skill-import-${kind}`; button.textContent = label;
    button.title = kind === "file" ? "Importer un SKILL.md ou une archive ZIP téléchargée" : "Importer un dossier de skill avec ses scripts et références";
    $("btn-skill-new").before(button);
    button.onclick = async () => {
        button.disabled = true;
        try { const preview = await api.localSkillImport(kind); if (preview) openSkillEditor({ kind: "local", item: preview }); }
        catch (error) { $("center-message").textContent = error.message; }
        finally { button.disabled = false; }
    };
}
