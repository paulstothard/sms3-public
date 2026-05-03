import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import { cleanDnaRnaSequence, complementDnaRnaSequence } from "../../core/sequence.js";
import { makeTextStream, makeToolResult } from "../../core/workflow.js";

export function complementSequence(sequence, options = {}) {
  return { sequence: complementDnaRnaSequence(sequence, options), warnings: [] };
}

export function reverseComplementSequence(sequence, options = {}) {
  const operation = options.operation ?? "reverse-complement";
  const source = String(sequence ?? "");

  if (operation === "reverse") {
    return { sequence: Array.from(source).reverse().join(""), warnings: [] };
  }

  const complemented = complementSequence(source, options);

  if (operation === "complement") {
    return complemented;
  }

  return {
    sequence: Array.from(complemented.sequence).reverse().join(""),
    warnings: complemented.warnings
  };
}

export function runReverseComplement(input, options = {}) {
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

  const outputParts = [];
  const transformedRecords = [];
  const formatFasta = options.formatFasta !== false;
  const lineWidth = options.lineWidth ?? 60;
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanDnaRnaSequence(record.sequence);
    basesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(
        `${record.title}: removed ${cleaned.removedCount} non-DNA/RNA character(s).`
      );
    }

    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no DNA/RNA sequence characters were found.`);
    }

    const result = reverseComplementSequence(cleaned.sequence, options);
    warnings.push(...result.warnings.map((warning) => `${record.title}: ${warning}`));
    const suffix =
      options.operation === "reverse"
        ? " reverse"
        : options.operation === "complement"
          ? " complement"
          : " reverse complement";
    const title = `${record.title}${suffix}`;
    transformedRecords.push({
      title,
      sequence: result.sequence,
      sourceTitle: record.title,
      operation: options.operation ?? "reverse-complement"
    });

    if (formatFasta) {
      outputParts.push(formatFastaRecord(title, result.sequence, lineWidth));
    } else {
      outputParts.push(result.sequence);
    }
  }

  const output = formatFasta ? outputParts.join("\n") : outputParts.join("\n");
  const fastaOutput = transformedRecords
    .map((record) => formatFastaRecord(record.title, record.sequence, lineWidth))
    .join("\n");

  return makeToolResult({
    output,
    download: {
      filename: `reverse-complement.${formatFasta ? "fasta" : "txt"}`,
      mimeType: formatFasta ? "text/plain;charset=utf-8" : "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(fastaOutput, "text/x-fasta"),
      sequenceRecords: {
        kind: "sequence-records",
        schema: "reverse-complement-dna-rna",
        alphabet: "dna-rna",
        records: transformedRecords
      }
    }
  });
}
