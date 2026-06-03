/**
 * test-mp-parser.js — Standalone unit tests for the Mercado Pago adapter.
 *
 * No test framework needed. Run with:
 *   node scripts/test-mp-parser.js
 *
 * To test against the real PDF:
 *   node scripts/test-mp-parser.js /path/to/extrato-mp.pdf
 */

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// We need TypeScript to be compiled first. Run from project root after `tsc`.
// Alternatively, use ts-node:
//   npx ts-node --project tsconfig.json scripts/test-mp-parser.js

// Since the project uses Next.js and ships TypeScript, we use a path alias
// shim + ts-node approach. If running with plain node, build first with:
//   npx tsc --noEmit false --outDir .test-out
// and update paths below.

let parseMPText, parseBRCentavos, parseBRDate, runPipeline, isMercadoPago;

try {
  // Try ts-node resolution
  const tsNode = require("ts-node");
  tsNode.register({
    project: require("path").resolve(__dirname, "../tsconfig.json"),
    transpileOnly: true,
  });
  // Resolve @/ alias manually
  const Module = require("module");
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request.startsWith("@/")) {
      request = require("path").resolve(__dirname, "../src", request.slice(2));
    }
    return originalResolve.call(this, request, ...rest);
  };

  ({ parseMPText } = require("../src/lib/import/adapters/mercado-pago.ts"));
  ({ parseBRCentavos, parseBRDate } = require("../src/lib/import/normalize.ts"));
  ({ runPipeline, isMercadoPago } = require("../src/lib/import/pipeline.ts"));
} catch (e) {
  console.error("ts-node not available:", e.message);
  console.error("Install with: npm install -D ts-node");
  process.exit(1);
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg ?? "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(
      `${msg ?? "Expected"}: ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

// ─── parseBRCentavos unit tests ───────────────────────────────────────────────

console.log("\n── parseBRCentavos ──────────────────────────────────────────");

test("positive BR format", () => assertEqual(parseBRCentavos("R$ 1.000,50"), 100050));
test("negative BR format", () => assertEqual(parseBRCentavos("R$ -1.000,50"), -100050));
test("minus with Unicode dash", () => assertEqual(parseBRCentavos("R$ −18,75"), -1875));
test("small value R$ 0,01", () => assertEqual(parseBRCentavos("R$ 0,01"), 1));
test("no R$ prefix", () => assertEqual(parseBRCentavos("25,04"), 2504));
test("large value with thousands", () => assertEqual(parseBRCentavos("R$ 1.234.567,89"), 123456789));
test("zero", () => assertEqual(parseBRCentavos("R$ 0,00"), 0));

// ─── parseBRDate unit tests ───────────────────────────────────────────────────

console.log("\n── parseBRDate ──────────────────────────────────────────────");

test("DD/MM/YYYY", () => assertEqual(parseBRDate("01/01/2025"), "2025-01-01"));
test("DD/MM/YY", () => assertEqual(parseBRDate("31/12/25"), "2025-12-31"));
test("D/M/YYYY", () => assertEqual(parseBRDate("5/3/2025"), "2025-03-05"));
test("DD/MM without year (uses refYear)", () => {
  const result = parseBRDate("15/06", 2025);
  assertEqual(result, "2025-06-15");
});

// ─── MP detection ─────────────────────────────────────────────────────────────

console.log("\n── isMercadoPago ────────────────────────────────────────────");

test("detects by text", () =>
  assert(isMercadoPago("Extrato da Conta Mercado Pago"), "should detect"));
test("detects by filename", () =>
  assert(isMercadoPago("", "extrato-mercado-pago.pdf"), "should detect by filename"));
test("does not false-positive Nubank", () =>
  assert(!isMercadoPago("Extrato Nubank", "nubank.pdf"), "should not match"));

// ─── parseMPText unit tests ───────────────────────────────────────────────────

console.log("\n── parseMPText ──────────────────────────────────────────────");

// Representative extracted-text blocks simulating pdfjs output.

const SAMPLE_SIMPLE = `
Mercado Pago — Extrato de conta
Saldo inicial R$ 25,04
Saldo final R$ 16,81

Data Descrição ID da operação Valor Saldo
01/01/2025
Rendimentos
4512345678901234
R$ 0,01
R$ 25,05
`;

test("parses a simple positive transaction (Rendimentos)", () => {
  const { lines } = parseMPText(SAMPLE_SIMPLE);
  assert(lines.length >= 1, `expected ≥1 record, got ${lines.length}`);
  const first = lines[0];
  assertEqual(first.date, "01/01/2025");
  assertEqual(first.description, "Rendimentos");
  assertEqual(first.valorRaw, "R$ 0,01", "valorRaw should be +0,01, NOT the saldo");
  assertEqual(first.saldoRaw, "R$ 25,05");
  assertEqual(first.id, "4512345678901234");
});

const SAMPLE_NEGATIVE = `
Mercado Pago
Data Descrição ID da operação Valor Saldo
02/01/2025
Transferência enviada
SUPERMERCADO SILVA
9876543210987654
R$ -45,30
R$ 100,00
`;

test("parses a negative transaction (expense)", () => {
  const { lines } = parseMPText(SAMPLE_NEGATIVE);
  assert(lines.length >= 1, `expected ≥1, got ${lines.length}`);
  const r = lines[0];
  assertEqual(r.valorRaw, "R$ -45,30");
  assert(r.description.includes("Transferência enviada"), "description should contain transfer text");
  assert(!r.description.includes("R$"), "description should not contain R$");
});

const SAMPLE_CPF = `
Mercado Pago
Data Descrição ID da operação Valor Saldo
03/01/2025
Pix recebido
VIRGINIA DA SILVA RAMOS 10384159770
9876543210987654
R$ 50,00
R$ 150,00
`;

test("correctly identifies ID vs CPF in description", () => {
  const { lines } = parseMPText(SAMPLE_CPF);
  assert(lines.length >= 1, `expected ≥1, got ${lines.length}`);
  const r = lines[0];
  assertEqual(r.id, "9876543210987654", "ID should be the 16-digit operation ID, not the CPF");
  assert(r.description.includes("VIRGINIA DA SILVA RAMOS"), "CPF owner name should be in description");
});

const SAMPLE_IGNORAR = `
Mercado Pago
Data Descrição ID da operação Valor Saldo
04/01/2025
Dinheiro reservado
1111111111111111
R$ -10,00
R$ 140,00
05/01/2025
Rendimentos
2222222222222222
R$ 0,01
R$ 140,01
`;

test("extracts Dinheiro reservado as raw line (classify handles IGNORAR)", () => {
  const { lines } = parseMPText(SAMPLE_IGNORAR);
  const ignorarLine = lines.find((l) => l.description.toLowerCase().includes("dinheiro reservado"));
  assert(ignorarLine !== undefined, "should extract Dinheiro reservado as a raw line");
  // Classification happens in classify.ts, not here — adapter is neutral
});

const SAMPLE_MULTILINE = `
Mercado Pago
Data Descrição ID da operação Valor Saldo
05/01/2025
Pagamento recebido
João da Silva
Serviços de manutenção
3333333333333333
R$ 200,00
R$ 340,01
`;

test("handles multi-line description", () => {
  const { lines } = parseMPText(SAMPLE_MULTILINE);
  assert(lines.length >= 1, `expected ≥1, got ${lines.length}`);
  const r = lines[0];
  assert(r.description.includes("Pagamento recebido"), "should include first description line");
  assert(r.description.includes("João da Silva"), "should include second description line");
  assertEqual(r.id, "3333333333333333");
  assertEqual(r.valorRaw, "R$ 200,00");
});

// ─── Full pipeline test ───────────────────────────────────────────────────────

console.log("\n── runPipeline (full pipeline) ──────────────────────────────");

const PIPELINE_SAMPLE = `
Mercado Pago — Extrato de conta
Saldo inicial R$ 25,04
Saldo final R$ 16,81
Data Descrição ID da operação Valor Saldo
01/01/2025
Rendimentos
4512345678901234
R$ 0,01
R$ 25,05
01/01/2025
Dinheiro reservado
5555555555555555
R$ -8,24
R$ 16,81
`;

test("pipeline: first transaction is ENTRADA +R$0,01", () => {
  const result = runPipeline(PIPELINE_SAMPLE, "extrato-mercado-pago.pdf");
  assert(result.lines.length >= 1, "should produce classified lines");
  const entrada = result.lines.find((l) => l.classification === "ENTRADA");
  assert(entrada !== undefined, "should have at least one ENTRADA");
  assertEqual(entrada.valueCents, 1, "Rendimentos should be +1 cent (R$0,01)");
});

test("pipeline: Dinheiro reservado is IGNORAR", () => {
  const result = runPipeline(PIPELINE_SAMPLE, "extrato-mercado-pago.pdf");
  const ignorar = result.lines.find((l) => l.description.toLowerCase().includes("dinheiro reservado"));
  assert(ignorar !== undefined, "should have Dinheiro reservado line");
  assertEqual(ignorar.classification, "IGNORAR");
  assert(result.ignoredCount >= 1, `ignoredCount should be ≥1, got ${result.ignoredCount}`);
});

test("pipeline: reconciliation uses balance column", () => {
  const result = runPipeline(PIPELINE_SAMPLE, "extrato-mercado-pago.pdf");
  assertEqual(result.reconciliation.method, "balance-column");
});

// ─── Integration test against real PDF (optional) ─────────────────────────────

const pdfPath = process.argv[2];
if (pdfPath) {
  console.log(`\n── Real PDF test: ${pdfPath} ──────────────────────────────`);
  try {
    const { readFileSync } = require("fs");
    // pdfjs-dist is a browser/node lib — for scripts we need the node build
    const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
    pdfjs.GlobalWorkerOptions.workerSrc = false;

    (async () => {
      const data = readFileSync(pdfPath);
      const doc = await pdfjs.getDocument({ data }).promise;
      const pages = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        pages.push(content.items.map((i) => i.str).join("\n"));
      }
      const fullText = pages.join("\n");

      const result = runPipeline(fullText, pdfPath);
      const entradas = result.lines.filter((l) => l.classification === "ENTRADA");
      const saidas   = result.lines.filter((l) => l.classification === "SAIDA");
      const ignorar  = result.lines.filter((l) => l.classification === "IGNORAR");

      console.log(`  Total de linhas: ${result.lines.length}`);
      console.log(`  ENTRADA: ${entradas.length} | SAIDA: ${saidas.length} | IGNORAR: ${ignorar.length}`);
      console.log(`  Reconciliação: ${result.reconciliation.ok ? "✓ OK" : `✗ FALHOU — diff ${result.reconciliation.diffCents}¢`}`);
      if (result.warnings.length > 0) console.log(`  Avisos: ${result.warnings.join("; ")}`);

      const first = result.lines[0];
      if (first) {
        console.log(`\n  1ª transação:`);
        console.log(`    Descrição : ${first.description}`);
        console.log(`    Valor     : ${first.valueCents} centavos (${first.valueCents > 0 ? "+" : ""}R$${(first.valueCents / 100).toFixed(2)})`);
        console.log(`    Tipo      : ${first.classification}`);
        console.log(`    Esperado  : ENTRADA +1 centavo (R$0,01 — Rendimentos)`);
        test("1ª transação: Rendimentos ENTRADA +R$0,01", () => {
          assertEqual(first.classification, "ENTRADA");
          assertEqual(first.valueCents, 1);
        });
      }
    })().catch((e) => {
      console.error("  PDF test failed:", e.message);
    });
  } catch (e) {
    console.error("  Skipping PDF test (pdfjs-dist not available):", e.message);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

process.on("exit", () => {
  console.log(`\n${"─".repeat(55)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
});
