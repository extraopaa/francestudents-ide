/* One welcome card after each installed update; no network request is needed. */
let releaseHighlightsData=null,releaseHighlightsShown=false,releaseDialogStage="notes",releaseAutomatic=false;
const releaseDialog=document.createElement("dialog");releaseDialog.id="release-highlights";releaseDialog.className="release-highlights";releaseDialog.setAttribute("aria-labelledby","release-highlights-title");document.body.append(releaseDialog);
function openReleaseHighlights(data,{automatic=false}={}){
    if(releaseDialog.open)return;
    releaseAutomatic=automatic;releaseDialogStage="notes";
    releaseHighlightsShown=true;releaseDialog.replaceChildren();
    const top=centerNode("div","release-notes-top");top.append(centerNode("span","release-notes-badge",`NOUVEAUTÉS · ${data.version}`));
    const close=centerNode("button","release-notes-close","×");close.type="button";close.setAttribute("aria-label","Fermer les nouveautés");close.onclick=()=>releaseDialog.close();top.append(close);
    const heading=centerNode("h2","",data.headline);heading.id="release-highlights-title";
    releaseDialog.append(top,centerNode("p","release-notes-brand","FranceStudent IDE"),heading,centerNode("p","release-notes-intro","Voici ce qui change dans cette version. Ton travail reste à sa place."));
    const list=centerNode("div","release-notes-list");
    for(const item of data.items){const row=centerNode("div","release-notes-item"),icon=centerNode("span","release-notes-icon");icon.innerHTML=apiNoticeIcon(item.icon==="clock"?"wait":item.icon);const body=centerNode("div");body.append(centerNode("strong","",item.title),centerNode("p","",item.text));row.append(icon,body);list.append(row);}
    const footer=centerNode("div","release-notes-footer"),more=centerNode("button","","Notes complètes");more.type="button";more.onclick=()=>api.openExternal(data.url).catch(error=>studioFeedback(error.message));
    const done=centerNode("button","primary","C’est parti !");done.type="button";done.onclick=()=>releaseDialog.close();footer.append(more,done);releaseDialog.append(list,footer);
    releaseDialog.showModal();done.focus();
}
function openFileVersionsIntro(){
    releaseDialogStage="fileVersions";releaseDialog.replaceChildren();
    const top=centerNode("div","release-notes-top");top.append(centerNode("span","release-notes-badge","NOUVEAU · VERSIONS DES FICHIERS"));
    const close=centerNode("button","release-notes-close","×");close.type="button";close.setAttribute("aria-label","Fermer la présentation");close.onclick=()=>releaseDialog.close();top.append(close);
    const heading=centerNode("h2","","Reviens avant une demande à l’agent");heading.id="release-highlights-title";
    releaseDialog.append(top,centerNode("p","release-notes-brand","FranceStudent IDE"),heading,centerNode("p","release-notes-intro","Si une modification ne te convient pas, tu peux retrouver une version précédente de tes fichiers."));
    const list=centerNode("div","release-notes-list");
    for(const [icon,title,text] of [
        ["clock","Une version locale avant la demande","Pour les projets ouverts, l’agent sauvegarde les fichiers enregistrés et non exclus avant chaque demande modifiable. Si la sauvegarde échoue, la demande est arrêtée."],
        ["tools","Où la retrouver ?","Dans l’espace Agent, ouvre Activité puis Versions des fichiers. Choisis une demande et clique sur Voir et restaurer pour examiner les fichiers concernés avant de confirmer."],
        ["spark","Quelques limites à connaître","Les fichiers non enregistrés, sensibles ou exclus ne sont pas sauvegardés. Une restauration peut retirer des fichiers créés depuis la version choisie ; les actions externes ne sont pas annulées."]
    ]){const row=centerNode("div","release-notes-item"),symbol=centerNode("span","release-notes-icon");symbol.innerHTML=apiNoticeIcon(icon==="clock"?"wait":icon);const body=centerNode("div");body.append(centerNode("strong","",title),centerNode("p","",text));row.append(symbol,body);list.append(row);}
    const footer=centerNode("div","release-notes-footer"),done=centerNode("button","primary","J’ai compris");done.type="button";done.onclick=()=>releaseDialog.close();footer.append(done);releaseDialog.append(list,footer);releaseDialog.showModal();done.focus();
}
let releaseAfterClose=null;
function openRobloxIntro(){
    releaseDialogStage="roblox";releaseAfterClose=null;releaseDialog.replaceChildren();
    const top=centerNode("div","release-notes-top");top.append(centerNode("span","release-notes-badge","NOUVEAU · ROBLOX & BLENDER"));
    const close=centerNode("button","release-notes-close","×");close.type="button";close.setAttribute("aria-label","Fermer la présentation");close.onclick=()=>releaseDialog.close();top.append(close);
    const heading=centerNode("h2","",`Crée des modèles 3D pour Roblox avec Blender`);heading.id="release-highlights-title";
    releaseDialog.append(top,centerNode("p","release-notes-brand","FranceStudent IDE"),heading,centerNode("p","release-notes-intro","Cette intégration provient du projet communautaire francestudents-code-Roblox. L’agent peut concevoir un objet 3D dans Blender, le vérifier puis le préparer pour Roblox Studio, sans quitter l’IDE."));
    const list=centerNode("div","release-notes-list release-notes-list-scroll");
    for(const [icon,title,text] of [
 ["tools","Un sous-agent « Modélisation 3D (Blender → Roblox) »","Demande par exemple « crée un arbre low-poly pour mon jeu Roblox ». L’agent écrit un script Blender et l’exécute en arrière-plan. Il exporte ensuite un fichier GLB, contrôle le modèle et prépare son import dans Roblox Studio."],
        ["spark","Un outil Blender complet pour l’agent","Il détecte ton installation de Blender, inspecte et valide un modèle (géométrie, échelle, matériaux), génère un aperçu et exécute des scripts. Il produit aussi un manifeste et gère l’import et l’export entre Blender et Roblox."],
        ["tools","Des modèles de départ prêts à l’emploi","Caisse, palette, panneau, arbre, arme, sol en tuiles et rig R15, ainsi que des scripts d’aperçu, de validation et d’export pour Roblox. L’agent les adapte à ta demande."],
        ["chat","Des skills Roblox et Blender hors ligne","Dans le centre d’extensions, onglet Roblox · Blender : construction Roblox, modélisation, scripts, optimisation, style low-poly et textures Blender. Ils s’installent et fonctionnent sans connexion."],
        ["clock","À savoir avant de commencer","Blender doit être installé sur ton ordinateur pour générer, valider et rendre des modèles. Roblox Studio reste nécessaire pour tester et publier ton jeu. Ouvre ton projet Roblox dans l’IDE pour que l’agent y range les fichiers."]
    ]){const row=centerNode("div","release-notes-item"),symbol=centerNode("span","release-notes-icon");symbol.innerHTML=apiNoticeIcon(icon==="clock"?"wait":icon);const body=centerNode("div");body.append(centerNode("strong","",title),centerNode("p","",text));row.append(symbol,body);list.append(row);}
    const footer=centerNode("div","release-notes-footer release-notes-footer-wrap");
    const source=centerNode("button","","Voir le projet d’origine sur GitHub");source.type="button";source.onclick=()=>api.openExternal(releaseHighlightsData?.robloxProjectUrl || "https://github.com/leo51500/francestudents-code-Roblox").catch(error=>studioFeedback(error.message));
    const project=centerNode("button","","Ouvrir un projet");project.type="button";project.onclick=()=>{releaseAfterClose=()=>$("btn-open-project")?.click();releaseDialog.close();};
    const skills=centerNode("button","","Ouvrir Roblox · Blender");skills.type="button";skills.onclick=()=>{releaseAfterClose=()=>{showSideView("extensions");setCenterTab("roblox");Promise.resolve(loadExtensionCenter()).catch(error=>studioFeedback(error.message));};releaseDialog.close();};
    const done=centerNode("button","primary","J’ai compris");done.type="button";done.onclick=()=>releaseDialog.close();
    footer.append(source,project,skills,done);releaseDialog.append(list,footer);releaseDialog.showModal();done.focus();
}
releaseDialog.addEventListener("close",()=>{
    if(releaseDialogStage==="notes" && releaseAutomatic && releaseHighlightsData?.showRobloxIntro){openRobloxIntro();return;}
    if(releaseDialogStage==="notes" && releaseAutomatic && releaseHighlightsData?.showFileVersionsIntro){openFileVersionsIntro();return;}
    if(releaseDialogStage==="roblox"){
        const next=releaseAfterClose;releaseAfterClose=null;
        if(releaseHighlightsData)releaseHighlightsData.showRobloxIntro=false;
 api.releaseHighlights("seenRoblox").catch(error=>studioFeedback(error.message));
 if(!next && releaseAutomatic && releaseHighlightsData?.showFileVersionsIntro){openFileVersionsIntro();return;}
        if(releaseHighlightsData)api.releaseHighlights("seen",releaseHighlightsData.version).catch(error=>studioFeedback(error.message));
        if(next)next();
 return;
    }
    if(releaseDialogStage==="fileVersions"){
        api.releaseHighlights("seenFileVersions").then(()=>{releaseHighlightsData.showFileVersionsIntro=false;return api.releaseHighlights("seen",releaseHighlightsData.version);}).catch(error=>studioFeedback(error.message));
    }else if(releaseHighlightsData)api.releaseHighlights("seen",releaseHighlightsData.version).catch(error=>studioFeedback(error.message));
});
function maybeShowReleaseHighlights(){
    if(!releaseHighlightsData?.shouldShow || releaseHighlightsShown || !$("startup-loading").hidden || !$("connection-guide").classList.contains("hidden") || document.querySelector("dialog[open]"))return;
    openReleaseHighlights(releaseHighlightsData,{automatic:true});
}
let checkpointPreferenceAsked=false;
async function maybeAskCheckpointPreference(){
    if(checkpointPreferenceAsked)return;
    try{const value=await api.checkpointPreference("get");if(value!==undefined)return;}catch{return;}
    checkpointPreferenceAsked=true;
    const dialog=document.createElement("dialog");dialog.className="center-dialog";dialog.innerHTML=`<h2>Activer les points de sauvegarde ?</h2><p class="settings-help">Avant chaque tâche de l’agent, l’IDE peut conserver un point de reprise. Les dossiers release, .frst et les archives .asar restent ignorés.</p><div class="center-dialog-actions"><button type="button" data-backup-choice="off">Garder désactivé</button><button type="button" class="primary" data-backup-choice="on">Activer</button></div>`;
    document.body.append(dialog);dialog.showModal();
    dialog.querySelectorAll("[data-backup-choice]").forEach(button=>button.onclick=async()=>{await api.checkpointPreference("set",button.dataset.backupChoice==="on");dialog.close();dialog.remove();});
}
releaseDialog.addEventListener("close",()=>maybeAskCheckpointPreference());
new MutationObserver(maybeShowReleaseHighlights).observe($("startup-loading"),{attributes:true,attributeFilter:["hidden"]});
new MutationObserver(maybeShowReleaseHighlights).observe($("connection-guide"),{attributes:true,attributeFilter:["class"]});
api.releaseHighlights().then(data=>{releaseHighlightsData=data;maybeShowReleaseHighlights();}).catch(()=>{});
const releaseNotesButton=centerNode("button","","Nouveautés de cette version");releaseNotesButton.type="button";releaseNotesButton.id="release-highlights-open";releaseNotesButton.onclick=async()=>{try{releaseHighlightsData=await api.releaseHighlights();openReleaseHighlights(releaseHighlightsData);}catch(error){studioFeedback(error.message);}};
document.querySelector("#studio-update-check").parentElement.append(releaseNotesButton);
