// Lazy-loaded so Next.js doesn't bundle pdfjs on the server path
let _pdfjs: typeof import("pdfjs-dist") | null = null;

async function getPdfjs() {
  if (!_pdfjs) {
    _pdfjs = await import("pdfjs-dist");
    // Use unpkg CDN for the worker — avoids bundler complications with Turbopack
    _pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${_pdfjs.version}/build/pdf.worker.min.js`;
  }
  return _pdfjs;
}

export async function extractPDFText(file: File, password?: string): Promise<string> {
  const pdfjs = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();

  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
  try {
    pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer), password }).promise;
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number };
    if (e.name === "PasswordException") {
      const msg = e.code === 2
        ? "Senha incorreta. Digite novamente a senha do PDF:"
        : "Este PDF está protegido por senha. Digite a senha para continuar:";
      const pw = window.prompt(msg);
      if (pw === null) throw new Error("Importação cancelada pelo usuário.");
      return extractPDFText(file, pw);
    }
    throw err;
  }

  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Group items by rounded y-coordinate to reconstruct visual rows
    const rowMap = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of (content.items ?? [])) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x, text: item.str });
    }

    // Sort rows top-to-bottom (higher y = higher on page in PDF coords)
    const sortedRows = [...rowMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join("  ")
          .trim()
      )
      .filter(Boolean);

    pageTexts.push(sortedRows.join("\n"));
  }

  return pageTexts.join("\n");
}
