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
releaseDialog.addEventListener("close",()=>{
    if(releaseDialogStage==="notes" && releaseAutomatic && releaseHighlightsData?.showFileVersionsIntro){openFileVersionsIntro();return;}
    if(releaseDialogStage==="fileVersions"){
        api.releaseHighlights("seenFileVersions").then(()=>{releaseHighlightsData.showFileVersionsIntro=false;return api.releaseHighlights("seen",releaseHighlightsData.version);}).catch(error=>studioFeedback(error.message));
    }else if(releaseHighlightsData)api.releaseHighlights("seen",releaseHighlightsData.version).catch(error=>studioFeedback(error.message));
});
function maybeShowReleaseHighlights(){
    if(!releaseHighlightsData?.shouldShow || releaseHighlightsShown || !$("startup-loading").hidden || !$("connection-guide").classList.contains("hidden") || document.querySelector("dialog[open]"))return;
    openReleaseHighlights(releaseHighlightsData,{automatic:true});
}
new MutationObserver(maybeShowReleaseHighlights).observe($("startup-loading"),{attributes:true,attributeFilter:["hidden"]});
new MutationObserver(maybeShowReleaseHighlights).observe($("connection-guide"),{attributes:true,attributeFilter:["class"]});
api.releaseHighlights().then(data=>{releaseHighlightsData=data;maybeShowReleaseHighlights();}).catch(()=>{});
const releaseNotesButton=centerNode("button","","Nouveautés de cette version");releaseNotesButton.type="button";releaseNotesButton.id="release-highlights-open";releaseNotesButton.onclick=async()=>{try{releaseHighlightsData=await api.releaseHighlights();openReleaseHighlights(releaseHighlightsData);}catch(error){studioFeedback(error.message);}};
document.querySelector("#studio-update-check").parentElement.append(releaseNotesButton);
