import { parseSequenceInput } from "../../core/fasta.js";
import { findPatternMatches, makePatternRegex } from "../../core/pattern.js";
import { cleanDnaRnaSequence, complementDnaRnaSequence, makeSequenceContext } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const dnaRnaPatternFinderTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "match", label: "Match", type: "number" },
  { id: "strand", label: "Strand", type: "string" },
  { id: "start", label: "Start", type: "number" },
  { id: "end", label: "End", type: "number" },
  { id: "length", label: "Length", type: "number" },
  { id: "left_context", label: "Left context", type: "string" },
  { id: "matched_text", label: "Matched text", type: "string" },
  { id: "right_context", label: "Right context", type: "string" },
  { id: "context_sequence", label: "Context sequence", type: "string" }
];
const TSV_COLUMNS = dnaRnaPatternFinderTableColumns.map((column) => column.id);

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

function getAlphabetMismatchWarning(sequence) {
  const letters = String(sequence ?? "").replace(/[^A-Za-z*]/g, "");
  if (letters.length < 12) {
    return "";
  }

  const upper = letters.toUpperCase();
  if (/[EFILOPQZJ]/.test(upper)) {
    return "input contains letters commonly found in protein sequences. If this is protein, use Protein Pattern Finder.";
  }

  return "";
}

function findDnaRnaMatches(sequence, pattern, options = {}) {
  const forwardMatches = findPatternMatches(sequence, pattern, { ...options, alphabet: "dna-rna" }).map((match) => ({
    ...match,
    strand: "+"
  }));

  if (options.strand !== "both") {
    return forwardMatches;
  }

  const rcSequence = reverseComplement(sequence);
  const reverseMatches = findPatternMatches(rcSequence, pattern, { ...options, alphabet: "dna-rna" }).map((match) => ({
    start: sequence.length - match.end + 1,
    end: sequence.length - match.start + 1,
    length: match.length,
    matchedText: match.matchedText,
    strand: "-"
  }));

  return [...forwardMatches, ...reverseMatches].sort((left, right) =>
    left.start - right.start || left.end - right.end || left.strand.localeCompare(right.strand)
  );
}

function makeRows(records) {
  return records.flatMap((record) =>
    record.matches.map((match, index) => ({
      record: record.title,
      match: index + 1,
      strand: match.strand,
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
      title: `${record.title} match ${index + 1} ${match.strand}${match.start}-${match.end}`,
      sequence: match.matchedText,
      sourceTitle: record.title,
      strand: match.strand,
      start: match.start,
      end: match.end
    }))
  );
}

function getModeLabel(options = {}) {
  if (options.patternMode === "regex") {
    return "regex";
  }
  if (options.patternMode === "iupac") {
    return "IUPAC motif";
  }
  return "plain text";
}

function makeReport(records, pattern, options = {}) {
  const lines = [];

  lines.push("DNA/RNA pattern finder");
  lines.push(`Pattern: ${pattern}`);
  lines.push(`Pattern mode: ${getModeLabel(options)}`);
  lines.push(`Strand search: ${options.strand === "both" ? "both strands" : "forward only"}`);
  lines.push(`Overlapping matches: ${options.allowOverlaps !== false ? "yes" : "no"}`);
  lines.push("");

  for (const record of records) {
    lines.push(`${record.title} pattern matches`);
    lines.push(`Length: ${record.cleanedLength}`);
    lines.push(`Matches: ${record.matches.length}`);
    if (record.matches.length > 0) {
      lines.push("match\tstrand\tstart\tend\tlength\tmatched_text\tcontext_sequence");
      record.matches.forEach((match, index) => {
        const context = makeSequenceContext(record.sequence, match.start, match.end);
        lines.push([index + 1, match.strand, match.start, match.end, match.length, context.matched_text, context.context_sequence].join("\t"));
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
        row.strand,
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

export function runDnaRnaPatternFinder(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const pattern = String(options.pattern ?? "").trim();

  if (!pattern) {
    return makeToolResult({
      output: "",
      warnings: ["No DNA/RNA pattern was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  try {
    makePatternRegex(pattern, { ...options, alphabet: "dna-rna" });
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
    const mismatchWarning = getAlphabetMismatchWarning(record.sequence);
    if (mismatchWarning) {
      warnings.push(`${record.title}: ${mismatchWarning}`);
    }

    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: options.keepGaps === true
    });
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }

    let matches = [];
    try {
      matches = findDnaRnaMatches(cleaned.sequence, pattern, options);
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
      filename: `dna-rna-pattern-finder.${outputFormat === "tsv" ? "tsv" : "txt"}`,
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
      table: makeTableStream(dnaRnaPatternFinderTableColumns, tableRows, "dna-rna-pattern-finder"),
      matchedRegions: {
        kind: "sequence-records",
        schema: "dna-rna-pattern-finder",
        alphabet: "dna-rna",
        records: matchedRegions
      }
    }
  });
}
