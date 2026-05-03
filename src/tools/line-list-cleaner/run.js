import {
  lineListCountColumns,
  processLineList,
  summarizeLineList
} from "../../core/line-list.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OPERATION_LABELS = {
  clean: "Clean only",
  sort: "Sort",
  unique: "Remove duplicates",
  "sort-unique": "Sort and remove duplicates",
  count: "Count occurrences"
};

function getOutputFormat(options) {
  if (options.outputFormat === "report") {
    return "report";
  }
  if (options.outputFormat === "tsv") {
    return "tsv";
  }
  return "list";
}

export function runLineListCleaner(input, options = {}) {
  const result = processLineList(input, options);
  const operationLabel = OPERATION_LABELS[options.operation ?? "sort-unique"] ?? "Clean list";
  const report = summarizeLineList(result, operationLabel);
  const outputFormat = getOutputFormat(options);
  const tsv = result.countRows.length > 0
    ? ["item\tcount", ...result.countRows.map((row) => `${row.item}\t${row.count}`)].join("\n")
    : "";
  const output = outputFormat === "report" ? report : outputFormat === "tsv" ? tsv : result.output;

  return makeToolResult({
    output,
    download: {
      filename: `line-list-cleaner.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.stats.normalizedItemCount,
    streams: {
      listText: makeTextStream(result.output, "text/plain"),
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(lineListCountColumns, result.countRows, "line-list-counts")
    }
  });
}

export const lineListCleanerRunner = runLineListCleaner;
