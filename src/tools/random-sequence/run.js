import { formatFastaRecord } from "../../core/fasta.js";
import {
  DNA_RNA_RANDOM_ALPHABET,
  PROTEIN_RANDOM_ALPHABET,
  RNA_RANDOM_ALPHABET,
  buildRandomCodingDnaRecord,
  mutateSequence,
  parseAndCleanRecords,
  randomSequence,
  replaceRandomRegions,
  resolveRandom,
  sampleSequence,
  shuffleSequence
} from "../../core/random-sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";

export const randomMutationTableColumns = [
  { id: "record", label: "Record" },
  { id: "output_record", label: "Output record" },
  { id: "mutation_number", label: "Mutation number" },
  { id: "position", label: "Position" },
  { id: "original", label: "Original" },
  { id: "replacement", label: "Replacement" },
  { id: "seed", label: "Seed" }
];

export const randomRegionTableColumns = [
  { id: "record", label: "Record" },
  { id: "output_record", label: "Output record" },
  { id: "region_number", label: "Region number" },
  { id: "start", label: "Start" },
  { id: "end", label: "End" },
  { id: "original", label: "Original" },
  { id: "replacement", label: "Replacement" },
  { id: "seed", label: "Seed" }
];

function alphabetValues(alphabet) {
  if (alphabet === "rna") {
    return RNA_RANDOM_ALPHABET;
  }
  return alphabet === "protein" ? PROTEIN_RANDOM_ALPHABET : DNA_RNA_RANDOM_ALPHABET;
}

function replacementAlphabetValues(alphabet, options = {}) {
  if (alphabet === "protein") {
    return PROTEIN_RANDOM_ALPHABET;
  }
  return options.nucleotideAlphabet === "rna" ? RNA_RANDOM_ALPHABET : DNA_RNA_RANDOM_ALPHABET;
}

function alphabetLabel(alphabet) {
  if (alphabet === "rna") {
    return "RNA";
  }
  return alphabet === "protein" ? "protein" : "DNA/RNA";
}

function makeReport({ toolName, seed, recordsProcessed, sequencesGenerated, basesProcessed, details = [] }) {
  return [
    `${toolName}`,
    `Random seed: ${seed}`,
    ...details,
    `Input records processed: ${recordsProcessed}`,
    `Sequences generated: ${sequencesGenerated}`,
    `Characters generated: ${basesProcessed}`
  ].join("\n") + "\n";
}

function pluralize(count, singular, plural = `${singular}s`) {
  return Number(count) === 1 ? singular : plural;
}

function escapeTsvValue(value) {
  return String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function tableToTsv(table) {
  if (!table) {
    return "";
  }
  const columns = table.columns ?? [];
  const rows = table.rows ?? [];
  return [
    columns.map((column) => column.id).join("\t"),
    ...rows.map((row) => columns.map((column) => escapeTsvValue(row[column.id])).join("\t"))
  ].join("\n") + "\n";
}

function makeEmptyResult(message) {
  return makeToolResult({
    output: "",
    warnings: [message],
    recordsProcessed: 0,
    basesProcessed: 0,
    charactersRemoved: 0
  });
}

function finishSequenceResult({
  toolName,
  filenameBase,
  alphabet,
  seed,
  outputRecords,
  inputRecordsProcessed,
  charactersRemoved = 0,
  warnings = [],
  table,
  lineWidth,
  options = {},
  reportDetails = []
}) {
  const output = outputRecords.map((record) => formatFastaRecord(record.title, record.sequence, lineWidth)).join("\n");
  const basesProcessed = outputRecords.reduce((sum, record) => sum + record.sequence.length, 0);
  const report = makeReport({
    toolName,
    seed,
    recordsProcessed: inputRecordsProcessed,
    sequencesGenerated: outputRecords.length,
    basesProcessed,
    details: reportDetails
  });
  const outputFormat = table && options?.outputFormat === "tsv"
    ? "tsv"
    : options?.outputFormat === "report"
      ? "report"
      : "fasta";
  const tsv = tableToTsv(table);
  const selectedOutput = outputFormat === "report" ? report : outputFormat === "tsv" ? tsv : output;
  return makeToolResult({
    output: selectedOutput,
    download: {
      filename: `${filenameBase}.${outputFormat === "tsv" ? "tsv" : outputFormat === "report" ? "txt" : "fasta"}`,
      mimeType: outputFormat === "tsv"
        ? "text/tab-separated-values;charset=utf-8"
        : outputFormat === "report"
          ? "text/plain;charset=utf-8"
          : "text/x-fasta;charset=utf-8"
    },
    warnings,
    recordsProcessed: inputRecordsProcessed,
    basesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(output, "text/x-fasta"),
      sequenceRecords: {
        kind: "sequence-records",
        schema: filenameBase,
        alphabet,
        records: outputRecords
      },
      report: makeTextStream(report, "text/plain"),
      ...(table ? { tsv: makeTextStream(tsv, "text/tab-separated-values") } : {}),
      ...(table ? { table } : {})
    }
  });
}

export function runRandomSequenceGenerator(input, options = {}) {
  const generatedAlphabet = options.alphabet === "protein"
    ? "protein"
    : options.nucleotideAlphabet === "rna"
      ? "rna"
      : "dna-rna";
  const workflowAlphabet = generatedAlphabet === "protein" ? "protein" : "dna-rna";
  const { seed, random } = resolveRandom(options);
  const sequenceCount = Math.max(1, Number.parseInt(options.sequenceCount, 10) || 1);
  const sequenceLength = Math.max(1, Number.parseInt(options.sequenceLength, 10) || 1);
  const outputRecords = [];

  for (let index = 0; index < sequenceCount; index += 1) {
    outputRecords.push({
      title: `${alphabetLabel(generatedAlphabet)} random sequence ${index + 1} seed=${seed}`,
      sequence: randomSequence(sequenceLength, alphabetValues(generatedAlphabet), random),
      seed
    });
  }

  return finishSequenceResult({
    toolName: `Random ${alphabetLabel(generatedAlphabet)} Sequence`,
    filenameBase: generatedAlphabet === "protein" ? "random-protein" : "random-dna-rna",
    alphabet: workflowAlphabet,
    seed,
    outputRecords,
    inputRecordsProcessed: 0,
    lineWidth: options.lineWidth,
    options
  });
}

export function runRandomCodingDna(input, options = {}) {
  const { seed, random } = resolveRandom(options);
  const sequenceCount = Math.max(1, Number.parseInt(options.sequenceCount, 10) || 1);
  const outputRecords = [];
  const warnings = new Set();

  for (let index = 0; index < sequenceCount; index += 1) {
    const codingRecord = buildRandomCodingDnaRecord(options, random);
    codingRecord.warnings.forEach((warning) => warnings.add(warning));
    outputRecords.push({
      title: `random coding DNA ${index + 1} seed=${seed}`,
      sequence: codingRecord.sequence,
      seed,
      geneticCode: options.geneticCode ?? "1",
      startCodon: codingRecord.startCodon,
      startCodonMode: codingRecord.startCodonMode
    });
  }

  return finishSequenceResult({
    toolName: "Random Coding DNA",
    filenameBase: "random-coding-dna",
    alphabet: "dna-rna",
    seed,
    outputRecords,
    inputRecordsProcessed: 0,
    warnings: [...warnings],
    reportDetails: [
      `Start codon: ${outputRecords[0]?.startCodon || "none"}`,
      `Start codon mode: ${outputRecords[0]?.startCodonMode || "none"}`
    ],
    lineWidth: options.lineWidth,
    options
  });
}

function runInputSequenceTool(input, options = {}, operation) {
  const alphabet = options.alphabet === "protein" ? "protein" : "dna-rna";
  const { records, charactersRemoved } = parseAndCleanRecords(input, alphabet);
  if (records.length === 0) {
    return makeEmptyResult(`No ${alphabetLabel(alphabet)} sequence input was provided.`);
  }

  const warnings = [];
  for (const record of records) {
    if (record.removedCount > 0) {
      warnings.push(
        `${record.title}: removed ${record.removedCount} non-${alphabetLabel(alphabet)} ${pluralize(record.removedCount, "character")}.`
      );
    }
    if (record.sequence.length === 0) {
      warnings.push(`${record.title}: no ${alphabetLabel(alphabet)} sequence characters were found.`);
    }
  }

  const usableRecords = records.filter((record) => record.sequence.length > 0);
  if (usableRecords.length === 0) {
    return makeEmptyResult(`No ${alphabetLabel(alphabet)} sequence characters were found.`);
  }

  const { seed, random } = resolveRandom(options);
  return operation({ records: usableRecords, warnings, charactersRemoved, seed, random, alphabet });
}

export function runShuffleSequence(input, options = {}) {
  return runInputSequenceTool(input, options, ({ records, warnings, charactersRemoved, seed, random, alphabet }) => {
    const outputRecords = records.map((record) => ({
      title: `${record.title} shuffled seed=${seed}`,
      sequence: shuffleSequence(record.sequence, random),
      sourceTitle: record.title,
      seed
    }));
    return finishSequenceResult({
      toolName: `Shuffle ${alphabetLabel(alphabet)}`,
      filenameBase: alphabet === "protein" ? "shuffle-protein" : "shuffle-dna-rna",
      alphabet,
      seed,
      outputRecords,
      inputRecordsProcessed: records.length,
      charactersRemoved,
      warnings,
      lineWidth: options.lineWidth,
      options
    });
  });
}

export function runSampleSequence(input, options = {}) {
  return runInputSequenceTool(input, options, ({ records, warnings, charactersRemoved, seed, random, alphabet }) => {
    const outputRecords = [];
    const samplesPerRecord = Math.max(1, Number.parseInt(options.samplesPerRecord, 10) || 1);
    const sampleLength = Math.max(1, Number.parseInt(options.sampleLength, 10) || 1);
    for (const record of records) {
      for (let index = 0; index < samplesPerRecord; index += 1) {
        outputRecords.push({
          title: `${record.title} sample ${index + 1} seed=${seed}`,
          sequence: sampleSequence(record.sequence, sampleLength, random),
          sourceTitle: record.title,
          seed
        });
      }
    }
    return finishSequenceResult({
      toolName: `Sample ${alphabetLabel(alphabet)}`,
      filenameBase: alphabet === "protein" ? "sample-protein" : "sample-dna-rna",
      alphabet,
      seed,
      outputRecords,
      inputRecordsProcessed: records.length,
      charactersRemoved,
      warnings,
      lineWidth: options.lineWidth,
      options
    });
  });
}

export function runMutateSequence(input, options = {}) {
  return runInputSequenceTool(input, options, ({ records, warnings, charactersRemoved, seed, random, alphabet }) => {
    const outputRecords = [];
    const rows = [];
    for (const record of records) {
      const protectedStart = options.preserveEnds === false ? 0 : alphabet === "protein" ? 1 : 3;
      const protectedEnd = options.preserveEnds === false ? 0 : alphabet === "protein" ? 0 : 3;
      const outputTitle = `${record.title} mutated seed=${seed}`;
      const result = mutateSequence(record.sequence, {
        ...options,
        alphabetValues: replacementAlphabetValues(alphabet, options),
        protectedStart,
        protectedEnd
      }, random);
      outputRecords.push({
        title: outputTitle,
        sequence: result.sequence,
        sourceTitle: record.title,
        seed
      });
      rows.push(...result.rows.map((row) => ({
        record: record.title,
        output_record: outputTitle,
        ...row,
        seed
      })));
    }
    return finishSequenceResult({
      toolName: `Mutate ${alphabetLabel(alphabet)}`,
      filenameBase: alphabet === "protein" ? "mutate-protein" : "mutate-dna-rna",
      alphabet,
      seed,
      outputRecords,
      inputRecordsProcessed: records.length,
      charactersRemoved,
      warnings,
      table: makeTableStream(randomMutationTableColumns, rows, "random-mutations"),
      lineWidth: options.lineWidth,
      options
    });
  });
}

export function runRandomRegions(input, options = {}) {
  return runInputSequenceTool(input, options, ({ records, warnings, charactersRemoved, seed, random, alphabet }) => {
    const outputRecords = [];
    const rows = [];
    for (const record of records) {
      const outputTitle = `${record.title} randomized regions seed=${seed}`;
      const result = replaceRandomRegions(record.sequence, {
        ...options,
        alphabetValues: replacementAlphabetValues(alphabet, options)
      }, random);
      outputRecords.push({
        title: outputTitle,
        sequence: result.sequence,
        sourceTitle: record.title,
        seed
      });
      rows.push(...result.rows.map((row) => ({
        record: record.title,
        output_record: outputTitle,
        ...row,
        seed
      })));
    }
    return finishSequenceResult({
      toolName: `Random ${alphabetLabel(alphabet)} Regions`,
      filenameBase: alphabet === "protein" ? "random-protein-regions" : "random-dna-rna-regions",
      alphabet,
      seed,
      outputRecords,
      inputRecordsProcessed: records.length,
      charactersRemoved,
      warnings,
      table: makeTableStream(randomRegionTableColumns, rows, "random-regions"),
      lineWidth: options.lineWidth,
      options
    });
  });
}

export const runRandomDnaRna = (input, options = {}) =>
  runRandomSequenceGenerator(input, { ...options, alphabet: "dna-rna" });
export const runRandomProtein = (input, options = {}) =>
  runRandomSequenceGenerator(input, { ...options, alphabet: "protein" });
export const runShuffleDnaRna = (input, options = {}) =>
  runShuffleSequence(input, { ...options, alphabet: "dna-rna" });
export const runShuffleProtein = (input, options = {}) =>
  runShuffleSequence(input, { ...options, alphabet: "protein" });
export const runSampleDnaRna = (input, options = {}) =>
  runSampleSequence(input, { ...options, alphabet: "dna-rna" });
export const runSampleProtein = (input, options = {}) =>
  runSampleSequence(input, { ...options, alphabet: "protein" });
export const runMutateDnaRna = (input, options = {}) =>
  runMutateSequence(input, { ...options, alphabet: "dna-rna" });
export const runMutateProtein = (input, options = {}) =>
  runMutateSequence(input, { ...options, alphabet: "protein" });
export const runRandomDnaRnaRegions = (input, options = {}) =>
  runRandomRegions(input, { ...options, alphabet: "dna-rna" });
export const runRandomProteinRegions = (input, options = {}) =>
  runRandomRegions(input, { ...options, alphabet: "protein" });
