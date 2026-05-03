import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import { getGeneticCode, makeCodonMap } from "../../core/genetic-code.js";
import { cleanDnaRnaSequence, complementDnaRnaSequence } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

const FRAME_SETS = {
  "1": [{ label: "+1", offset: 0, reverse: false }],
  "2": [{ label: "+2", offset: 1, reverse: false }],
  "3": [{ label: "+3", offset: 2, reverse: false }],
  "all-forward": [
    { label: "+1", offset: 0, reverse: false },
    { label: "+2", offset: 1, reverse: false },
    { label: "+3", offset: 2, reverse: false }
  ],
  "all-reverse": [
    { label: "-1", offset: 0, reverse: true },
    { label: "-2", offset: 1, reverse: true },
    { label: "-3", offset: 2, reverse: true }
  ],
  "all-six": [
    { label: "+1", offset: 0, reverse: false },
    { label: "+2", offset: 1, reverse: false },
    { label: "+3", offset: 2, reverse: false },
    { label: "-1", offset: 0, reverse: true },
    { label: "-2", offset: 1, reverse: true },
    { label: "-3", offset: 2, reverse: true }
  ]
};

function reverseComplement(sequence) {
  return Array.from(complementDnaRnaSequence(sequence, { preserveCase: false })).reverse().join("");
}

export function translateSequence(sequence, options = {}) {
  const code = getGeneticCode(options.geneticCode ?? "1");
  const codonMap = makeCodonMap(code);
  const offset = Math.max(0, Math.min(2, Number.parseInt(options.offset, 10) || 0));
  const source = String(sequence ?? "").toUpperCase().replaceAll("U", "T");
  let protein = "";
  let ambiguousCodons = 0;

  for (let index = offset; index + 3 <= source.length; index += 3) {
    const codon = source.slice(index, index + 3);
    const aa = codonMap.get(codon);

    if (aa) {
      protein += aa;
    } else {
      protein += "X";
      ambiguousCodons += 1;
    }
  }

  return {
    protein,
    ambiguousCodons,
    trailingBases: Math.max(0, (source.length - offset) % 3)
  };
}

function getFrames(frameOption) {
  return FRAME_SETS[frameOption] ?? FRAME_SETS["1"];
}

function formatPlainTranslation(recordTitle, frame, protein, includeTitle) {
  if (!includeTitle) {
    return protein;
  }

  return `${recordTitle} translated ${frame.label}\n${protein}`;
}

export const translationTableColumns = [
  { id: "source_title", label: "Source title", type: "string" },
  { id: "title", label: "Protein title", type: "string" },
  { id: "frame", label: "Frame", type: "string" },
  { id: "genetic_code", label: "Genetic code", type: "string" },
  { id: "length", label: "Protein length", type: "number" },
  { id: "ambiguous_codons", label: "Ambiguous codons", type: "number" },
  { id: "trailing_bases", label: "Trailing bases", type: "number" },
  { id: "reverse", label: "Reverse strand", type: "boolean" },
  { id: "offset", label: "Offset", type: "number" }
];

export function runTranslate(input, options = {}) {
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
  const translatedRecords = [];
  const translationRows = [];
  const frames = getFrames(options.frame);
  const formatFasta = options.formatFasta !== false;
  const lineWidth = options.lineWidth ?? 60;
  const code = getGeneticCode(options.geneticCode ?? "1");
  let basesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanDnaRnaSequence(record.sequence, {
      preserveCase: false,
      keepGaps: false
    });
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

    for (const frame of frames) {
      const sequence = frame.reverse ? reverseComplement(cleaned.sequence) : cleaned.sequence;
      const result = translateSequence(sequence, {
        geneticCode: code.id,
        offset: frame.offset
      });

      if (result.ambiguousCodons > 0) {
        warnings.push(
          `${record.title} ${frame.label}: translated ${result.ambiguousCodons} ambiguous codon(s) as X.`
        );
      }

      if (result.trailingBases > 0) {
        warnings.push(
          `${record.title} ${frame.label}: ignored ${result.trailingBases} trailing base(s) outside a complete codon.`
        );
      }

      const title = `${record.title} translated ${frame.label} code ${code.id}`;
      translatedRecords.push({
        title,
        sequence: result.protein,
        sourceTitle: record.title,
        frame: frame.label,
        geneticCode: code.id,
        reverse: frame.reverse,
        offset: frame.offset,
        ambiguousCodons: result.ambiguousCodons,
        trailingBases: result.trailingBases
      });
      translationRows.push({
        source_title: record.title,
        title,
        frame: frame.label,
        genetic_code: code.id,
        length: result.protein.length,
        ambiguous_codons: result.ambiguousCodons,
        trailing_bases: result.trailingBases,
        reverse: frame.reverse,
        offset: frame.offset
      });

      if (formatFasta) {
        outputParts.push(
          formatFastaRecord(
            title,
            result.protein,
            lineWidth
          )
        );
      } else {
        outputParts.push(formatPlainTranslation(record.title, frame, result.protein, frames.length > 1));
      }
    }
  }

  const output = formatFasta ? outputParts.join("\n") : outputParts.join("\n\n");
  const fastaOutput = translatedRecords
    .map((record) => formatFastaRecord(record.title, record.sequence, lineWidth))
    .join("\n");

  return makeToolResult({
    output,
    download: {
      filename: `translate.${formatFasta ? "fasta" : "txt"}`,
      mimeType: "text/plain;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(fastaOutput, "text/x-fasta"),
      translations: makeTableStream(translationTableColumns, translationRows, "translate-dna-rna"),
      proteinRecords: {
        kind: "sequence-records",
        schema: "translated-protein-records",
        alphabet: "protein",
        records: translatedRecords
      }
    }
  });
}
