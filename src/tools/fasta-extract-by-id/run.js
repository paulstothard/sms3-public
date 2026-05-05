import {
  extractFastaById,
  fastaExtractByIdColumns,
  makeFastaExtractByIdTsv
} from "../../core/fasta-extract-by-id.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["fasta", "table-tsv", "report"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "fasta";
}

export async function runFastaExtractById(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = extractFastaById(input, options);

  context.reportProgress?.({ phase: "building-output", progress: 0.75 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const tsv = makeFastaExtractByIdTsv(result.rows);
  const outputs = {
    fasta: result.fasta,
    "table-tsv": tsv,
    report: result.report
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "fasta" ? "fasta-extract-by-id.fasta" : outputFormat === "table-tsv" ? "fasta-extract-by-id.tsv" : "fasta-extract-by-id.txt",
      mimeType: outputFormat === "fasta" ? "text/x-fasta;charset=utf-8" : outputFormat === "table-tsv" ? "text/tab-separated-values;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.records.length,
    streams: {
      fasta: makeTextStream(result.fasta, "text/x-fasta"),
      report: makeTextStream(result.report, "text/plain"),
      table: makeTableStream(fastaExtractByIdColumns, result.rows, "fasta-extract-by-id"),
      sequenceRecords: {
        kind: "sequence-records",
        alphabet: "dna-rna",
        schema: "fasta-extract-by-id",
        records: result.outputRecords
      }
    }
  });
}
