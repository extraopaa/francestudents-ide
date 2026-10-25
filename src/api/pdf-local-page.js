"use strict";
const path=require("node:path");
async function readPdfPage(bytes,pageNumber=1,visual=false){
    const {getDocument}=await import("pdfjs-dist/legacy/build/pdf.mjs");
    const root=path.dirname(require.resolve("pdfjs-dist/package.json"));
    const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,
        standardFontDataUrl:path.join(root,"standard_fonts")+"/",cMapUrl:path.join(root,"cmaps")+"/",cMapPacked:true,wasmUrl:path.join(root,"wasm")+"/",verbosity:0});
    try{
        const document=await task.promise;
        if(pageNumber>document.numPages)throw Object.assign(new Error(`Page absente : ce PDF contient ${document.numPages} pages.`),{code:"PDF_PAGE_RANGE"});
        const page=await document.getPage(pageNumber);
        try{
            const content=await page.getTextContent();
            const text=content.items.map(item=>typeof item.str==="string"?item.str+(item.hasEOL?"\n":" "):"").join("");
            const images=[];
            if(visual||!text.trim()){
                const {createCanvas}=require("@napi-rs/canvas"),base=page.getViewport({scale:1});
                const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(base.width,base.height))});
                const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
                try{await page.render({canvasContext:canvas.getContext("2d"),viewport,background:"white"}).promise;images.push(`data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`);}
                finally{canvas.width=canvas.height=1;}
            }
            return {text,images,page:pageNumber,total_pages:document.numPages,next_page:pageNumber<document.numPages?pageNumber+1:null};
        }finally{page.cleanup();}
    }finally{await task.destroy();}
}
module.exports={readPdfPage};
