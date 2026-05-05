import {
  alignMultipleSequences,
  makeMultipleAlignmentClustal,
  makeMultipleAlignmentFasta,
  makeMultipleAlignmentReport,
  makeMultipleAlignmentSvg,
  makeMultipleAlignmentTsv,
  multipleAlignmentTableColumns
} from "../../core/multiple-sequence-alignment.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const OUTPUT_FORMATS = new Set(["report", "aligned-fasta", "clustal", "tsv", "svg-color"]);

function normalizeOutputFormat(value) {
  return OUTPUT_FORMATS.has(value) ? value : "clustal";
}

async function runMultipleAlignment(input, options = {}, alphabet, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  context.throwIfCancelled?.();
  await context.yieldIfNeeded?.();

  const prepared = await alignMultipleSequences(input, { ...options, alphabet }, context);
  if (!prepared.alignment) {
    return makeToolResult({
      output: "",
      warnings: prepared.warnings,
      recordsProcessed: prepared.records.length,
      basesProcessed: prepared.totalSymbols,
      charactersRemoved: prepared.charactersRemoved
    });
  }

  const outputFormat = normalizeOutputFormat(options.outputFormat);
  const report = makeMultipleAlignmentReport(prepared);
  const fasta = makeMultipleAlignmentFasta(prepared.alignment, options.lineWidth);
  const clustal = makeMultipleAlignmentClustal(prepared.alignment, options.lineWidth);
  const tsv = makeMultipleAlignmentTsv(prepared.alignment);
  const svg = makeMultipleAlignmentSvg(prepared.alignment, { alphabet, lineWidth: options.lineWidth });
  const outputs = {
    report,
    "aligned-fasta": fasta,
    clustal,
    tsv,
    "svg-color": svg
  };
  const extensions = {
    report: "txt",
    "aligned-fasta": "fasta",
    clustal: "aln",
    tsv: "tsv",
    "svg-color": "svg"
  };
  const mimeTypes = {
    report: "text/plain;charset=utf-8",
    "aligned-fasta": "text/plain;charset=utf-8",
    clustal: "text/plain;charset=utf-8",
    tsv: "text/tab-separated-values;charset=utf-8",
    "svg-color": "image/svg+xml;charset=utf-8"
  };

  context.reportProgress?.({ phase: "finished", progress: 1 });

  return makeToolResult({
    output: outputs[outputFormat],
    download: {
      filename: `${alphabet === "protein" ? "protein" : "dna-rna"}-multiple-alignment.${extensions[outputFormat]}`,
      mimeType: mimeTypes[outputFormat]
    },
    warnings: prepared.warnings,
    recordsProcessed: prepared.records.length,
    basesProcessed: prepared.totalSymbols,
    charactersRemoved: prepared.charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      fasta: makeTextStream(fasta, "text/x-fasta"),
      clustal: makeTextStream(clustal, "text/plain"),
      table: makeTableStream(multipleAlignmentTableColumns, prepared.alignment.rows, `multiple-alignment-${alphabet}`),
      ...(outputFormat === "svg-color" ? { coloredSvg: makeTextStream(svg, "image/svg+xml") } : {})
    },
    visual: outputFormat === "svg-color" ? { svg } : undefined
  });
}

export function runMultipleAlignDnaRna(input, options = {}, context = {}) {
  return runMultipleAlignment(input, options, "dna-rna", context);
}

export function runMultipleAlignProtein(input, options = {}, context = {}) {
  return runMultipleAlignment(input, options, "protein", context);
}
