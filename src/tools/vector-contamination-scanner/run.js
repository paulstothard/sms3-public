import { parseSequenceInput } from "../../core/fasta.js";
import {
  scanVectorContaminationRecord,
  vectorContaminationTableColumns
} from "../../core/vector-contamination-scanner.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

let vectorReferenceDataPromise;

async function loadVectorReferenceData() {
  vectorReferenceDataPromise ??= Promise.all([
    import("../../reference-data/vector-contamination/index.json", { with: { type: "json" } }),
    import("../../reference-data/vector-contamination/summary.json", { with: { type: "json" } }),
    import("../../reference-data/vector-contamination/provenance.json", { with: { type: "json" } })
  ]).then(([index, summary, provenance]) => ({
    index: index.default,
    summary: summary.default,
    provenance: provenance.default
  }));
  return vectorReferenceDataPromise;
}

function countBy(rows, field) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[field] || "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => left[0].localeCompare(right[0]));
}

function formatCounts(counts) {
  return counts.length === 0 ? "none" : counts.map(([label, count]) => `${label}: ${count}`).join("; ");
}

function formatReport({ rows, recordsProcessed, basesProcessed, summary, provenance }) {
  const lines = [
    "Vector contamination scanner",
    "",
    `Input records scanned: ${recordsProcessed}`,
    `Bases scanned: ${basesProcessed}`,
    `Reference dataset: ${summary.dataset}`,
    `Reference version: ${summary.version}`,
    `Reference records searched: ${summary.recordCount}`,
    `Reference source: ${summary.sourceName}`,
    `Hits found: ${rows.length}`,
    `Confidence summary: ${formatCounts(countBy(rows, "confidence"))}`,
    `Source summary: ${formatCounts(countBy(rows, "source_database"))}`
  ];

  if (provenance.redistribution) {
    lines.push(`Reference note: ${provenance.redistribution}`);
  }

  lines.push("");
  if (rows.length === 0) {
    lines.push("No vector contamination hits found.");
    return lines.join("\n");
  }

  lines.push("Hits:");
  for (const row of rows) {
    lines.push(
      `${row.record}: ${row.reference_name}; ${row.aligned_length} bases; ${row.confidence}; ${row.strand}:${row.query_start}-${row.query_end}; identity ${row.percent_identity}%`
    );
  }

  return lines.join("\n");
}

function formatTsv(rows) {
  const columns = vectorContaminationTableColumns.map((column) => column.id);
  return [
    columns.join("\t"),
    ...rows.map((row) => columns.map((column) => row[column] ?? "").join("\t"))
  ].join("\n");
}

export async function runVectorContaminationScanner(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "loading-reference-data", progress: 0.05 });
  const { index, summary, provenance } = await loadVectorReferenceData();
  context.throwIfCancelled?.();
  const records = parseSequenceInput(input, "dna-rna");

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No DNA/RNA sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0,
      streams: {
        table: makeTableStream(vectorContaminationTableColumns, [], "vector-contamination-scanner")
      }
    });
  }

  const rows = [];
  const warnings = [];
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const [recordIndex, record] of records.entries()) {
    if (recordIndex > 0 && recordIndex % 25 === 0) {
      await context.yieldIfNeeded?.();
    } else {
      context.throwIfCancelled?.();
    }
    const result = scanVectorContaminationRecord(record, index, options);
    rows.push(...result.rows);
    warnings.push(...result.warnings);
    basesProcessed += result.sequenceLength;
    charactersRemoved += result.charactersRemoved;
    context.reportProgress?.({
      phase: "scanning",
      progress: 0.05 + ((recordIndex + 1) / records.length) * 0.9,
      recordsProcessed: recordIndex + 1,
      totalRecords: records.length
    });
  }
  context.throwIfCancelled?.();
  context.reportProgress?.({ phase: "building-output", progress: 0.98 });

  const report = formatReport({
    rows,
    recordsProcessed: records.length,
    basesProcessed,
    summary,
    provenance
  });
  const tsv = formatTsv(rows);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const output = outputFormat === "tsv" ? tsv : report;

  return makeToolResult({
    output,
    download: {
      filename: `vector-contamination-scanner.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(vectorContaminationTableColumns, rows, "vector-contamination-scanner")
    }
  });
}
