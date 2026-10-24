/* A ZIP is inventoried locally before any model request or upload. */
function chooseZipFiles(attachment){
    return api.zipPreview(attachment).then(entries=>new Promise(resolve=>{
        const previous=document.activeElement,dialog=document.createElement("dialog");
        dialog.id="zip-selection-dialog";dialog.className="fs-dialog zip-selection-dialog";
        studioSurfaceHeader(dialog,{title:"Choisis les fichiers du ZIP",subtitle:attachment.name,icon:"tools"});
        const note=centerNode("p","fs-dialog-note","Inventaire réalisé sur ton ordinateur, sans requête IA. Seuls les fichiers cochés seront accessibles à l’agent. Tu pourras lui demander de lire leur contenu complet.");
        const search=document.createElement("input");search.type="search";search.placeholder="Rechercher un fichier ou un dossier…";search.setAttribute("aria-label","Rechercher dans le ZIP");
        const toolbar=centerNode("div","zip-selection-toolbar"),all=centerNode("button","","Tout sélectionner"),none=centerNode("button","","Tout décocher"),count=centerNode("span","","");
        const list=centerNode("div","zip-selection-list"),more=centerNode("button","","Afficher davantage");
        const footer=centerNode("div","fs-dialog-footer"),cancel=centerNode("button","","Annuler"),accept=centerNode("button","primary","Joindre la sélection");
        const selected=new Set();let limit=200,accepted=false;
        function update(){
            const bytes=entries.reduce((sum,entry)=>sum+(selected.has(entry.name)?entry.size:0),0);
            count.textContent=`${selected.size} / ${entries.length} fichiers · ${formatBytes(bytes)}`;accept.disabled=!selected.size;
        }
        function render(){
            list.replaceChildren();const query=search.value.toLocaleLowerCase(),matching=entries.filter(entry=>entry.name.toLocaleLowerCase().includes(query));
            for(const entry of matching.slice(0,limit)){
                const row=document.createElement("label"),checkbox=document.createElement("input"),name=centerNode("span","zip-selection-name",entry.name),size=centerNode("span","",formatBytes(entry.size));
                checkbox.type="checkbox";checkbox.checked=selected.has(entry.name);checkbox.disabled=Boolean(entry.error);
                checkbox.onchange=()=>{if(checkbox.checked)selected.add(entry.name);else selected.delete(entry.name);update();};
                row.title=entry.error||entry.name;if(entry.error)size.textContent=entry.error;
                row.append(checkbox,name,size);list.append(row);
            }
            if(!matching.length)list.append(centerNode("p","fs-dialog-note","Aucun fichier correspondant."));
            more.hidden=matching.length<=limit;update();
        }
        search.oninput=()=>{limit=200;render();};all.onclick=()=>{for(const entry of entries)if(!entry.error)selected.add(entry.name);render();};none.onclick=()=>{selected.clear();render();};
        more.onclick=()=>{limit+=200;render();};cancel.onclick=()=>dialog.close();accept.onclick=()=>{accepted=true;dialog.close();};
        toolbar.append(all,none,count);footer.append(cancel,accept);dialog.append(note,search,toolbar,list,more,footer);document.body.append(dialog);
        dialog.addEventListener("close",()=>{
            dialog.remove();resolve(accepted?{...attachment,selectedPaths:[...selected]}:null);
            requestAnimationFrame(()=>{if(previous?.isConnected)previous.focus();});
        },{once:true});render();dialog.showModal();search.focus();
    }));
}
