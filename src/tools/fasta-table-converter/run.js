import {
  convertFastaTable,
  fastaTableColumns,
  makeFastaTableTsv
} from "../../core/fasta-table-converter.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["table-tsv", "fasta", "report"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "table-tsv";
}

export async function runFastaTableConverter(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = convertFastaTable(input, options);

  context.reportProgress?.({ phase: "building-output", progress: 0.75 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const tsv = makeFastaTableTsv(result.tableRows);
  const outputs = {
    "table-tsv": tsv,
    fasta: result.fasta,
    report: result.report
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "fasta" ? "fasta-table-converter.fasta" : outputFormat === "table-tsv" ? "fasta-table-converter.tsv" : "fasta-table-converter.txt",
      mimeType: outputFormat === "fasta" ? "text/x-fasta;charset=utf-8" : outputFormat === "table-tsv" ? "text/tab-separated-values;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.sequenceRecords.length,
    streams: {
      fasta: makeTextStream(result.fasta, "text/x-fasta"),
      report: makeTextStream(result.report, "text/plain"),
      table: makeTableStream(fastaTableColumns, result.tableRows, "fasta-table-converter"),
      sequenceRecords: {
        kind: "sequence-records",
        alphabet: "dna-rna",
        schema: "fasta-table-converter",
        records: result.sequenceRecords
      }
    }
  });
}
