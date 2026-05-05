import {
  findInSilicoPcrProducts,
  makePcrProductsFasta,
  makePcrProductsTsv,
  makePcrReport,
  pcrProductTableColumns
} from "../../core/in-silico-pcr.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["report", "tsv", "fasta"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "report";
}

export async function runInSilicoPcr(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "scanning-primers", progress: 0.1 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = findInSilicoPcrProducts(input, options);
  const outputFormat = normalizeOutputFormat(options.outputFormat);

  context.reportProgress?.({ phase: "building-output", progress: 0.85 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const report = makePcrReport(result);
  const tsv = makePcrProductsTsv(result.rows);
  const fasta = makePcrProductsFasta(result.rows, options.lineWidth);
  const outputs = { report, tsv, fasta };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "tsv" ? "in-silico-pcr-products.tsv" : outputFormat === "fasta" ? "in-silico-pcr-products.fasta" : "in-silico-pcr.txt",
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.records.length,
    basesProcessed: result.records.reduce((sum, record) => sum + record.sequence.length, 0),
    charactersRemoved: result.charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(pcrProductTableColumns, result.rows, "in-silico-pcr-products"),
      ...(outputFormat === "fasta" ? { fasta: makeTextStream(fasta, "text/x-fasta") } : {})
    }
  });
}
