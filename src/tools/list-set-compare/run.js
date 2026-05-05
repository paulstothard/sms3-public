import {
  compareLists,
  formatItemList,
  listSetCompareColumns,
  makeListSetTableTsv,
  makeListSetVennSvg
} from "../../core/list-set-compare.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["table-tsv", "shared", "a-only", "b-only", "venn-svg", "report"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "table-tsv";
}

export async function runListSetCompare(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const result = compareLists(input, options);

  context.reportProgress?.({ phase: "building-output", progress: 0.75 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const outputs = {
    "table-tsv": makeListSetTableTsv(result.rows),
    shared: formatItemList(result.shared),
    "a-only": formatItemList(result.aOnly),
    "b-only": formatItemList(result.bOnly),
    "venn-svg": makeListSetVennSvg(result),
    report: result.report
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: outputFormat === "table-tsv" ? "list-set-compare.tsv" : outputFormat === "venn-svg" ? "list-set-compare.svg" : "list-set-compare.txt",
      mimeType: outputFormat === "table-tsv" ? "text/tab-separated-values;charset=utf-8" : outputFormat === "venn-svg" ? "image/svg+xml;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.rows.length,
    streams: {
      report: makeTextStream(result.report, "text/plain"),
      ...(outputFormat === "venn-svg" ? { venn: makeTextStream(outputs["venn-svg"], "image/svg+xml") } : {}),
      table: makeTableStream(listSetCompareColumns, result.rows, "list-set-compare")
    },
    visual: outputFormat === "venn-svg" ? { svg: outputs["venn-svg"] } : undefined
  });
}
