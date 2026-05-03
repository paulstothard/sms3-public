import { cleanFormatText, summarizeTextFormatting } from "../../core/text-formatting.js";
import { makeTextStream, makeToolResult } from "../../core/workflow.js";

function getOutputFormat(options) {
  return options.outputFormat === "report" ? "report" : "cleaned";
}

export function runTextCleanerFormatter(input, options = {}) {
  const result = cleanFormatText(input, options);
  const report = summarizeTextFormatting(result.stats, result.changed);
  const outputFormat = getOutputFormat(options);
  const output = outputFormat === "report" ? report : result.text;

  return makeToolResult({
    output,
    download: {
      filename: "text-cleaner-formatter.txt",
      mimeType: "text/plain;charset=utf-8"
    },
    warnings: result.warnings,
    recordsProcessed: result.stats.finalLines,
    charactersRemoved: result.charactersRemoved,
    streams: {
      cleanedText: makeTextStream(result.text, "text/plain"),
      report: makeTextStream(report, "text/plain")
    }
  });
}

export const textCleanerFormatterRunner = runTextCleanerFormatter;
