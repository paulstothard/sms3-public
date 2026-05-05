import {
  extractVcfData,
  makeVcfGenotypeTableTsv,
  vcfGenotypeTableColumns
} from "../../core/vcf-genotype-table.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["tsv", "report"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "tsv";
}

export async function runVcfGenotypeTable(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = extractVcfData(input, options);

  context.reportProgress?.({ phase: "building-output", progress: 0.75 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const columns = result.columns ?? vcfGenotypeTableColumns;
  const tsv = makeVcfGenotypeTableTsv(result.rows, columns);
  const outputs = {
    tsv,
    report: result.report
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "report" ? "vcf-extractor.txt" : `vcf-${result.dataType ?? "data"}.tsv`,
      mimeType: outputFormat === "report" ? "text/plain;charset=utf-8" : "text/tab-separated-values;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.rows.length,
    streams: {
      report: makeTextStream(result.report, "text/plain"),
      table: makeTableStream(columns, result.rows, "vcf-extractor")
    }
  });
}
