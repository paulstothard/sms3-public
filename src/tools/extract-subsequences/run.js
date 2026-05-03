import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import {
  cleanSequence,
  complementDnaRnaSequence
} from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const extractSubsequencesTableColumns = [
  { id: "record", label: "Record", type: "string" },
  { id: "region", label: "Region", type: "number" },
  { id: "requested_start", label: "Requested start", type: "number" },
  { id: "requested_end", label: "Requested end", type: "number" },
  { id: "start", label: "Start", type: "number" },
  { id: "end", label: "End", type: "number" },
  { id: "length", label: "Length", type: "number" },
  { id: "strand", label: "Strand", type: "string" },
  { id: "sequence", label: "Sequence", type: "string" }
];
const TSV_COLUMNS = extractSubsequencesTableColumns.map((column) => column.id);

function getAlphabetLabel(alphabet) {
  return alphabet === "protein" ? "protein" : "DNA/RNA";
}

function getToolName(alphabet) {
  return alphabet === "protein" ? "Extract Subsequences Protein" : "Extract Subsequences DNA/RNA";
}

function getAlphabetMismatchWarning(sequence, alphabet) {
  const letters = String(sequence ?? "").replace(/[^A-Za-z*]/g, "");
  if (letters.length < 12) {
    return "";
  }

  const upper = letters.toUpperCase();
  const dnaLikeCount = Array.from(upper).filter((character) => /[ACGTUN]/.test(character)).length;
  const dnaLikeFraction = dnaLikeCount / upper.length;

  if (alphabet === "dna-rna" && /[EFILOPQZJ]/.test(upper)) {
    return "input contains letters commonly found in protein sequences. If this is protein, use Extract Subsequences Protein.";
  }

  if (alphabet === "protein" && dnaLikeFraction >= 0.9) {
    return "input looks nucleotide-rich. If this is DNA/RNA, use Extract Subsequences DNA/RNA.";
  }

  return "";
}

export function parseCoordinateSpec(coordinates) {
  const text = String(coordinates ?? "").trim();
  if (!text) {
    return { regions: [], errors: ["No coordinates were provided."] };
  }

  const regions = [];
  const errors = [];
  const tokens = text
    .split(/[\n;,]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  tokens.forEach((token, index) => {
    const match = token.match(/^(\d+)(?:\s*(?:-|\.\.|:)\s*(\d+))?$/);
    if (!match) {
      errors.push(`Coordinate ${index + 1} "${token}" is not valid.`);
      return;
    }

    const start = Number.parseInt(match[1], 10);
    const end = Number.parseInt(match[2] ?? match[1], 10);
    if (start < 1 || end < 1) {
      errors.push(`Coordinate ${index + 1} "${token}" must use positive 1-based positions.`);
      return;
    }
    if (start > end) {
      errors.push(`Coordinate ${index + 1} "${token}" has start greater than end.`);
      return;
    }

    regions.push({
      index: regions.length + 1,
      requestedStart: start,
      requestedEnd: end,
      label: `${start}-${end}`
    });
  });

  if (regions.length === 0 && errors.length === 0) {
    errors.push("No coordinates were provided.");
  }

  return { regions, errors };
}

function clipRegion(region, sequenceLength) {
  const start = Math.max(1, region.requestedStart);
  const end = Math.min(sequenceLength, region.requestedEnd);

  if (sequenceLength === 0 || start > end) {
    return null;
  }

  return {
    ...region,
    start,
    end,
    clipped: start !== region.requestedStart || end !== region.requestedEnd
  };
}

function reverseComplement(sequence, preserveCase) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase })).reverse().join("");
}

function makeRows(extractedRecords) {
  return extractedRecords.map((record) => ({
    record: record.sourceTitle,
    region: record.region,
    requested_start: record.requestedStart,
    requested_end: record.requestedEnd,
    start: record.start,
    end: record.end,
    length: record.sequence.length,
    strand: record.strand,
    sequence: record.sequence
  }));
}

function makeTsv(rows) {
  return [
    TSV_COLUMNS.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.region,
        row.requested_start,
        row.requested_end,
        row.start,
        row.end,
        row.length,
        row.strand,
        row.sequence
      ].join("\t")
    )
  ].join("\n");
}

export function runExtractSubsequences(input, options = {}) {
  const records = parseSequenceInput(input, "sequence");
  const warnings = [];
  const alphabet = options.alphabet === "protein" ? "protein" : "dna-rna";
  const alphabetLabel = getAlphabetLabel(alphabet);
  const coordinateSpec = parseCoordinateSpec(options.coordinates);

  if (coordinateSpec.errors.length > 0) {
    warnings.push(...coordinateSpec.errors);
  }

  if (coordinateSpec.regions.length === 0) {
    return makeToolResult({
      output: "",
      warnings,
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: [...warnings, "No sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  const extractedRecords = [];
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const mismatchWarning = getAlphabetMismatchWarning(record.sequence, alphabet);
    if (mismatchWarning) {
      warnings.push(`${record.title}: ${mismatchWarning}`);
    }

    const cleaned = cleanSequence(record.sequence, {
      alphabet,
      preserveCase: options.preserveCase,
      keepGaps: options.keepGaps
    });
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-${alphabetLabel} character(s).`);
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no ${alphabetLabel} sequence characters were found.`);
    }

    for (const region of coordinateSpec.regions) {
      const clipped = clipRegion(region, cleaned.sequence.length);
      if (!clipped) {
        warnings.push(`${record.title}: coordinate ${region.label} has no overlap with sequence length ${cleaned.sequence.length}.`);
        continue;
      }
      if (clipped.clipped) {
        warnings.push(`${record.title}: coordinate ${region.label} was clipped to ${clipped.start}-${clipped.end}.`);
      }

      const sourceSequence = cleaned.sequence.slice(clipped.start - 1, clipped.end);
      const shouldReverseComplement = alphabet === "dna-rna" && options.reverseComplement === true;
      const sequence = shouldReverseComplement
        ? reverseComplement(sourceSequence, options.preserveCase !== false)
        : sourceSequence;
      const strand = shouldReverseComplement ? "-" : "+";
      const title = `${record.title}:${clipped.start}-${clipped.end}${shouldReverseComplement ? " reverse complement" : ""}`;
      extractedRecords.push({
        title,
        sequence,
        sourceTitle: record.title,
        region: region.index,
        requestedStart: region.requestedStart,
        requestedEnd: region.requestedEnd,
        start: clipped.start,
        end: clipped.end,
        strand,
        alphabet
      });
    }
  }

  const lineWidth = Number.parseInt(options.lineWidth, 10) || 60;
  const fastaOutput = extractedRecords
    .map((record) => formatFastaRecord(record.title, record.sequence, lineWidth))
    .join("");
  const tableRows = makeRows(extractedRecords);
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "fasta";
  const output = outputFormat === "tsv" ? makeTsv(tableRows) : fastaOutput;

  return makeToolResult({
    output,
    download: {
      filename: `${getToolName(alphabet).toLowerCase().replaceAll(" ", "-").replace("/", "-")}.${outputFormat === "tsv" ? "tsv" : "fasta"}`,
      mimeType:
        outputFormat === "tsv"
          ? "text/tab-separated-values"
          : "text/x-fasta;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(fastaOutput, "text/x-fasta"),
      table: makeTableStream(extractSubsequencesTableColumns, tableRows, "extract-subsequences"),
      sequenceRecords: {
        kind: "sequence-records",
        schema: "extract-subsequences",
        alphabet,
        records: extractedRecords
      }
    }
  });
}

export function runExtractSubsequencesDnaRna(input, options = {}) {
  return runExtractSubsequences(input, { ...options, alphabet: "dna-rna" });
}

export function runExtractSubsequencesProtein(input, options = {}) {
  return runExtractSubsequences(input, { ...options, alphabet: "protein", reverseComplement: false });
}
