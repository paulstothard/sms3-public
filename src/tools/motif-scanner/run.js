import { parseSequenceInput } from "../../core/fasta.js";
import {
  motifMatchTableColumns,
  scanMotifRecords,
  scanMotifRecordsWithContext
} from "../../core/motif-scanner.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import dnaRnaMotifs from "../../reference-data/motifs/dna-rna-motifs.json" with { type: "json" };
import proteinMotifs from "../../reference-data/motifs/protein-motifs.json" with { type: "json" };
import motifProvenance from "../../reference-data/motifs/provenance.json" with { type: "json" };

function getSelectedMotifs(motifs, options = {}) {
  return motifs.filter((motif) => {
    if (options.motifId && options.motifId !== "all" && motif.id !== options.motifId) {
      return false;
    }
    if (options.motifClass && options.motifClass !== "all" && motif.class !== options.motifClass) {
      return false;
    }
    return true;
  });
}

function formatScore(value) {
  return value === null || value === undefined ? "" : String(value);
}

function makeTsv(rows) {
  const columns = motifMatchTableColumns.map((column) => column.id);
  return [
    columns.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.motif_id,
        row.motif_name,
        row.motif_class,
        row.source,
        row.syntax,
        row.strand,
        row.start,
        row.end,
        row.length,
        row.left_context,
        row.matched_text,
        row.right_context,
        row.context_sequence,
        formatScore(row.score),
        row.description
      ].join("\t")
    )
  ].join("\n");
}

function makeReport({ title, rows, selectedMotifs, recordsProcessed, residuesProcessed, alphabet }) {
  const lines = [
    title,
    `Motif records scanned: ${selectedMotifs.length}`,
    `Sequences scanned: ${recordsProcessed}`,
    `${alphabet === "protein" ? "Residues" : "Bases"} scanned: ${residuesProcessed}`,
    `Matches found: ${rows.length}`,
    `Database: ${motifProvenance.dataset} ${motifProvenance.version}`,
    `Database note: ${motifProvenance.description}`,
    ""
  ];

  if (selectedMotifs.length > 0) {
    lines.push("Selected motifs:");
    for (const motif of selectedMotifs) {
      const source = `${motif.source?.name ?? ""} ${motif.source?.version ?? ""}`.trim();
      lines.push(`- ${motif.name} (${motif.id}; ${motif.class}; ${source})`);
    }
    lines.push("");
  }

  if (rows.length === 0) {
    lines.push("No motif matches found.");
    return lines.join("\n");
  }

  lines.push("record\tmotif\tclass\tstrand\tstart\tend\tmatched_text\tcontext_sequence");
  for (const row of rows) {
    lines.push(
      [
        row.record,
        row.motif_name,
        row.motif_class,
        row.strand,
        row.start,
        row.end,
        row.matched_text,
        row.context_sequence
      ].join("\t")
    );
  }

  return lines.join("\n");
}

function runMotifScanner(input, options = {}, config) {
  const records = parseSequenceInput(input, config.alphabet);
  const selectedMotifs = getSelectedMotifs(config.motifs, options);
  const warnings = [];

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: [`No ${config.alphabet === "protein" ? "protein" : "DNA/RNA"} sequence input was provided.`],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0,
      streams: {
        table: makeTableStream(motifMatchTableColumns, [], config.schema)
      }
    });
  }

  if (selectedMotifs.length === 0) {
    warnings.push("No bundled motif records matched the selected filters.");
  }

  const rows = [];
  let sequenceLength = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const result = scanMotifRecords(record, selectedMotifs, {
      alphabet: config.alphabet,
      strand: config.alphabet === "dna-rna" ? options.strand ?? "both" : "forward",
      allowOverlaps: options.allowOverlaps !== false
    });
    rows.push(...result.rows);
    warnings.push(...result.warnings);
    sequenceLength += result.sequenceLength;
    charactersRemoved += result.charactersRemoved;
  }

  const report = makeReport({
    title: config.title,
    rows,
    selectedMotifs,
    recordsProcessed: records.length,
    residuesProcessed: sequenceLength,
    alphabet: config.alphabet
  });
  const tsv = makeTsv(rows);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const output = outputFormat === "tsv" ? tsv : report;

  return makeToolResult({
    output,
    download: {
      filename: `${config.filenameBase}.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed: sequenceLength,
    charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(motifMatchTableColumns, rows, config.schema)
    }
  });
}

async function runMotifScannerWorker(input, options = {}, config, context = {}) {
  context.reportProgress?.({ phase: "parsing-input", progress: 0.05 });
  const records = parseSequenceInput(input, config.alphabet);
  const selectedMotifs = getSelectedMotifs(config.motifs, options);
  const warnings = [];

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: [`No ${config.alphabet === "protein" ? "protein" : "DNA/RNA"} sequence input was provided.`],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0,
      streams: {
        table: makeTableStream(motifMatchTableColumns, [], config.schema)
      }
    });
  }

  if (selectedMotifs.length === 0) {
    warnings.push("No bundled motif records matched the selected filters.");
  }

  const rows = [];
  let sequenceLength = 0;
  let charactersRemoved = 0;

  for (const [index, record] of records.entries()) {
    await context.yieldIfNeeded?.();
    const result = await scanMotifRecordsWithContext(
      record,
      selectedMotifs,
      {
        alphabet: config.alphabet,
        strand: config.alphabet === "dna-rna" ? options.strand ?? "both" : "forward",
        allowOverlaps: options.allowOverlaps !== false
      },
      context
    );
    rows.push(...result.rows);
    warnings.push(...result.warnings);
    sequenceLength += result.sequenceLength;
    charactersRemoved += result.charactersRemoved;
    context.reportProgress?.({
      phase: "scanning-records",
      progress: 0.05 + ((index + 1) / records.length) * 0.85,
      recordsProcessed: index + 1,
      totalRecords: records.length
    });
  }

  context.reportProgress?.({ phase: "building-output", progress: 0.95 });
  context.throwIfCancelled?.();
  const report = makeReport({
    title: config.title,
    rows,
    selectedMotifs,
    recordsProcessed: records.length,
    residuesProcessed: sequenceLength,
    alphabet: config.alphabet
  });
  const tsv = makeTsv(rows);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const output = outputFormat === "tsv" ? tsv : report;

  return makeToolResult({
    output,
    download: {
      filename: `${config.filenameBase}.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed: sequenceLength,
    charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(motifMatchTableColumns, rows, config.schema)
    }
  });
}

export function runDnaRnaMotifScanner(input, options = {}) {
  return runMotifScanner(input, options, {
    alphabet: "dna-rna",
    motifs: dnaRnaMotifs,
    schema: "dna-rna-motif-scanner",
    title: "DNA/RNA motif scanner",
    filenameBase: "dna-rna-motif-scanner"
  });
}

export function runProteinMotifScanner(input, options = {}) {
  return runMotifScanner(input, options, {
    alphabet: "protein",
    motifs: proteinMotifs,
    schema: "protein-motif-scanner",
    title: "Protein motif scanner",
    filenameBase: "protein-motif-scanner"
  });
}

export async function runDnaRnaMotifScannerWorker(input, options = {}, context = {}) {
  return runMotifScannerWorker(
    input,
    options,
    {
      alphabet: "dna-rna",
      motifs: dnaRnaMotifs,
      schema: "dna-rna-motif-scanner",
      title: "DNA/RNA motif scanner",
      filenameBase: "dna-rna-motif-scanner"
    },
    context
  );
}

export async function runProteinMotifScannerWorker(input, options = {}, context = {}) {
  return runMotifScannerWorker(
    input,
    options,
    {
      alphabet: "protein",
      motifs: proteinMotifs,
      schema: "protein-motif-scanner",
      title: "Protein motif scanner",
      filenameBase: "protein-motif-scanner"
    },
    context
  );
}
