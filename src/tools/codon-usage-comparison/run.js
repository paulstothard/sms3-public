import {
  codonUsageComparisonTableColumns,
  compareCodonUsageRows
} from "../../core/codon-usage-comparison.js";
import { getCodonUsageReference } from "../../core/codon-reference.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import { codonUsageReferences } from "../../reference-data/codon-usage/references.js";
import { runCodonUsage } from "../codon-usage/run.js";

function formatNumber(value) {
  return value === null ? "" : value.toFixed(3);
}

function makeTsv(rows) {
  const columns = codonUsageComparisonTableColumns.map((column) => column.id);
  return [
    columns.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.reference_id,
        row.amino_acid,
        row.codon,
        row.observed_count,
        formatNumber(row.observed_per_1000),
        formatNumber(row.reference_per_1000),
        formatNumber(row.per_1000_difference),
        formatNumber(row.observed_fraction),
        formatNumber(row.reference_fraction),
        formatNumber(row.fraction_difference),
        formatNumber(row.fraction_ratio),
        row.amino_acid_total
      ].join("\t")
    )
  ].join("\n");
}

function summarizeRows(rows) {
  const observedCodons = rows.filter((row) => row.observed_count > 0);
  const strongestFractionDifferences = [...observedCodons]
    .sort((left, right) => Math.abs(right.fraction_difference) - Math.abs(left.fraction_difference))
    .slice(0, 8);

  return {
    observedCodons,
    strongestFractionDifferences
  };
}

function makeReport(rows, reference) {
  const records = [...new Set(rows.map((row) => row.record))];
  const lines = [
    `Codon usage comparison`,
    `Reference: ${reference.name}`,
    `Reference source: ${reference.source?.name ?? ""} ${reference.source?.version ?? ""}`.trim(),
    ""
  ];

  for (const record of records) {
    const recordRows = rows.filter((row) => row.record === record);
    const summary = summarizeRows(recordRows);
    lines.push(`${record} vs ${reference.name}`);
    lines.push(`Observed codons with counts: ${summary.observedCodons.length}`);
    lines.push("Largest observed synonymous-fraction differences:");
    if (summary.strongestFractionDifferences.length === 0) {
      lines.push("none");
    } else {
      lines.push("aa\tcodon\tobserved_fraction\treference_fraction\tdifference\tobserved_count");
      for (const row of summary.strongestFractionDifferences) {
        lines.push(
          [
            row.amino_acid,
            row.codon,
            formatNumber(row.observed_fraction),
            formatNumber(row.reference_fraction),
            formatNumber(row.fraction_difference),
            row.observed_count
          ].join("\t")
        );
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function runCodonUsageComparison(input, options = {}) {
  const reference = getCodonUsageReference(codonUsageReferences, options.referenceId);
  const observed = runCodonUsage(input, {
    ...options,
    outputFormat: "tsv",
    geneticCode: reference?.geneticCode?.id ?? options.geneticCode
  });

  if (observed.recordsProcessed === 0) {
    return makeToolResult({
      output: "",
      warnings: observed.warnings,
      recordsProcessed: 0,
      basesProcessed: observed.basesProcessed,
      charactersRemoved: observed.charactersRemoved,
      streams: {
        table: makeTableStream(codonUsageComparisonTableColumns, [], "codon-usage-comparison")
      }
    });
  }

  const rows = compareCodonUsageRows(observed.streams.table?.rows ?? [], reference);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const report = makeReport(rows, reference);
  const output = outputFormat === "tsv" ? makeTsv(rows) : report;

  return makeToolResult({
    output,
    download: {
      filename: `codon-usage-comparison.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/plain;charset=utf-8"
    },
    warnings: observed.warnings,
    recordsProcessed: observed.recordsProcessed,
    basesProcessed: observed.basesProcessed,
    charactersRemoved: observed.charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(codonUsageComparisonTableColumns, rows, "codon-usage-comparison")
    }
  });
}
