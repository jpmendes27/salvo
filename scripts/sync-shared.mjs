// sync-shared.mjs — copia o núcleo puro compartilhado pro pacote das functions.
//
// Fonte da verdade ÚNICA: src/lib/shared/*.ts (o cliente Next importa direto de lá).
// As Cloud Functions são deployadas isoladas (não enxergam ../src em runtime), então
// precisam de uma CÓPIA local em functions/src/shared/. Este script gera essa cópia
// (com banner "não edite") a cada build — roda como `prebuild` do functions.
//
// Regra: NÃO editar functions/src/shared/ à mão. Mexeu em src/lib/shared/ → rebuild.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "src", "lib", "shared");
const dstDir = join(root, "functions", "src", "shared");

const BANNER =
  "// ⚠️ GERADO por scripts/sync-shared.mjs — NÃO EDITE AQUI.\n" +
  "// Fonte da verdade: src/lib/shared/. Rode o build do functions pra regenerar.\n\n";

if (!existsSync(srcDir)) {
  console.error(`[sync-shared] fonte não encontrada: ${srcDir}`);
  process.exit(1);
}

mkdirSync(dstDir, { recursive: true });

// Limpa .ts órfãos no destino (arquivo removido da fonte some do mirror também).
for (const f of readdirSync(dstDir)) {
  if (f.endsWith(".ts")) rmSync(join(dstDir, f));
}

let n = 0;
for (const f of readdirSync(srcDir)) {
  if (!f.endsWith(".ts")) continue;
  writeFileSync(join(dstDir, f), BANNER + readFileSync(join(srcDir, f), "utf8"));
  n++;
}
console.log(`[sync-shared] ${n} arquivo(s) src/lib/shared/ → functions/src/shared/`);
