#!/usr/bin/env node
/**
 * validate-chunked.mjs — valida o caminho REAL do background job:
 *   extração de texto (pdfjs no servidor) → chunking corrigido (corte após âncora)
 *   → Claude por chunk em paralelo → merge → reconciliação (centavos) → classificação.
 *
 * Replica fielmente functions/src/index.ts:
 *   extractPdfTextServer, splitTextIntoChunks, extractTextInChunks,
 *   reconcileServer, classifyServer.
 *
 * USO:
 *   ANTHROPIC_API_KEY=sk-... node validate-chunked.mjs "/caminho/extrato.pdf"
 */
import fs from "node:fs";

const KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const pdfPath = process.argv[2];
if (!KEY || !pdfPath) { console.error("Uso: ANTHROPIC_API_KEY=sk-... node validate-chunked.mjs <pdf>"); process.exit(1); }

const IMPORT_CATEGORIES = ["Alimentacao","Mercado","Transporte","Carro","CartaoCredito","Assinaturas","Saude","Varejo","Educacao","Moradia","Contas","Seguros","Taxas","Emprestimos","Doacoes","Transferencias","Hospedagem","Viagem","Lazer","Recebimentos","Outros"];

function buildSystemPrompt() {
  const today = new Date().toISOString().slice(0, 10);
  return `Hoje é ${today}. Use esta data como referência para inferir o ano quando as datas do documento não tiverem ano explícito.

Você é um extrator especializado de transações financeiras de extratos bancários brasileiros.

Dado um arquivo, extraia TODAS as transações financeiras visíveis e retorne SOMENTE um JSON válido:
{"sourceLabel":"string","initialBalance":number|null,"finalBalance":number|null,"transactions":[{"date":"YYYY-MM-DD","description":"string","amount":number,"type":"income"|"expense","category":"string","classification":"ENTRADA"|"SAIDA"|"IGNORAR","balance":number|null}]}

=== sourceLabel ===
- Extrato/conta: nome do banco (ex: "Mercado Pago"). Carteira digital: nome. Desconhecido: "Importação".

=== initialBalance/finalBalance ===
- Saldos inicial/final do cabeçalho, valor numérico exato sem moeda (ex: 25.04). null se ausente.

=== classification ===
- ENTRADA: dinheiro de fora (salário, PIX recebido, rendimento, reembolso de terceiro real)
- SAIDA: dinheiro para fora (compra, pagamento, PIX enviado)
- IGNORAR: movimento interno: "Dinheiro reservado", "Dinheiro retirado", "Reembolso" interno, "Estorno", amount=0

=== balance ===
- "balance": saldo APÓS a transação (coluna Saldo), numérico exato. null se ausente.

=== MERCADO PAGO (5 colunas: Data | Descrição | ID | Valor | Saldo) ===
1. Valor vem da coluna VALOR (com sinal). NUNCA use SALDO como valor.
2. Sinal do Valor determina type: "R$ -18,75"→expense; "R$ 18,75"→income (mesmo "Transferência enviada" positiva = income/estorno).
3. ID (12+ dígitos isolados) NÃO entra na description.
4. CPF/CNPJ dentro de PIX É parte da description.
5. Coluna Saldo → "balance".
6. "Rendimentos" = ENTRADA, income.

=== category ===
Categorias: ${IMPORT_CATEGORIES.join(", ")}. income→"Recebimentos"; IGNORAR→"Transferencias"; dúvida→"Outros".

=== transações ===
- NÃO inclua: pagamento de fatura, saldo anterior/restante, totais, limites.
- "amount" SEMPRE positivo. "date" ISO. Retorne APENAS o JSON puro.`;
}

// ── extração pdfjs (espelha extractPdfTextServer) ──
async function extractPdfText(buffer) {
  const pdfjs = await import("/home/joao/Documentos/salvo/functions/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
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
  return pages.join("\n");
}

// ── chunking corrigido (espelha splitTextIntoChunks) ──
const BATCH=Number(process.env.BATCH||50), THRESHOLD=60;
const looksLikeTxStart = (l)=>{const t=l.trim();return /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?(\s|$)/.test(t)||/^\d{1,2}\s+[A-Za-zÀ-ÿ]{3,4}\b/.test(t);};
function splitTextIntoChunks(text){
  const lines=text.split("\n"); const a=[]; lines.forEach((l,i)=>{if(looksLikeTxStart(l))a.push(i);});
  if(a.length<=THRESHOLD) return [text];
  const chunks=[],n=a.length;
  for(let k=0;k<n;k+=BATCH){
    const from=k===0?0:a[k-1]+1;
    const last=Math.min(k+BATCH-1,n-1);
    const to=last===n-1?lines.length:a[last]+1;
    chunks.push(lines.slice(from,to).join("\n"));
  }
  return chunks;
}

// ── throttle (espelha o rate limiter do backend) ──
const OUTPUT_PER_MIN=7500; const tokenLog=[];
function recentTokens(){const c=Date.now()-60000;while(tokenLog.length&&tokenLog[0].t<c)tokenLog.shift();return tokenLog.reduce((s,e)=>s+e.tokens,0);}
async function throttle(est){while(recentTokens()+est>OUTPUT_PER_MIN&&tokenLog.length){const w=Math.max(1000,tokenLog[0].t+60000-Date.now());await new Promise(r=>setTimeout(r,Math.min(w,15000)));}}
const estTokens=(t)=>Math.min(8192,Math.max(800,((t.match(/R\$/g)||[]).length)*25));

let calls=0, retries429=0;
async function callClaude(text) {
  await throttle(estTokens(text));
  for(let attempt=0;;attempt++){
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"content-type":"application/json","x-api-key":KEY,"anthropic-version":"2023-06-01"},
      body: JSON.stringify({ model:MODEL, max_tokens:8192, system:buildSystemPrompt(), messages:[{role:"user",content:[{type:"text",text:`Arquivo: extrato.pdf\n\nExtraia todas as transações:\n\n${text}`}]}] })
    });
    if(resp.status===429 && attempt<6){
      retries429++;
      const ra=Number(resp.headers.get("retry-after")||"10");
      await new Promise(r=>setTimeout(r,(ra+1)*1000));
      continue;
    }
    if(!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
    calls++;
    const data = await resp.json();
    tokenLog.push({t:Date.now(),tokens:data.usage?.output_tokens??0});
    const raw = data.content.find(b=>b.type==="text")?.text ?? "{}";
    const s=raw.indexOf("{"), e=raw.lastIndexOf("}");
    return JSON.parse(raw.slice(s,e+1));
  }
}

function assembleMerged(perChunk, headers){
  const transactions=[]; for(const txs of perChunk) for(const t of txs) transactions.push(t);
  return { sourceLabel:headers.find(r=>r.sourceLabel)?.sourceLabel, initialBalance:headers.find(r=>r.initialBalance!=null)?.initialBalance, finalBalance:[...headers].reverse().find(r=>r.finalBalance!=null)?.finalBalance, transactions };
}
function reconcileParsed(parsed){
  const txs=(parsed.transactions??[]).map(t=>({signedCents:Math.round((t.type==="income"?t.amount:-t.amount)*100),balanceCents:t.balance!=null?Math.round(t.balance*100):undefined}));
  const initC=parsed.initialBalance!=null?Math.round(parsed.initialBalance*100):undefined;
  const finC=parsed.finalBalance!=null?Math.round(parsed.finalBalance*100):undefined;
  return reconcile(txs,initC,finC);
}

// ── extractTextInChunks: sequencial + retry direcionado (espelha o backend) ──
async function extractTextInChunks(text){
  const chunks=splitTextIntoChunks(text);
  console.log(`  chunks: ${chunks.length} (sequencial + throttle)`);
  if(chunks.length===1){
    let p=await callClaude(text);
    if(!reconcileParsed(p).ok){const r=await callClaude(text);if(reconcileParsed(r).ok)p=r;}
    return p;
  }
  const perChunk=[], headers=[];
  for(let i=0;i<chunks.length;i++){
    const r=await callClaude(chunks[i]); headers.push(r); perChunk.push(r.transactions??[]);
    process.stdout.write(`\r  extraindo chunk ${i+1}/${chunks.length}...`);
  }
  process.stdout.write("\n");
  let merged=assembleMerged(perChunk,headers);
  const rec=reconcileParsed(merged);
  if(!rec.ok && rec.suspectIndices.length>0){
    const affected=new Set();
    for(const idx of rec.suspectIndices){let acc=0;for(let ci=0;ci<perChunk.length;ci++){if(idx<acc+perChunk[ci].length){affected.add(ci);if(ci>0)affected.add(ci-1);break;}acc+=perChunk[ci].length;}}
    console.log(`  retry direcionado: re-extraindo chunks [${[...affected].sort((a,b)=>a-b).join(", ")}]`);
    for(const ci of affected){const r=await callClaude(chunks[ci]);headers[ci]=r;perChunk[ci]=r.transactions??[];}
    merged=assembleMerged(perChunk,headers);
  }
  return merged;
}

// ── reconcileServer ──
function reconcile(txs, initialC, finalC, tol=2){
  if(txs.length===0) return {ok:true,suspect:[]};
  const hasBal=txs.some(t=>t.balanceCents!==undefined);
  if(!hasBal){
    if(initialC!==undefined&&finalC!==undefined){const sum=txs.reduce((s,t)=>s+t.signedCents,0);return {ok:Math.abs(sum-(finalC-initialC))<=tol,suspect:[]};}
    return {ok:true,suspect:[]};
  }
  const inf=txs[0].balanceCents!==undefined?txs[0].balanceCents-txs[0].signedCents:undefined;
  const initial=initialC??inf; if(initial===undefined) return {ok:true,suspect:[]};
  let running=initial; const suspect=[];
  for(let i=0;i<txs.length;i++){running+=txs[i].signedCents;const bc=txs[i].balanceCents;if(bc!==undefined){if(Math.abs(running-bc)>tol){suspect.push(i);running=bc;}}}
  const finalOk=finalC===undefined||Math.abs(running-finalC)<=tol;
  return {ok:suspect.length===0&&finalOk,suspect};
}
const MP_IGNORE=[/dinheiro\s+reservado/i,/dinheiro\s+retirado/i,/^reembolso\b/i,/^estorno\b/i];
function classify(desc,signed,slug,hint){
  if(signed===0)return "IGNORAR";
  const n=desc.normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
  if(slug==="mercado-pago"&&MP_IGNORE.some(p=>p.test(n)))return "IGNORAR";
  if(hint==="IGNORAR")return "IGNORAR";
  return signed>0?"ENTRADA":"SAIDA";
}

(async()=>{
  const t0=Date.now();
  console.log(`\nValidação do caminho CHUNKADO (${MODEL})`);
  const buffer=fs.readFileSync(pdfPath);
  console.log("  extraindo texto (pdfjs servidor)...");
  const text=await extractPdfText(buffer);
  console.log(`  texto: ${text.length} chars`);
  console.log("  chamando Claude por chunk em paralelo...");
  const parsed=await extractTextInChunks(text);
  const elapsed=((Date.now()-t0)/1000).toFixed(1);

  const raw=(parsed.transactions??[]).filter(t=>t.amount!=null&&t.date&&t.description);
  const slug=/mercado\s*pago/i.test(parsed.sourceLabel??"")?"mercado-pago":"generic";
  const internal=raw.map(t=>({...t,signedCents:Math.round((t.type==="income"?t.amount:-t.amount)*100),balanceCents:t.balance!==undefined&&t.balance!==null?Math.round(t.balance*100):undefined}));
  const initC=parsed.initialBalance!=null?Math.round(parsed.initialBalance*100):undefined;
  const finC=parsed.finalBalance!=null?Math.round(parsed.finalBalance*100):undefined;
  const rec=reconcile(internal,initC,finC);
  const classified=internal.map(t=>classify(t.description,t.signedCents,slug,t.classification));
  const ignored=classified.filter(c=>c==="IGNORAR").length;
  const first=internal[0];

  const ok=(b)=>b?"✓":"✗";
  console.log(`\n─── RESULTADO (${elapsed}s) ───`);
  console.log(`${ok(raw.length===304)} transações extraídas: ${raw.length} (esperado 304)`);
  console.log(`${ok(parsed.initialBalance===25.04)} saldo inicial: ${parsed.initialBalance} (esperado 25.04)`);
  console.log(`${ok(parsed.finalBalance===16.81)} saldo final: ${parsed.finalBalance} (esperado 16.81)`);
  console.log(`${ok(rec.ok)} reconciliação fecha (${rec.suspect.length} suspeitas)`);
  console.log(`${ok(first?.description?.toLowerCase().includes("rendiment"))} 1ª tx descrição: "${first?.description}"`);
  console.log(`${ok(first?.signedCents===1)} 1ª tx = +R$0,01 ENTRADA (signedCents=${first?.signedCents}, classif=${classified[0]})`);
  console.log(`${ok(ignored>=100)} IGNORAR: ${ignored} (esperado ~146)`);
  const entradas=internal.filter((_,i)=>classified[i]==="ENTRADA").reduce((s,t)=>s+Math.abs(t.amount),0);
  const saidas=internal.filter((_,i)=>classified[i]==="SAIDA").reduce((s,t)=>s+Math.abs(t.amount),0);
  console.log(`  Entradas reais: R$ ${entradas.toFixed(2)} · Saídas reais: R$ ${saidas.toFixed(2)} · Ignoradas: ${ignored}`);
  console.log(`  Chamadas Claude: ${calls} · 429 tratados (backoff): ${retries429}`);
})().catch(e=>{console.error("ERRO:",e.message);process.exit(1);});
