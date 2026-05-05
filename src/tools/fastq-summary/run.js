import {
  fastqSummaryColumns,
  makeFastqSummaryTsv,
  summarizeFastq
} from "../../core/fastq-summary.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["report", "tsv"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "report";
}

export async function runFastqSummary(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = summarizeFastq(input);

  context.reportProgress?.({ phase: "building-output", progress: 0.75 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const tsv = makeFastqSummaryTsv(result.rows);
  const outputs = {
    report: result.report,
    tsv
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "report" ? "fastq-summary.txt" : "fastq-summary.tsv",
      mimeType: outputFormat === "report" ? "text/plain;charset=utf-8" : "text/tab-separated-values;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.records.length,
    streams: {
      report: makeTextStream(result.report, "text/plain"),
      table: makeTableStream(fastqSummaryColumns, result.rows, "fastq-summary")
    }
  });
}
