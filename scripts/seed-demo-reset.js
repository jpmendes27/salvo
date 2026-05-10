/**
 * Reset completo da conta demo.
 * Apaga o workspace antigo e recria tudo do zero, sem duplicatas.
 *
 * Uso:
 *   node scripts/seed-demo-reset.js
 */

require("fs").readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length) process.env[k.trim()] = v.join("=").trim();
});

const { initializeApp }                        = require("firebase/app");
const { getAuth, signInWithEmailAndPassword }  = require("firebase/auth");
const { getFirestore, doc, setDoc, addDoc, getDocs, deleteDoc,
        collection, query, where, writeBatch } = require("firebase/firestore");

const app  = initializeApp({
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db   = getFirestore(app);

const DEMO_EMAIL = "jpmendesdasilva27+demo@gmail.com";
const DEMO_PASS  = "Jenn!ffer27082020";
const DEMO_NAME  = "João Demo";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function d(year, month, day) {
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function tx(uid, type, desc, amount, category, date, source) {
  return {
    type, description: desc, amount, category,
    date, monthKey: date.slice(0, 7),
    sourceLabel: source || null,
    createdBy: uid, createdByName: DEMO_NAME,
    createdAt: new Date(), updatedAt: new Date(),
    dedupKey: `${date}|${desc.toLowerCase()}|${amount.toFixed(2)}`
  };
}

async function deleteSubcollection(wsId, sub) {
  const snap = await getDocs(collection(db, "workspaces", wsId, sub));
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`  🗑  ${snap.size} docs deletados de ${sub}`);
}

// ─── Variações mensais ────────────────────────────────────────────────────────

const VARIATIONS = {
  1:  { super1: 410, super2: 318, iFood1: 67, iFood2: 89, uber1: 42, uber2: 31, uber3: 55, gas: 235, lazer: 180, vest: 0,    edu: 27  },
  2:  { super1: 387, super2: 294, iFood1: 58, iFood2: 72, uber1: 38, uber2: 22, uber3: 41, gas: 220, lazer: 139, vest: 289,  edu: 27  },
  3:  { super1: 395, super2: 310, iFood1: 74, iFood2: 55, uber1: 44, uber2: 28, uber3: 36, gas: 245, lazer: 90,  vest: 0,    edu: 0   },
  4:  { super1: 420, super2: 280, iFood1: 62, iFood2: 81, uber1: 35, uber2: 47, uber3: 29, gas: 210, lazer: 210, vest: 450,  edu: 54  },
  5:  { super1: 312, super2: 0,   iFood1: 63, iFood2: 0,  uber1: 29, uber2: 0,  uber3: 0,  gas: 215, lazer: 0,   vest: 0,    edu: 0   },
  6:  { super1: 398, super2: 305, iFood1: 70, iFood2: 65, uber1: 40, uber2: 33, uber3: 45, gas: 230, lazer: 160, vest: 320,  edu: 0   },
  7:  { super1: 445, super2: 320, iFood1: 85, iFood2: 90, uber1: 50, uber2: 38, uber3: 42, gas: 250, lazer: 280, vest: 0,    edu: 27  },
  8:  { super1: 380, super2: 290, iFood1: 55, iFood2: 68, uber1: 36, uber2: 25, uber3: 39, gas: 225, lazer: 120, vest: 0,    edu: 0   },
  9:  { super1: 410, super2: 315, iFood1: 72, iFood2: 78, uber1: 43, uber2: 31, uber3: 48, gas: 240, lazer: 95,  vest: 580,  edu: 108 },
  10: { super1: 392, super2: 298, iFood1: 60, iFood2: 82, uber1: 37, uber2: 44, uber3: 33, gas: 220, lazer: 350, vest: 0,    edu: 0   },
  11: { super1: 425, super2: 335, iFood1: 90, iFood2: 75, uber1: 48, uber2: 36, uber3: 52, gas: 255, lazer: 420, vest: 890,  edu: 27  },
  12: { super1: 510, super2: 390, iFood1: 95, iFood2: 110,uber1: 55, uber2: 42, uber3: 60, gas: 270, lazer: 680, vest: 1200, edu: 0   },
};

function txsForMonth(uid, year, month) {
  const v  = VARIATIONS[month];
  const nu = "Nubank •••• 3640";
  const it = "Inter Conta";
  const txs = [
    tx(uid, "income",  "Salário",                    22000, "Salário",     d(year,month,5),  it),
    tx(uid, "income",  "Freela design - cliente A",   3000, "Salário",     d(year,month,20), it),
    tx(uid, "expense", "Aluguel",                     2800, "Moradia",     d(year,month,10), it),
    tx(uid, "expense", "Condomínio",                   620, "Moradia",     d(year,month,10), it),
    tx(uid, "expense", "Vivo Internet Fibra",           149, "Moradia",     d(year,month,8),  nu),
    tx(uid, "expense", "Hapvida Saúde",                480, "Saúde",       d(year,month,15), nu),
    tx(uid, "expense", "Smart Fit",                    120, "Saúde",       d(year,month,1),  nu),
    tx(uid, "expense", "Netflix",                    55.90, "Assinaturas", d(year,month,18), nu),
    tx(uid, "expense", "Spotify",                    21.90, "Assinaturas", d(year,month,18), nu),
    tx(uid, "expense", "Amazon Prime",               19.90, "Assinaturas", d(year,month,22), nu),
    tx(uid, "expense", "iCloud+",                    12.90, "Assinaturas", d(year,month,22), nu),
    tx(uid, "expense", "Supermercado Extra",         v.super1, "Alimentação", d(year,month,3),  nu),
    tx(uid, "expense", "iFood",                      v.iFood1, "Alimentação", d(year,month,6),  nu),
    tx(uid, "expense", "Padaria São Paulo",              34, "Alimentação", d(year,month,9),  nu),
    tx(uid, "expense", "McDonald's",                     47, "Alimentação", d(year,month,25), nu),
    tx(uid, "expense", "Uber",                       v.uber1, "Transporte",  d(year,month,4),  nu),
    tx(uid, "expense", "Posto Shell - Gasolina",     v.gas,   "Transporte",  d(year,month,14), nu),
    tx(uid, "expense", "Uber",                       v.uber2, "Transporte",  d(year,month,21), nu),
  ];
  if (v.super2 > 0) txs.push(tx(uid, "expense", "Supermercado Pão de Açúcar", v.super2, "Alimentação", d(year,month,17), nu));
  if (v.iFood2 > 0) txs.push(tx(uid, "expense", "iFood",                      v.iFood2, "Alimentação", d(year,month,12), nu));
  if (v.uber3  > 0) txs.push(tx(uid, "expense", "Uber",                       v.uber3,  "Transporte",  d(year,month,26), nu));
  if (v.lazer  > 0) txs.push(tx(uid, "expense", month === 12 ? "Viagem de fim de ano" : month === 11 ? "Black Friday - Amazon" : month === 10 ? "Show - Coldplay" : "Ingresso.com", v.lazer, "Lazer", d(year,month,7), nu));
  if (v.vest   > 0) txs.push(tx(uid, "expense", month === 12 ? "Shopping - Presentes de Natal" : month === 11 ? "Black Friday - Moda" : month === 9 ? "Renner" : "Zara", v.vest, "Vestuário", d(year,month,16), nu));
  if (v.edu    > 0) txs.push(tx(uid, "expense", v.edu > 50 ? "Alura - Plano anual" : "Udemy", v.edu, "Educação", d(year,month,2), nu));
  return txs;
}

// Mês atual (maio 2026): só o que já entrou/saiu até agora
function txsCurrentMonth(uid) {
  const nu = "Nubank •••• 3640";
  const it = "Inter Conta";
  return [
    tx(uid, "income",  "Salário",               22000, "Salário",     d(2026,5,5),  it),
    tx(uid, "expense", "Smart Fit",               120, "Saúde",       d(2026,5,1),  nu),
    tx(uid, "expense", "Netflix",               55.90, "Assinaturas", d(2026,5,1),  nu),
    tx(uid, "expense", "Spotify",               21.90, "Assinaturas", d(2026,5,1),  nu),
    tx(uid, "expense", "Condomínio",              620, "Moradia",     d(2026,5,10), it),
    tx(uid, "expense", "Aluguel",               2800,  "Moradia",     d(2026,5,10), it),
    tx(uid, "expense", "Supermercado Extra",      312, "Alimentação", d(2026,5,3),  nu),
    tx(uid, "expense", "iFood",                    63, "Alimentação", d(2026,5,6),  nu),
    tx(uid, "expense", "Uber",                     29, "Transporte",  d(2026,5,4),  nu),
    tx(uid, "expense", "Posto Shell - Gasolina",  215, "Transporte",  d(2026,5,7),  nu),
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔐 Fazendo login...");
  const { user } = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASS);
  const uid = user.uid;
  console.log(`✅ Logado (${uid})\n`);

  console.log("ℹ️  Criando novo workspace (workspaces antigos ficam órfãos — sem problema).");

  // Novo workspace
  const wsRef = doc(collection(db, "workspaces"));
  const wsId  = wsRef.id;
  await setDoc(wsRef, {
    name: "Minhas finanças", createdBy: uid,
    monthlyIncome: 25000,
    createdAt: new Date(), updatedAt: new Date()
  });
  console.log(`\n✅ Novo workspace criado: ${wsId}`);

  // Membro owner
  await setDoc(doc(db, "workspaces", wsId, "members", uid), {
    uid, role: "owner", status: "active",
    displayName: DEMO_NAME, email: DEMO_EMAIL,
    createdBy: uid, joinedAt: new Date()
  });

  // Perfil
  await setDoc(doc(db, "users", uid), {
    uid, displayName: DEMO_NAME, email: DEMO_EMAIL,
    workspaceIds: [wsId],
    hasCreatedRealMonth: true,
    acceptedTermsVersion: 1, acceptedTermsAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log("✅ Perfil atualizado");

  // Recorrências — salva os IDs pra linkar nos plannedItems
  const recurringDefs = [
    { type: "income",  title: "Salário",         amount: 22000, category: "Salário",     dueDay: 5  },
    { type: "income",  title: "Freela design",    amount: 3000,  category: "Salário",     dueDay: 20 },
    { type: "expense", title: "Aluguel",          amount: 2800,  category: "Moradia",     dueDay: 10 },
    { type: "expense", title: "Condomínio",       amount: 620,   category: "Moradia",     dueDay: 10 },
    { type: "expense", title: "Internet",         amount: 149,   category: "Moradia",     dueDay: 8  },
    { type: "expense", title: "Plano de saúde",   amount: 480,   category: "Saúde",       dueDay: 15 },
    { type: "expense", title: "Academia",         amount: 120,   category: "Saúde",       dueDay: 1  },
    { type: "expense", title: "Netflix",          amount: 55.90, category: "Assinaturas", dueDay: 18 },
    { type: "expense", title: "Spotify",          amount: 21.90, category: "Assinaturas", dueDay: 18 },
    { type: "expense", title: "Amazon Prime",     amount: 19.90, category: "Assinaturas", dueDay: 22 },
    { type: "expense", title: "iCloud 200GB",     amount: 12.90, category: "Assinaturas", dueDay: 22 },
  ];

  const recurringItems = [];
  for (const r of recurringDefs) {
    const ref = await addDoc(collection(db, "workspaces", wsId, "recurringItems"), {
      ...r, active: true, createdBy: uid, createdByName: DEMO_NAME,
      createdAt: new Date(), updatedAt: new Date()
    });
    recurringItems.push({ id: ref.id, ...r });
  }
  console.log("✅ Recorrências criadas");

  // Plano de maio 2026 — usando IDs determinísticos (igual o app faz)
  const statusMap = {
    "Salário":       "paid",
    "Freela design": "planned",
    "Aluguel":       "paid",
    "Condomínio":    "paid",
    "Internet":      "planned",
    "Plano de saúde":"planned",
    "Academia":      "paid",
    "Netflix":       "paid",
    "Spotify":       "paid",
    "Amazon Prime":  "planned",
    "iCloud 200GB":  "planned",
  };
  for (const r of recurringItems) {
    const docId = `${r.id}_2026-05`;
    await setDoc(doc(db, "workspaces", wsId, "plannedItems", docId), {
      type: r.type, title: r.title, amount: r.amount, category: r.category, dueDay: r.dueDay,
      monthKey: "2026-05",
      status: statusMap[r.title] ?? "planned",
      recurringId: r.id,
      createdBy: uid, createdByName: DEMO_NAME,
      createdAt: new Date(), updatedAt: new Date()
    });
  }
  console.log("✅ Plano de maio criado (sem duplicatas)");

  // Transações — todos os meses do ano
  const allMonths = [1,2,3,4,6,7,8,9,10,11,12];
  for (const month of allMonths) {
    const txs = txsForMonth(uid, 2026, month);
    for (const t of txs) await addDoc(collection(db, "workspaces", wsId, "transactions"), t);
    console.log(`✅ 2026-${String(month).padStart(2,"0")} — ${txs.length} lançamentos`);
  }
  // Mês atual
  const curTxs = txsCurrentMonth(uid);
  for (const t of curTxs) await addDoc(collection(db, "workspaces", wsId, "transactions"), t);
  console.log(`✅ 2026-05 — ${curTxs.length} lançamentos (mês em andamento)`);

  console.log(`\n🎉 Reset concluído!`);
  console.log(`   Workspace ID  : ${wsId}`);
  console.log(`   Renda mensal  : R$25.000 (salário R$22k + freela R$3k)`);
  console.log(`   Login demo    : ${DEMO_EMAIL}`);
  console.log(`\n   ⚠️  Atualize WS_ID em seed-demo-fullyear.js se precisar rodar de novo.`);
  process.exit(0);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
