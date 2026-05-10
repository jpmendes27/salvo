/**
 * Seed de dados fake para a conta demo.
 * Usa o Firebase Client SDK — sem service account.
 *
 * Uso:
 *   node scripts/seed-demo.js
 */

// Carrega .env.local
require("fs").readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length) process.env[k.trim()] = v.join("=").trim();
});

const { initializeApp }               = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, doc, setDoc, addDoc, collection, writeBatch } = require("firebase/firestore");

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── Config ────────────────────────────────────────────────────────────────
const DEMO_EMAIL = "jpmendesdasilva27+demo@gmail.com";
const DEMO_PASS  = "Jenn!ffer27082020";
const DEMO_NAME  = "João Demo";

// ─── Helpers ───────────────────────────────────────────────────────────────
function dateStr(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function makeTx(uid, type, description, amount, category, date, source) {
  return {
    type, description, amount, category,
    date, monthKey: date.slice(0, 7),
    sourceLabel: source || null,
    createdBy: uid, createdByName: DEMO_NAME,
    createdAt: new Date(), updatedAt: new Date(),
    dedupKey: `${date}|${description.toLowerCase()}|${amount.toFixed(2)}`
  };
}

function txsForMonth(uid, year, month) {
  const d  = (day) => dateStr(year, month, day);
  const nu = "Nubank •••• 3640";
  const it = "Inter Conta";
  return [
    makeTx(uid, "income",  "Salário",                   12000,  "Salário",     d(5),  it),
    makeTx(uid, "income",  "Freela design - cliente A",  2500,  "Salário",     d(20), it),
    makeTx(uid, "expense", "Aluguel",                    2800,  "Moradia",     d(10), it),
    makeTx(uid, "expense", "Condomínio",                  620,  "Moradia",     d(10), it),
    makeTx(uid, "expense", "Vivo Internet Fibra",         149,  "Moradia",     d(8),  nu),
    makeTx(uid, "expense", "Hapvida Saúde",               480,  "Saúde",       d(15), nu),
    makeTx(uid, "expense", "Smart Fit",                   120,  "Saúde",       d(1),  nu),
    makeTx(uid, "expense", "Netflix",                   55.90,  "Assinaturas", d(18), nu),
    makeTx(uid, "expense", "Spotify",                   21.90,  "Assinaturas", d(18), nu),
    makeTx(uid, "expense", "Amazon Prime",              19.90,  "Assinaturas", d(22), nu),
    makeTx(uid, "expense", "iCloud+",                   12.90,  "Assinaturas", d(22), nu),
    makeTx(uid, "expense", "Supermercado Extra",          387,  "Alimentação", d(3),  nu),
    makeTx(uid, "expense", "Supermercado Pão de Açúcar",  294,  "Alimentação", d(17), nu),
    makeTx(uid, "expense", "iFood",                        58,  "Alimentação", d(6),  nu),
    makeTx(uid, "expense", "iFood",                        72,  "Alimentação", d(12), nu),
    makeTx(uid, "expense", "Padaria São Paulo",            34,  "Alimentação", d(9),  nu),
    makeTx(uid, "expense", "McDonald's",                   47,  "Alimentação", d(25), nu),
    makeTx(uid, "expense", "Uber",                         38,  "Transporte",  d(4),  nu),
    makeTx(uid, "expense", "Uber",                         22,  "Transporte",  d(11), nu),
    makeTx(uid, "expense", "Posto Shell - Gasolina",      220,  "Transporte",  d(14), nu),
    makeTx(uid, "expense", "Uber",                         41,  "Transporte",  d(21), nu),
    makeTx(uid, "expense", "Ingresso.com",                 90,  "Lazer",       d(7),  nu),
    makeTx(uid, "expense", "Steam",                        49,  "Lazer",       d(13), nu),
    makeTx(uid, "expense", "Zara",                        289,  "Vestuário",   d(16), nu),
    makeTx(uid, "expense", "Udemy",                        27,  "Educação",    d(2),  nu),
  ];
}

function txsCurrentMonth(uid, year, month) {
  const d  = (day) => dateStr(year, month, day);
  const nu = "Nubank •••• 3640";
  const it = "Inter Conta";
  return [
    makeTx(uid, "income",  "Salário",               12000,  "Salário",     d(5),  it),
    makeTx(uid, "expense", "Smart Fit",               120,  "Saúde",       d(1),  nu),
    makeTx(uid, "expense", "Netflix",               55.90,  "Assinaturas", d(1),  nu),
    makeTx(uid, "expense", "Spotify",               21.90,  "Assinaturas", d(1),  nu),
    makeTx(uid, "expense", "Condomínio",              620,  "Moradia",     d(10), it),
    makeTx(uid, "expense", "Aluguel",               2800,  "Moradia",     d(10), it),
    makeTx(uid, "expense", "Supermercado Extra",      312,  "Alimentação", d(3),  nu),
    makeTx(uid, "expense", "iFood",                    63,  "Alimentação", d(6),  nu),
    makeTx(uid, "expense", "Uber",                     29,  "Transporte",  d(4),  nu),
    makeTx(uid, "expense", "Posto Shell - Gasolina",  215,  "Transporte",  d(7),  nu),
  ];
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("🔐 Fazendo login com a conta demo...");
  const { user } = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASS);
  const uid = user.uid;
  console.log(`✅ Logado como ${user.email} (uid: ${uid})\n`);

  // Workspace
  const wsRef = doc(collection(db, "workspaces"));
  const wsId  = wsRef.id;

  await setDoc(wsRef, {
    name: "Minhas finanças", createdBy: uid,
    monthlyIncome: 25000,
    createdAt: new Date(), updatedAt: new Date()
  });
  console.log("✅ Workspace criado");

  // Membro owner
  await setDoc(doc(db, "workspaces", wsId, "members", uid), {
    uid, role: "owner", status: "active",
    displayName: DEMO_NAME, email: DEMO_EMAIL,
    createdBy: uid, joinedAt: new Date()
  });
  console.log("✅ Membro owner criado");

  // Perfil do usuário
  await setDoc(doc(db, "users", uid), {
    uid, displayName: DEMO_NAME, email: DEMO_EMAIL,
    workspaceIds: [wsId],
    acceptedTermsVersion: 1, acceptedTermsAt: new Date(),
    updatedAt: new Date()
  }, { merge: true });
  console.log("✅ Perfil atualizado");

  // Recorrências
  const recurring = [
    { type: "income",  title: "Salário",         amount: 12000, category: "Salário",     dueDay: 5  },
    { type: "income",  title: "Freela design",    amount: 2500,  category: "Salário",     dueDay: 20 },
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

  for (const r of recurring) {
    await addDoc(collection(db, "workspaces", wsId, "recurringItems"), {
      ...r, active: true, createdBy: uid, createdByName: DEMO_NAME,
      createdAt: new Date(), updatedAt: new Date()
    });
  }
  console.log("✅ Recorrências criadas");

  // Transações meses passados
  for (const [year, month] of [[2026, 2], [2026, 3], [2026, 4]]) {
    const txs = txsForMonth(uid, year, month);
    for (const t of txs) await addDoc(collection(db, "workspaces", wsId, "transactions"), t);
    console.log(`✅ Transações ${year}-${String(month).padStart(2,"0")} criadas (${txs.length} lançamentos)`);
  }

  // Transações mês atual
  const cur = txsCurrentMonth(uid, 2026, 5);
  for (const t of cur) await addDoc(collection(db, "workspaces", wsId, "transactions"), t);
  console.log(`✅ Transações 2026-05 criadas (${cur.length} lançamentos — mês em andamento)`);

  // Plano do mês atual
  const planned = [
    { type: "income",  title: "Salário",        amount: 12000, category: "Salário",     dueDay: 5,  status: "paid"    },
    { type: "income",  title: "Freela design",   amount: 2500,  category: "Salário",     dueDay: 20, status: "planned" },
    { type: "expense", title: "Aluguel",         amount: 2800,  category: "Moradia",     dueDay: 10, status: "paid"    },
    { type: "expense", title: "Condomínio",      amount: 620,   category: "Moradia",     dueDay: 10, status: "paid"    },
    { type: "expense", title: "Internet",        amount: 149,   category: "Moradia",     dueDay: 8,  status: "planned" },
    { type: "expense", title: "Plano de saúde",  amount: 480,   category: "Saúde",       dueDay: 15, status: "planned" },
    { type: "expense", title: "Academia",        amount: 120,   category: "Saúde",       dueDay: 1,  status: "paid"    },
    { type: "expense", title: "Netflix",         amount: 55.90, category: "Assinaturas", dueDay: 18, status: "paid"    },
    { type: "expense", title: "Spotify",         amount: 21.90, category: "Assinaturas", dueDay: 18, status: "paid"    },
    { type: "expense", title: "Amazon Prime",    amount: 19.90, category: "Assinaturas", dueDay: 22, status: "planned" },
    { type: "expense", title: "iCloud 200GB",    amount: 12.90, category: "Assinaturas", dueDay: 22, status: "planned" },
  ];

  for (const p of planned) {
    await addDoc(collection(db, "workspaces", wsId, "plannedItems"), {
      ...p, monthKey: "2026-05",
      createdBy: uid, createdByName: DEMO_NAME,
      createdAt: new Date(), updatedAt: new Date()
    });
  }
  console.log("✅ Plano do mês criado");

  console.log(`\n🎉 Seed concluído!`);
  console.log(`   Workspace ID : ${wsId}`);
  console.log(`   Login demo   : ${DEMO_EMAIL}`);
  process.exit(0);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
