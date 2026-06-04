// Validate a REWRITTEN MP adapter for the real pdfjs format (anchor-line),
// fully local (no API): extract → parse → normalize → reconcile → classify.
import fs from "node:fs";
const pdfjs = await import(new URL("../functions/node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url).href);
const buffer = fs.readFileSync((process.argv[2]||(()=>{console.error("uso: node scripts/test-mp-adapter.mjs <extrato.pdf>");process.exit(1)})()));
const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, isEvalSupported: false }).promise;
const pages = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const rowMap = new Map();
  for (const it of content.items) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    const y = Math.round(it.transform[5]), x = it.transform[4];
    if (!rowMap.has(y)) rowMap.set(y, []);
    rowMap.get(y).push({ x, text: it.str });
  }
  pages.push([...rowMap.entries()].sort((a,b)=>b[0]-a[0]).map(([,i])=>i.sort((a,b)=>a.x-b.x).map(o=>o.text).join("  ").trim()).filter(Boolean).join("\n"));
}
const text = pages.join("\n");

// ── normalize (espelha src/lib/import/normalize.ts) ──
function parseBRCentavos(raw){
  let s=raw.replace(/\s/g,"").replace(/R\$/gi,"").trim();
  const neg=s.startsWith("-")||s.startsWith("−"); s=s.replace(/^[-−+]/,"").trim();
  const br=s.match(/^([\d.]+),(\d{1,2})$/);
  if(br){const c=parseInt(br[1].replace(/\./g,""),10)*100+parseInt(br[2].padEnd(2,"0"),10);return neg?-c:c;}
  return 0;
}
function parseBRDate(raw){
  const s=raw.trim();
  const f=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(f){const y=f[3].length===2?2000+ +f[3]:+f[3];return `${y}-${f[2].padStart(2,"0")}-${f[1].padStart(2,"0")}`;}
  return null;
}

// ── REWRITTEN MP adapter (anchor-line format) ──
const MP_ANCHOR=/^(\d{2}-\d{2}-\d{4})\s+(.*?)\s+R\$\s*([-−]?[\d.]+,\d{2})\s+R\$\s*([-−]?[\d.]+,\d{2})\s*$/;
const MP_NOISE=/^(data\s+descri|detalhe dos|extrato de|saldo (inicial|final)|entradas:|saidas:|periodo|cpf\/cnpj|\d+\/\d+$)/i;
const MP_ID_TAIL=/(\d{12,})\s*$/;
function extractHeader(t){
  const i=t.match(/saldo\s+inicial[:\s]*R?\$?\s*([\d.,]+)/i);
  const f=t.match(/saldo\s+final[:\s]*R?\$?\s*([\d.,]+)/i);
  return { initialBalanceCents:i?parseBRCentavos(i[1]):undefined, finalBalanceCents:f?parseBRCentavos(f[1]):undefined };
}
function parseMP(rawText){
  const header=extractHeader(rawText);
  const lines=rawText.split("\n").map(l=>l.trim());
  const records=[]; let descBuf=[];
  for(const line of lines){
    if(!line) continue;
    const m=line.match(MP_ANCHOR);
    if(!m){
      const norm=line.normalize("NFD").replace(/[̀-ͯ]/g,"");
      if(!MP_NOISE.test(norm)){descBuf.push(line);if(descBuf.length>4)descBuf.shift();}
      else descBuf=[];
      continue;
    }
    const [,date,middle,valor,saldo]=m;
    let inlineDesc=middle, id;
    const idm=middle.match(MP_ID_TAIL);
    if(idm){id=idm[1];inlineDesc=middle.slice(0,idm.index).trim();}
    const description=[...descBuf,inlineDesc].join(" ").replace(/\s{2,}/g," ").trim();
    records.push({date,description,valorRaw:`R$ ${valor}`,saldoRaw:`R$ ${saldo}`,id});
    descBuf=[];
  }
  return {records,header};
}

// ── reconcile (espelha reconcileServer) ──
function reconcile(txs,initC,finC,tol=2){
  if(!txs.length)return{ok:true,suspect:[]};
  const inf=txs[0].balanceCents!==undefined?txs[0].balanceCents-txs[0].signedCents:undefined;
  const initial=initC??inf; if(initial===undefined)return{ok:true,suspect:[]};
  let run=initial; const suspect=[];
  for(let i=0;i<txs.length;i++){run+=txs[i].signedCents;const bc=txs[i].balanceCents;if(bc!==undefined&&Math.abs(run-bc)>tol){suspect.push(i);run=bc;}}
  const finalOk=finC===undefined||Math.abs(run-finC)<=tol;
  return{ok:suspect.length===0&&finalOk,suspect};
}
const MP_IGNORE=[/dinheiro\s+reservado/i,/dinheiro\s+retirado/i,/^reembolso\b/i,/^estorno\b/i];
function classify(desc,signed){
  if(signed===0)return"IGNORAR";
  const n=desc.normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
  if(MP_IGNORE.some(p=>p.test(n)))return"IGNORAR";
  return signed>0?"ENTRADA":"SAIDA";
}

// ── run ──
const {records,header}=parseMP(text);
const internal=records.map(r=>{
  const vc=parseBRCentavos(r.valorRaw), bc=parseBRCentavos(r.saldoRaw);
  return {date:parseBRDate(r.date),description:r.description,signedCents:vc,balanceCents:bc,id:r.id};
});
const rec=reconcile(internal,header.initialBalanceCents,header.finalBalanceCents);
const cls=internal.map(t=>classify(t.description,t.signedCents));
const ignored=cls.filter(c=>c==="IGNORAR").length;
const first=internal[0];
const ok=b=>b?"✓":"✗";
console.log("─── NOVO ADAPTER (formato âncora), 100% LOCAL ───");
console.log(`${ok(records.length===304)} transações: ${records.length} (esperado 304)`);
console.log(`${ok(header.initialBalanceCents===2504)} saldo inicial: ${(header.initialBalanceCents/100).toFixed(2)}`);
console.log(`${ok(header.finalBalanceCents===1681)} saldo final: ${(header.finalBalanceCents/100).toFixed(2)}`);
console.log(`${ok(rec.ok)} reconciliação fecha (${rec.suspect.length} suspeitas)`);
console.log(`${ok(first?.description?.toLowerCase().includes("rendiment"))} 1ª tx: "${first?.description}" (${first?.signedCents}c, ${cls[0]})`);
console.log(`${ok(first?.id==="1741821704551")} 1ª tx ID correto: ${first?.id}`);
console.log(`${ok(ignored>=100)} IGNORAR: ${ignored} (esperado ~146)`);
// sanity: a Pix with multi-line description
const pix=internal.find(t=>t.description.includes("FABIANA"));
console.log(`  exemplo multi-linha: "${pix?.description}" → ${pix?.signedCents}c`);
