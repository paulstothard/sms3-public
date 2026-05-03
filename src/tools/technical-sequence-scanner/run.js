import { parseSequenceInput } from "../../core/fasta.js";
import { motifMatchTableColumns, scanMotifRecords } from "../../core/motif-scanner.js";
import { makePatternRegex } from "../../core/pattern.js";
import { cleanSequence, complementDnaRnaSequence, makeSequenceContext } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const technicalSequenceTableColumns = [
  ...motifMatchTableColumns,
  { id: "match_type", label: "Match type", type: "string" }
];

let technicalSequenceDataPromise;

async function loadTechnicalSequenceData() {
  technicalSequenceDataPromise ??= Promise.all([
    import("../../reference-data/technical-sequences/sequences.json", { with: { type: "json" } }),
    import("../../reference-data/technical-sequences/provenance.json", { with: { type: "json" } })
  ]).then(([records, provenance]) => ({
    records: records.default,
    provenance: provenance.default
  }));
  return technicalSequenceDataPromise;
}

function getSelectedRecords(records, options = {}) {
  return records.filter((record) => {
    if (options.sequenceId && options.sequenceId !== "all" && record.id !== options.sequenceId) {
      return false;
    }
    if (options.sequenceClass && options.sequenceClass !== "all" && record.class !== options.sequenceClass) {
      return false;
    }
    return true;
  });
}

function parseCustomSequences(value = "") {
  return value
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((sequence, index) => {
      const cleaned = cleanSequence(sequence, {
        alphabet: "dna-rna",
        preserveCase: false,
        keepGaps: false
      });
      const warnings = [];
      if (cleaned.removedCount > 0) {
        warnings.push(`Custom technical sequence ${index + 1}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
      }
      if (cleaned.sequence.length === 0) {
        warnings.push(`Custom technical sequence ${index + 1}: no DNA/RNA sequence characters were found.`);
      }
      return {
        record: {
          id: `custom-technical-sequence-${index + 1}`,
          name: `Custom technical sequence ${index + 1}`,
          alphabet: "dna-rna",
          class: "custom",
          syntax: "iupac",
          pattern: cleaned.sequence,
          source: {
            name: "User supplied",
            version: "current run",
            accessDate: "",
            url: "",
            citation: "",
            license: "User supplied sequence."
          },
          description: "User-supplied custom technical sequence.",
          scope: "Current run only.",
          match: {
            strand: "both",
            coordinateSystem: "1-based inclusive",
            overlappingDefault: true,
            score: "not-applicable",
            assumptions: "IUPAC full-sequence match against cleaned DNA/RNA sequence."
          }
        },
        warnings
      };
    })
    .filter((item) => item.record.pattern.length > 0 || item.warnings.length > 0);
}

function formatScore(value) {
  return value === null || value === undefined ? "" : String(value);
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

function summarizeLongestHits(rows) {
  const byRecord = new Map();
  for (const row of rows) {
    const current = byRecord.get(row.record);
    if (
      !current ||
      row.length > current.length ||
      (row.length === current.length && row.match_type.localeCompare(current.match_type) < 0)
    ) {
      byRecord.set(row.record, row);
    }
  }
  return [...byRecord.values()].sort((left, right) => left.record.localeCompare(right.record));
}

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

function getPatternMode(syntax) {
  return syntax === "iupac" ? "iupac" : "plain";
}

function patternMatches(sequence, pattern, syntax) {
  const regex = makePatternRegex(pattern, {
    alphabet: "dna-rna",
    patternMode: getPatternMode(syntax),
    caseInsensitive: true
  });
  return regex.test(sequence);
}

function makePartialRow(recordTitle, motif, details) {
  return {
    record: recordTitle,
    motif_id: motif.id,
    motif_name: motif.name,
    motif_class: motif.class,
    source: motif.source?.name ?? "",
    syntax: motif.syntax,
    strand: details.strand,
    start: details.start,
    end: details.end,
    length: details.length,
    matched_text: details.matchedText,
    score: null,
    description: motif.description,
    match_type: details.matchType
  };
}

function scanPartialEndsForSequence(recordTitle, sequence, motif, options) {
  const minLength = Math.max(1, Math.floor(Number(options.minimumPartialLength) || 12));
  const rows = [];
  if (motif.pattern.length < minLength || sequence.length < minLength) {
    return rows;
  }

  const maxLength = Math.min(motif.pattern.length - 1, sequence.length);
  for (let length = maxLength; length >= minLength; length -= 1) {
    const motifPrefix = motif.pattern.slice(0, length);
    const motifSuffix = motif.pattern.slice(motif.pattern.length - length);
    const sequencePrefix = sequence.slice(0, length);
    const sequenceSuffix = sequence.slice(sequence.length - length);

    if (patternMatches(sequencePrefix, motifSuffix, motif.syntax)) {
      rows.push(
        makePartialRow(recordTitle, motif, {
          strand: "+",
          start: 1,
          end: length,
          length,
          matchedText: sequencePrefix,
          matchType: "5_prime_partial"
        })
      );
      break;
    }

    if (patternMatches(sequenceSuffix, motifPrefix, motif.syntax)) {
      rows.push(
        makePartialRow(recordTitle, motif, {
          strand: "+",
          start: sequence.length - length + 1,
          end: sequence.length,
          length,
          matchedText: sequenceSuffix,
          matchType: "3_prime_partial"
        })
      );
      break;
    }
  }

  if ((options.strand ?? "both") === "both") {
    const reverseSequence = reverseComplement(sequence);
    const reverseRows = scanPartialEndsForSequence(recordTitle, reverseSequence, motif, {
      ...options,
      strand: "forward"
    });
    for (const row of reverseRows) {
      rows.push({
        ...row,
        strand: "-",
        start: sequence.length - row.end + 1,
        end: sequence.length - row.start + 1
      });
    }
  }

  return rows;
}

function scanTechnicalRecord(record, selectedRecords, options = {}) {
  const cleaned = cleanSequence(record.sequence ?? "", {
    alphabet: "dna-rna",
    preserveCase: false,
    keepGaps: false
  });
  const title = record.title ?? "sequence";
  const warnings = [];
  if (cleaned.removedCount > 0) {
    warnings.push(`${title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`);
  }
  if (cleaned.sequence.length === 0) {
    warnings.push(`${title}: no DNA/RNA sequence characters were found.`);
    return {
      rows: [],
      warnings,
      charactersRemoved: cleaned.removedCount,
      sequenceLength: 0
    };
  }

  const matchMode = options.matchMode ?? "full";
  const fullRows =
    matchMode === "partial-ends"
      ? []
      : scanMotifRecords(record, selectedRecords, {
          alphabet: "dna-rna",
          strand: options.strand ?? "both",
          allowOverlaps: options.allowOverlaps !== false
        }).rows.map((row) => ({ ...row, match_type: "full" }));
  const partialRows =
    matchMode === "full"
      ? []
      : selectedRecords.flatMap((motif) =>
          scanPartialEndsForSequence(title, cleaned.sequence, motif, options)
        );

  const seen = new Set();
  const rows = [...fullRows, ...partialRows].filter((row) => {
    const key = [
      row.record,
      row.motif_id,
      row.strand,
      row.start,
      row.end,
      row.matched_text,
      row.match_type
    ].join("\t");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).map((row) => ({
    ...row,
    ...makeSequenceContext(cleaned.sequence, row.start, row.end)
  }));
  rows.sort((left, right) =>
    left.start - right.start ||
    left.end - right.end ||
    left.strand.localeCompare(right.strand) ||
    left.match_type.localeCompare(right.match_type) ||
    left.motif_id.localeCompare(right.motif_id)
  );

  return {
    rows,
    warnings,
    charactersRemoved: cleaned.removedCount,
    sequenceLength: cleaned.sequence.length
  };
}

function makeTsv(rows) {
  const columns = technicalSequenceTableColumns.map((column) => column.id);
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
        row.description,
        row.match_type
      ].join("\t")
    )
  ].join("\n");
}

function makeReport({ rows, selectedRecords, recordsProcessed, basesProcessed, provenance }) {
  const lines = [
    "Technical sequence scanner",
    `Technical sequences scanned: ${selectedRecords.length}`,
    `Sequences scanned: ${recordsProcessed}`,
    `Bases scanned: ${basesProcessed}`,
    `Matches found: ${rows.length}`,
    `Database: ${provenance.dataset} ${provenance.version}`,
    `Database note: ${provenance.description}`,
    ""
  ];

  if (selectedRecords.length > 0) {
    lines.push("Selected technical sequences:");
    for (const record of selectedRecords) {
      const source = `${record.source?.name ?? ""} ${record.source?.version ?? ""}`.trim();
      lines.push(`- ${record.name} (${record.id}; ${record.class}; ${source})`);
    }
    lines.push("");
  }

  if (rows.length === 0) {
    lines.push("No technical sequence matches found.");
    return lines.join("\n");
  }

  lines.push("Match summary:");
  lines.push(`- By match type: ${formatCounts(countBy(rows, "match_type"))}`);
  lines.push(`- By class: ${formatCounts(countBy(rows, "motif_class"))}`);
  lines.push("");

  const longestHits = summarizeLongestHits(rows);
  if (longestHits.length > 0) {
    lines.push("Longest hit by input record:");
    for (const row of longestHits) {
      lines.push(
        `- ${row.record}: ${row.motif_name}; ${row.length} bases; ${row.match_type}; ${row.strand}:${row.start}-${row.end}`
      );
    }
    lines.push("");
  }

  lines.push("record\ttechnical_sequence\tclass\tstrand\tstart\tend\tmatch_type\tmatched_text\tcontext_sequence");
  for (const row of rows) {
    lines.push(
      [
        row.record,
        row.motif_name,
        row.motif_class,
        row.strand,
        row.start,
        row.end,
        row.match_type,
        row.matched_text,
        row.context_sequence
      ].join("\t")
    );
  }

  return lines.join("\n");
}

export async function runTechnicalSequenceScanner(input, options = {}, context = {}) {
  context.reportProgress?.({ phase: "loading-reference-data", progress: 0.05 });
  const { records: technicalSequences, provenance } = await loadTechnicalSequenceData();
  context.throwIfCancelled?.();
  const records = parseSequenceInput(input, "dna-rna");
  const custom = parseCustomSequences(options.customSequences ?? "");
  const selectedRecords = [
    ...getSelectedRecords(technicalSequences, options),
    ...custom.map((item) => item.record).filter((record) => {
      return (
        record.pattern.length > 0 &&
        (!options.sequenceClass || options.sequenceClass === "all" || options.sequenceClass === "custom")
      );
    })
  ];
  const warnings = custom.flatMap((item) => item.warnings);

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No DNA/RNA sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0,
      streams: {
        table: makeTableStream(technicalSequenceTableColumns, [], "technical-sequence-scanner")
      }
    });
  }

  if (selectedRecords.length === 0) {
    warnings.push("No bundled or custom technical sequences matched the selected filters.");
  }
  const minimumPartialLength = Math.floor(Number(options.minimumPartialLength) || 12);
  if ((options.matchMode === "partial-ends" || options.matchMode === "full-or-partial") && minimumPartialLength < 8) {
    warnings.push("Minimum partial match length is short; expect many low-specificity matches.");
  }

  const rows = [];
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const [index, record] of records.entries()) {
    if (index > 0 && index % 25 === 0) {
      await context.yieldIfNeeded?.();
    } else {
      context.throwIfCancelled?.();
    }
    const result = scanTechnicalRecord(record, selectedRecords, {
      ...options,
      minimumPartialLength
    });
    rows.push(...result.rows);
    warnings.push(...result.warnings);
    basesProcessed += result.sequenceLength;
    charactersRemoved += result.charactersRemoved;
    context.reportProgress?.({
      phase: "scanning",
      progress: 0.05 + ((index + 1) / records.length) * 0.9,
      recordsProcessed: index + 1,
      totalRecords: records.length
    });
  }
  context.throwIfCancelled?.();

  const report = makeReport({
    rows,
    selectedRecords,
    recordsProcessed: records.length,
    basesProcessed,
    provenance
  });
  const tsv = makeTsv(rows);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "report";
  const output = outputFormat === "tsv" ? tsv : report;

  return makeToolResult({
    output,
    download: {
      filename: `technical-sequence-scanner.${outputFormat === "tsv" ? "tsv" : "txt"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      report: makeTextStream(report, "text/plain"),
      table: makeTableStream(technicalSequenceTableColumns, rows, "technical-sequence-scanner")
    }
  });
}
