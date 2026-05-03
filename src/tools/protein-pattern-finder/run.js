import { parseSequenceInput } from "../../core/fasta.js";
import { findPatternMatches, makePatternRegex } from "../../core/pattern.js";
import { cleanProteinSequence, makeSequenceContext } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const proteinPatternFinderTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "match", label: "Match", type: "number" },
  { id: "start", label: "Start", type: "number" },
  { id: "end", label: "End", type: "number" },
  { id: "length", label: "Length", type: "number" },
  { id: "left_context", label: "Left context", type: "string" },
  { id: "matched_text", label: "Matched text", type: "string" },
  { id: "right_context", label: "Right context", type: "string" },
  { id: "context_sequence", label: "Context sequence", type: "string" }
];
const TSV_COLUMNS = proteinPatternFinderTableColumns.map((column) => column.id);

function makeRows(records) {
  return records.flatMap((record) =>
    record.matches.map((match, index) => ({
      record: record.title,
      match: index + 1,
      start: match.start,
      end: match.end,
      length: match.length,
      ...makeSequenceContext(record.sequence, match.start, match.end)
    }))
  );
}

function makeMatchedRegionRecords(records) {
  return records.flatMap((record) =>
    record.matches.map((match, index) => ({
      title: `${record.title} match ${index + 1} ${match.start}-${match.end}`,
      sequence: match.matchedText,
      sourceTitle: record.title,
      start: match.start,
      end: match.end
    }))
  );
}

function makeReport(records, pattern, options = {}) {
  const lines = [];
  const mode = options.patternMode === "regex" ? "regex" : options.patternMode === "iupac" ? "IUPAC motif" : "plain text";

  lines.push(`Protein pattern finder`);
  lines.push(`Pattern: ${pattern}`);
  lines.push(`Pattern mode: ${mode}`);
  lines.push(`Overlapping matches: ${options.allowOverlaps !== false ? "yes" : "no"}`);
  lines.push("");

  for (const record of records) {
    lines.push(`${record.title} pattern matches`);
    lines.push(`Length: ${record.cleanedLength}`);
    lines.push(`Matches: ${record.matches.length}`);
    if (record.matches.length > 0) {
      lines.push("match\tstart\tend\tlength\tmatched_text\tcontext_sequence");
      record.matches.forEach((match, index) => {
        const context = makeSequenceContext(record.sequence, match.start, match.end);
        lines.push([index + 1, match.start, match.end, match.length, context.matched_text, context.context_sequence].join("\t"));
      });
    } else {
      lines.push("No matches found.");
    }
    lines.push("");
  }

  lines.push(`Total matches: ${records.reduce((sum, record) => sum + record.matches.length, 0)}`);
  return lines.join("\n").trimEnd();
}

function makeTsv(rows) {
  return [
    TSV_COLUMNS.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.match,
        row.start,
        row.end,
        row.length,
        row.left_context,
        row.matched_text,
        row.right_context,
        row.context_sequence
      ].join("\t")
    )
  ].join("\n");
}

export function runProteinPatternFinder(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const pattern = String(options.pattern ?? "").trim();

  if (!pattern) {
    return makeToolResult({
      output: "",
      warnings: ["No protein pattern was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  try {
    makePatternRegex(pattern, { ...options, alphabet: "protein" });
  } catch (error) {
    return makeToolResult({
      output: "",
      warnings: [`Invalid ${options.patternMode === "regex" ? "regex" : "pattern"}: ${error.message}`],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

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
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanProteinSequence(record.sequence, {
      preserveCase: false,
      keepGaps: options.keepGaps !== false
    });
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-protein character(s).`);
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no protein sequence characters were found.`);
    }

    let matches = [];
    try {
      matches = findPatternMatches(cleaned.sequence, pattern, { ...options, alphabet: "protein" });
    } catch (error) {
      warnings.push(`${record.title}: ${error.message}`);
    }

    analyzedRecords.push({
      title: record.title,
      cleanedLength: cleaned.sequence.length,
      sequence: cleaned.sequence,
      matches
    });
  }

  const tableRows = makeRows(analyzedRecords);
  const matchedRegions = makeMatchedRegionRecords(analyzedRecords);
  const reportOutput = makeReport(analyzedRecords, pattern, options);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const output = outputFormat === "tsv" ? makeTsv(tableRows) : reportOutput;

  return makeToolResult({
    output,
    download: {
      filename: `protein-pattern-finder.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType:
        outputFormat === "tsv"
          ? "text/tab-separated-values"
          : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(reportOutput, "text/plain"),
      table: makeTableStream(proteinPatternFinderTableColumns, tableRows, "protein-pattern-finder"),
      matchedRegions: {
        kind: "sequence-records",
        schema: "protein-pattern-finder",
        alphabet: "protein",
        records: matchedRegions
      }
    }
  });
}
