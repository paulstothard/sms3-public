import {
  applyTableOperations,
  exportDelimitedTable,
  parseDelimitedTable,
  summarizeTable
} from "../../core/table.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

function coerceTableInput(input) {
  if (input?.kind === "table" && Array.isArray(input.columns) && Array.isArray(input.rows)) {
    return {
      columns: input.columns,
      rows: input.rows,
      delimiterId: "structured table",
      warnings: []
    };
  }
  return null;
}

export function runTableViewerCleaner(input, options = {}) {
  const structuredInput = coerceTableInput(input);
  const parsed = structuredInput ?? parseDelimitedTable(String(input ?? ""), {
    delimiter: options.delimiter ?? "auto",
    hasHeader: options.hasHeader !== false
  });
  const warnings = [...parsed.warnings];

  if (parsed.columns.length === 0) {
    return makeToolResult({
      output: "",
      warnings: warnings.length > 0 ? warnings : ["No table input was provided."],
      recordsProcessed: 0
    });
  }

  const cleaned = applyTableOperations(
    { columns: parsed.columns, rows: parsed.rows },
    options
  );
  warnings.push(...cleaned.warnings);

  const report = summarizeTable(cleaned.columns, cleaned.rows, parsed.delimiterId);
  const outputFormat = ["csv", "report"].includes(options.outputFormat) ? options.outputFormat : "tsv";
  const output = outputFormat === "report"
    ? report
    : exportDelimitedTable(cleaned.columns, cleaned.rows, outputFormat === "csv" ? "," : "\t");

  return makeToolResult({
    output,
    download: {
      filename: `table-viewer-cleaner.${outputFormat === "csv" ? "csv" : outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType:
        outputFormat === "csv"
          ? "text/csv;charset=utf-8"
          : outputFormat === "tsv"
            ? "text/tab-separated-values;charset=utf-8"
            : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: cleaned.rows.length,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(cleaned.columns, cleaned.rows, "generic-table")
    }
  });
}
