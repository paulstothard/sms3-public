import { parseSequenceInput } from "../../core/fasta.js";
import { cleanDnaRnaSequence, getDnaRnaStats } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import {
  sequenceStatsCountColumns,
  sequenceStatsTableColumns,
  sequenceStatsTsvColumns
} from "./table-columns.js";

const COUNT_COLUMNS = sequenceStatsCountColumns;
const TSV_COLUMNS = sequenceStatsTsvColumns;
const TABLE_COLUMNS = sequenceStatsTableColumns;

function formatPercent(value) {
  return value.toFixed(2);
}

function addStats(total, stats) {
  total.length += stats.length;
  total.gcCount += stats.gcCount;
  total.unambiguousBases += stats.unambiguousBases;
  total.ambiguityCount += stats.ambiguityCount;
  total.nCount += stats.nCount;
  total.xCount += stats.xCount;
  total.gapCount += stats.gapCount;

  for (const column of COUNT_COLUMNS) {
    total.counts[column] += stats.counts[column];
  }
  total.counts.gaps += stats.counts.gaps;
}

function makeEmptyTotal() {
  const counts = Object.fromEntries(COUNT_COLUMNS.map((column) => [column, 0]));
  counts.gaps = 0;

  return {
    length: 0,
    counts,
    gcCount: 0,
    unambiguousBases: 0,
    ambiguityCount: 0,
    nCount: 0,
    xCount: 0,
    gapCount: 0
  };
}

function makeReport(records) {
  const lines = [];

  for (const record of records) {
    lines.push(`${record.title} stats`);
    lines.push(`Length: ${record.stats.length}`);
    lines.push(`Unambiguous bases (A/C/G/T/U): ${record.stats.unambiguousBases}`);
    lines.push(`GC count: ${record.stats.gcCount}`);
    lines.push(`GC percent: ${formatPercent(record.stats.gcPercent)}`);
    lines.push(`Ambiguous symbols: ${record.stats.ambiguityCount}`);
    lines.push(`N count: ${record.stats.nCount}`);
    lines.push(`X count: ${record.stats.xCount}`);
    lines.push(`Gap count: ${record.stats.gapCount}`);
    lines.push(
      `Counts: ${COUNT_COLUMNS.map((column) => `${column}=${record.stats.counts[column]}`).join(", ")}, gaps=${record.stats.counts.gaps}`
    );
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function makeTableRow(record) {
  return {
    title: record.title,
    length: record.stats.length,
    unambiguous_bases: record.stats.unambiguousBases,
    gc_count: record.stats.gcCount,
    gc_percent: record.stats.gcPercent,
    ambiguous_symbols: record.stats.ambiguityCount,
    n_count: record.stats.nCount,
    x_count: record.stats.xCount,
    gap_count: record.stats.gapCount,
    ...Object.fromEntries(COUNT_COLUMNS.map((column) => [column, record.stats.counts[column]])),
    gaps: record.stats.counts.gaps
  };
}

function makeTableRows(records) {
  return records.map((record) => makeTableRow(record));
}

function makeTsv(records) {
  const rows = [TSV_COLUMNS.join("\t")];

  for (const record of records) {
    rows.push(
      [
        record.title,
        record.stats.length,
        record.stats.unambiguousBases,
        record.stats.gcCount,
        formatPercent(record.stats.gcPercent),
        record.stats.ambiguityCount,
        record.stats.nCount,
        record.stats.xCount,
        record.stats.gapCount,
        ...COUNT_COLUMNS.map((column) => record.stats.counts[column]),
        record.stats.counts.gaps
      ].join("\t")
    );
  }

  return rows.join("\n");
}

export function runSequenceStatsDnaRna(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  const analyzedRecords = [];
  const total = makeEmptyTotal();
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: options.keepGaps !== false
    });
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(
        `${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`
      );
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }

    const stats = getDnaRnaStats(cleaned.sequence);
    analyzedRecords.push({ title: record.title, stats });
    addStats(total, stats);
  }

  if (analyzedRecords.length > 1) {
    analyzedRecords.push({
      title: "Total",
      stats: {
        ...total,
        gcPercent: total.unambiguousBases > 0 ? (total.gcCount / total.unambiguousBases) * 100 : 0
      }
    });
  }

  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const reportOutput = makeReport(analyzedRecords);
  const tableRows = makeTableRows(analyzedRecords);
  const output = outputFormat === "tsv" ? makeTsv(analyzedRecords) : reportOutput;

  return makeToolResult({
    output,
    download: {
      filename: `sequence-stats-dna-rna.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType:
        outputFormat === "tsv"
          ? "text/tab-separated-values;charset=utf-8"
          : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed: total.length,
    charactersRemoved,
    streams: {
      report: makeTextStream(reportOutput, "text/plain"),
      table: makeTableStream(TABLE_COLUMNS, tableRows, "sequence-stats-dna-rna"),
      statsRecords: {
        kind: "stats-records",
        schema: "sequence-stats-dna-rna",
        records: analyzedRecords.map((record) => ({
          title: record.title,
          stats: record.stats
        }))
      }
    }
  });
}
