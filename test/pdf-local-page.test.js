"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {readPdfPage}=require("../src/api/pdf-local-page");
function pdf(content){return Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length "+Buffer.byteLength(content)+" >>\nstream\n"+content+"\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");}
test("local PDF reads text without images, renders only on demand and reports page bounds",async()=>{
    const bytes=pdf("BT /F1 12 Tf 20 200 Td (Local PDF text) Tj ET");
    const text=await readPdfPage(bytes);
    assert.match(text.text,/Local PDF text/);assert.deepEqual(text.images,[]);assert.equal(text.next_page,null);assert.equal(text.total_pages,1);
    const visual=await readPdfPage(bytes,1,true);assert.equal(visual.images.length,1);assert.match(visual.images[0],/^data:image\/png;base64,/);
    await assert.rejects(readPdfPage(bytes,2),/Page absente/);
});
test("a scanned PDF page queues a real page image instead of claiming text was extracted",async()=>{
    const result=await readPdfPage(pdf("q Q"));
    assert.equal(result.text.trim(),"");assert.equal(result.images.length,1);
});
