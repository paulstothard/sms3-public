import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import { cleanSequence } from "../../core/sequence.js";
import { makeTextStream, makeToolResult } from "../../core/workflow.js";

function getAlphabetLabel(alphabet) {
  return alphabet === "protein" ? "protein" : "DNA/RNA";
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
    return "input contains letters commonly found in protein sequences. If this is protein, use Clean / Filter Protein.";
  }

  if (alphabet === "protein" && dnaLikeFraction >= 0.9) {
    return "input looks nucleotide-rich. If this is DNA/RNA, use Clean / Filter DNA/RNA.";
  }

  return "";
}

export function runCleanFilterSequence(input, options = {}) {
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

  const alphabet = options.alphabet === "protein" ? "protein" : "dna-rna";
  const alphabetLabel = getAlphabetLabel(alphabet);
  const formatFasta = options.formatFasta !== false;
  const lineWidth = options.lineWidth ?? 60;
  const outputParts = [];
  const cleanedRecords = [];
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
      warnings.push(
        `${record.title}: removed ${cleaned.removedCount} non-${alphabetLabel} character(s).`
      );
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no ${alphabetLabel} sequence characters were found.`);
    }

    cleanedRecords.push({
      title: `${record.title} cleaned`,
      sequence: cleaned.sequence,
      sourceTitle: record.title,
      alphabet,
      charactersRemoved: cleaned.removedCount
    });

    if (formatFasta) {
      outputParts.push(formatFastaRecord(`${record.title} cleaned`, cleaned.sequence, lineWidth));
    } else {
      outputParts.push(cleaned.sequence);
    }
  }

  const output = outputParts.join(formatFasta ? "\n" : "\n");
  const fastaOutput = cleanedRecords
    .map((record) => formatFastaRecord(record.title, record.sequence, lineWidth))
    .join("\n");

  return makeToolResult({
    output,
    download: {
      filename: `clean-filter-sequence.${formatFasta ? "fasta" : "txt"}`,
      mimeType: "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(fastaOutput, "text/x-fasta"),
      sequenceRecords: {
        kind: "sequence-records",
        schema: "clean-filter-sequence",
        alphabet,
        records: cleanedRecords
      }
    }
  });
}

export function runCleanFilterDnaRna(input, options = {}) {
  return runCleanFilterSequence(input, { ...options, alphabet: "dna-rna" });
}

export function runCleanFilterProtein(input, options = {}) {
  return runCleanFilterSequence(input, { ...options, alphabet: "protein" });
}
