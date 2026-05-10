/**
 * Completa o ano 2026 inteiro na conta demo.
 * Roda depois do seed-demo.js.
 *
 * Uso:
 *   node scripts/seed-demo-fullyear.js
 */

require("fs").readFileSync(".env.local", "utf8").split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length) process.env[k.trim()] = v.join("=").trim();
});

const { initializeApp }                      = require("firebase/app");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");
const { getFirestore, addDoc, collection }   = require("firebase/firestore");

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
const WS_ID      = "Kc2D6yYRKh1V1AXYr4K5"; // gerado no seed anterior

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

// Variações por mês pra parecer real (supermercado, uber, lazer variam)
const VARIATIONS = {
  1:  { super1: 410, super2: 318, iFood1: 67, iFood2: 89, uber1: 42, uber2: 31, uber3: 55, gas: 235, lazer: 180, vest: 0,   edu: 27  },
  2:  { super1: 387, super2: 294, iFood1: 58, iFood2: 72, uber1: 38, uber2: 22, uber3: 41, gas: 220, lazer: 139, vest: 289, edu: 27  },
  3:  { super1: 395, super2: 310, iFood1: 74, iFood2: 55, uber1: 44, uber2: 28, uber3: 36, gas: 245, lazer: 90,  vest: 0,   edu: 0   },
  4:  { super1: 420, super2: 280, iFood1: 62, iFood2: 81, uber1: 35, uber2: 47, uber3: 29, gas: 210, lazer: 210, vest: 450, edu: 54  },
  5:  { super1: 312, super2: 0,   iFood1: 63, iFood2: 0,  uber1: 29, uber2: 0,  uber3: 0,  gas: 215, lazer: 0,   vest: 0,   edu: 0   }, // já tem
  6:  { super1: 398, super2: 305, iFood1: 70, iFood2: 65, uber1: 40, uber2: 33, uber3: 45, gas: 230, lazer: 160, vest: 320, edu: 0   },
  7:  { super1: 445, super2: 320, iFood1: 85, iFood2: 90, uber1: 50, uber2: 38, uber3: 42, gas: 250, lazer: 280, vest: 0,   edu: 27  },
  8:  { super1: 380, super2: 290, iFood1: 55, iFood2: 68, uber1: 36, uber2: 25, uber3: 39, gas: 225, lazer: 120, vest: 0,   edu: 0   },
  9:  { super1: 410, super2: 315, iFood1: 72, iFood2: 78, uber1: 43, uber2: 31, uber3: 48, gas: 240, lazer: 95,  vest: 580, edu: 108 },
  10: { super1: 392, super2: 298, iFood1: 60, iFood2: 82, uber1: 37, uber2: 44, uber3: 33, gas: 220, lazer: 350, vest: 0,   edu: 0   },
  11: { super1: 425, super2: 335, iFood1: 90, iFood2: 75, uber1: 48, uber2: 36, uber3: 52, gas: 255, lazer: 420, vest: 890, edu: 27  },
  12: { super1: 510, super2: 390, iFood1: 95, iFood2: 110, uber1: 55, uber2: 42, uber3: 60, gas: 270, lazer: 680, vest: 1200, edu: 0 },
};

function txsForMonth(uid, year, month) {
  const v  = VARIATIONS[month];
  const nu = "Nubank •••• 3640";
  const it = "Inter Conta";
  const txs = [
    // Entradas — R$25k total (salário R$22k + freela R$3k)
    tx(uid, "income",  "Salário",                   22000,  "Salário",     d(year,month,5),  it),
    tx(uid, "income",  "Freela design - cliente A",  3000,  "Salário",     d(year,month,20), it),
    // Moradia
    tx(uid, "expense", "Aluguel",                    2800,  "Moradia",     d(year,month,10), it),
    tx(uid, "expense", "Condomínio",                  620,  "Moradia",     d(year,month,10), it),
    tx(uid, "expense", "Vivo Internet Fibra",          149,  "Moradia",     d(year,month,8),  nu),
    // Saúde
    tx(uid, "expense", "Hapvida Saúde",                480,  "Saúde",       d(year,month,15), nu),
    tx(uid, "expense", "Smart Fit",                    120,  "Saúde",       d(year,month,1),  nu),
    // Assinaturas
    tx(uid, "expense", "Netflix",                    55.90,  "Assinaturas", d(year,month,18), nu),
    tx(uid, "expense", "Spotify",                    21.90,  "Assinaturas", d(year,month,18), nu),
    tx(uid, "expense", "Amazon Prime",               19.90,  "Assinaturas", d(year,month,22), nu),
    tx(uid, "expense", "iCloud+",                    12.90,  "Assinaturas", d(year,month,22), nu),
    // Alimentação
    tx(uid, "expense", "Supermercado Extra",         v.super1, "Alimentação", d(year,month,3),  nu),
    tx(uid, "expense", "iFood",                      v.iFood1, "Alimentação", d(year,month,6),  nu),
    tx(uid, "expense", "Padaria São Paulo",              34,  "Alimentação", d(year,month,9),  nu),
    tx(uid, "expense", "McDonald's",                     47,  "Alimentação", d(year,month,25), nu),
    // Transporte
    tx(uid, "expense", "Uber",                       v.uber1,  "Transporte",  d(year,month,4),  nu),
    tx(uid, "expense", "Posto Shell - Gasolina",     v.gas,    "Transporte",  d(year,month,14), nu),
    tx(uid, "expense", "Uber",                       v.uber2,  "Transporte",  d(year,month,21), nu),
  ];

  // Condicionais pra meses com mais movimento
  if (v.super2 > 0) txs.push(tx(uid, "expense", "Supermercado Pão de Açúcar", v.super2, "Alimentação", d(year,month,17), nu));
  if (v.iFood2 > 0) txs.push(tx(uid, "expense", "iFood",                      v.iFood2, "Alimentação", d(year,month,12), nu));
  if (v.uber3  > 0) txs.push(tx(uid, "expense", "Uber",                       v.uber3,  "Transporte",  d(year,month,26), nu));
  if (v.lazer  > 0) txs.push(tx(uid, "expense", month === 12 ? "Viagem de fim de ano" : month === 11 ? "Black Friday - Amazon" : month === 10 ? "Show - Coldplay" : "Ingresso.com", v.lazer, "Lazer", d(year,month,7), nu));
  if (v.vest   > 0) txs.push(tx(uid, "expense", month === 12 ? "Shopping - Presentes de Natal" : month === 11 ? "Black Friday - Moda" : month === 9 ? "Renner" : "Zara", v.vest, "Vestuário", d(year,month,16), nu));
  if (v.edu    > 0) txs.push(tx(uid, "expense", v.edu > 50 ? "Alura - Plano anual" : "Udemy", v.edu, "Educação", d(year,month,2), nu));

  return txs;
}

async function main() {
  console.log("🔐 Fazendo login...");
  const { user } = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASS);
  const uid = user.uid;
  console.log(`✅ Logado (${uid})\n`);

  // Meses que faltam: jan + jun até dez
  const missingMonths = [1, 6, 7, 8, 9, 10, 11, 12];

  for (const month of missingMonths) {
    const txs = txsForMonth(uid, 2026, month);
    for (const t of txs) {
      await addDoc(collection(db, "workspaces", WS_ID, "transactions"), t);
    }
    const mk = `2026-${String(month).padStart(2,"0")}`;
    console.log(`✅ ${mk} — ${txs.length} lançamentos (entrada: R$25.000)`);
  }

  // Atualiza também fev/mar/abr/mai pra bater com R$25k
  // (os existentes têm R$14.500 — vou adicionar a diferença como "Salário complemento")
  console.log("\n💡 Dica: os meses de fev–mai já tinham dados com salário menor.");
  console.log("   Pra uniformizar, apague o workspace no Firebase e rode seed-demo.js novamente,");
  console.log("   ou deixe assim (a variação fica natural pra demo).\n");

  console.log("🎉 Ano 2026 completo!");
  console.log(`   Renda mensal: R$25.000 (salário R$22k + freela R$3k)`);
  console.log(`   Meses preenchidos: jan, jun, jul, ago, set, out, nov, dez`);
  console.log(`\n⚠️  Lembre de setar a renda pra 25000 no app (ícone de lápis no campo Renda Mensal)`);
  process.exit(0);
}

main().catch((err) => { console.error("❌", err.message); process.exit(1); });
