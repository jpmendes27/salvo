/**
 * audit-ativacao.js — Diagnóstico de ativação dos usuários do Salvô!
 *
 * READ-ONLY: não escreve, atualiza nem deleta nada.
 *
 * Pré-requisito (uma das opções):
 *   a) Application Default Credentials:
 *      gcloud auth application-default login
 *   b) Service account:
 *      export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/serviceAccount.json
 *
 * Uso:
 *   node scripts/audit-ativacao.js
 *
 * Saída:
 *   - Tabela no console
 *   - scripts/audit-ativacao.csv
 */

// ─── Setup ────────────────────────────────────────────────────────────────────

// Lê .env.local para pegar o project ID sem precisar hardcodar
const fs = require("fs");
const path = require("path");

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  });
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
  console.error("NEXT_PUBLIC_FIREBASE_PROJECT_ID não encontrado em .env.local");
  process.exit(1);
}

// firebase-admin está em functions/node_modules
const adminPath = path.resolve(__dirname, "../functions/node_modules/firebase-admin");
const admin = require(adminPath);

const credential = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? admin.credential.cert(require(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS)))
  : admin.credential.applicationDefault();

admin.initializeApp({ credential, projectId: PROJECT_ID });

const auth = admin.auth();
const db   = admin.firestore();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(date) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR");
}

function pad(str, len) {
  const s = String(str ?? "");
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

// ─── Coleta dados ─────────────────────────────────────────────────────────────

async function listarTodosUsuariosAuth() {
  const users = [];
  let pageToken;
  do {
    const result = await auth.listUsers(1000, pageToken);
    users.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  return users;
}

async function contarTransacoesPorUsuario(uid) {
  // Busca em todos os workspaces onde o usuário tem transações com createdBy === uid
  // Abordagem: collectionGroup query em "transactions"
  const snap = await db
    .collectionGroup("transactions")
    .where("createdBy", "==", uid)
    .count()
    .get();
  return snap.data().count;
}

async function auditarUsuario(authUser) {
  const uid   = authUser.uid;
  const email = authUser.email || "(sem e-mail)";
  const criadoEm    = authUser.metadata?.creationTime ?? null;
  const ultimoLogin = authUser.metadata?.lastSignInTime ?? null;

  // Documento do usuário em Firestore
  let firestoreDoc = null;
  try {
    const snap = await db.collection("users").doc(uid).get();
    if (snap.exists) firestoreDoc = snap.data();
  } catch { /* usuário sem doc no Firestore */ }

  const workspaceIds     = firestoreDoc?.workspaceIds ?? [];
  const temWorkspace     = workspaceIds.length > 0;
  const hasCreatedReal   = firestoreDoc?.hasCreatedRealMonth === true;
  const accountVerified  = firestoreDoc?.accountVerified === true;
  const acceptedTerms    = !!firestoreDoc?.acceptedTermsVersion;

  // Conta transações criadas por esse usuário (collectionGroup)
  let qtdTransacoes = 0;
  try {
    qtdTransacoes = await contarTransacoesPorUsuario(uid);
  } catch { /* sem permissão ou sem transações */ }

  // Logs de erro: não existe collection dedicada no projeto — N/A
  const errosImportacao = "N/A";

  return {
    email,
    uid,
    criadoEm:       criadoEm ? new Date(criadoEm) : null,
    ultimoLogin:    ultimoLogin ? new Date(ultimoLogin) : null,
    accountVerified,
    acceptedTerms,
    temWorkspace,
    qtdTransacoes,
    hasCreatedReal,   // marcador de ativação real
    errosImportacao,
  };
}

// ─── Formatação de saída ──────────────────────────────────────────────────────

function ordenar(rows) {
  return rows.slice().sort((a, b) => {
    // Não-ativados primeiro
    if (a.hasCreatedReal !== b.hasCreatedReal) return a.hasCreatedReal ? 1 : -1;
    // Dentro de cada grupo: mais recentes primeiro
    const da = a.criadoEm?.getTime() ?? 0;
    const db_ = b.criadoEm?.getTime() ?? 0;
    return db_ - da;
  });
}

function imprimirTabela(rows) {
  const cols = [
    { label: "Email",            key: "email",          w: 34 },
    { label: "UID",              key: "uid",            w: 20 },
    { label: "Cadastro",         key: "criadoEm",       w: 12 },
    { label: "Último login",     key: "ultimoLogin",    w: 14 },
    { label: "Verificado",       key: "accountVerified",w: 11 },
    { label: "Onboard",          key: "acceptedTerms",  w: 8  },
    { label: "Workspace",        key: "temWorkspace",   w: 10 },
    { label: "Transações",       key: "qtdTransacoes",  w: 12 },
    { label: "Ativado ✓",        key: "hasCreatedReal", w: 10 },
    { label: "Erros import",     key: "errosImportacao",w: 13 },
  ];

  const header = cols.map((c) => pad(c.label, c.w)).join(" │ ");
  const sep    = cols.map((c) => "─".repeat(c.w)).join("─┼─");

  console.log("\n" + sep);
  console.log(header);
  console.log(sep);

  for (const r of rows) {
    const line = cols.map((c) => {
      let v = r[c.key];
      if (v instanceof Date) v = fmt(v);
      else if (typeof v === "boolean") v = v ? "sim" : "não";
      return pad(v, c.w);
    }).join(" │ ");
    console.log(line);
  }
  console.log(sep + "\n");

  const ativados    = rows.filter((r) => r.hasCreatedReal).length;
  const naoAtivados = rows.length - ativados;
  console.log(`Total: ${rows.length} usuários | Ativados: ${ativados} | Não ativados: ${naoAtivados}`);
}

function gerarCSV(rows) {
  const headers = [
    "email", "uid", "cadastro", "ultimo_login",
    "verificado", "onboard_concluido", "tem_workspace",
    "qtd_transacoes", "ativado_realMonth", "erros_importacao",
  ];

  const linhas = rows.map((r) => [
    r.email,
    r.uid,
    fmt(r.criadoEm),
    fmt(r.ultimoLogin),
    r.accountVerified  ? "sim" : "não",
    r.acceptedTerms    ? "sim" : "não",
    r.temWorkspace     ? "sim" : "não",
    r.qtdTransacoes,
    r.hasCreatedReal   ? "sim" : "não",
    r.errosImportacao,
  ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));

  return [headers.join(","), ...linhas].join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nConectando ao projeto: ${PROJECT_ID}`);
  console.log("Listando usuários do Firebase Auth...");

  const authUsers = await listarTodosUsuariosAuth();
  console.log(`${authUsers.length} usuários encontrados. Consultando Firestore...\n`);

  const rows = [];
  for (let i = 0; i < authUsers.length; i++) {
    process.stdout.write(`\r  Processando ${i + 1}/${authUsers.length}...`);
    rows.push(await auditarUsuario(authUsers[i]));
  }
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  const ordenados = ordenar(rows);

  imprimirTabela(ordenados);

  const csv = gerarCSV(ordenados);
  const csvPath = path.resolve(__dirname, "audit-ativacao.csv");
  fs.writeFileSync(csvPath, csv, "utf8");
  console.log(`\nCSV gerado em: ${csvPath}`);
}

main().catch((err) => {
  console.error("\nErro:", err.message);
  process.exit(1);
});
