import { formatFastaRecord, parseSequenceInput } from "../../core/fasta.js";
import {
  reverseTranslateProteinSequence,
  reverseTranslateTableColumns
} from "../../core/reverse-translate.js";
import { cleanProteinSequence } from "../../core/sequence.js";
import { makeTableStream, makeTextStream, makeToolResult } from "../../core/workflow.js";
import { getCodonUsageReference } from "../../core/codon-reference.js";
import { codonUsageReferences } from "../../reference-data/codon-usage/references.js";

const defaultReferenceId =
  codonUsageReferences.find((reference) => reference.id === "ecoli-k12-mg1655-refseq")?.id ??
  codonUsageReferences[0]?.id ??
  "";

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "";
}

function makeReferenceSourceLabel(reference) {
  return `${reference.source?.name ?? ""} ${reference.source?.version ?? ""}`.trim();
}

function makeFastaTitle(recordTitle, mode, reference) {
  const source = makeReferenceSourceLabel(reference);
  const parts = [
    `${recordTitle} reverse translated ${mode}`,
    `codon_reference=${reference.id}`,
    `reference_name=${reference.name}`
  ];
  if (source) {
    parts.push(`reference_source=${source}`);
  }
  return parts.join("; ");
}

function makeTsv(rows) {
  const columns = reverseTranslateTableColumns.map((column) => column.id);
  return [
    columns.join("\t"),
    ...rows.map((row) =>
      [
        row.record,
        row.reference_id,
        row.reference_name,
        row.reference_source,
        row.position,
        row.residue,
        row.codon,
        row.candidate_codons,
        formatNumber(row.reference_fraction),
        formatNumber(row.reference_per_1000),
        row.mode,
        row.note
      ].join("\t")
    )
  ].join("\n");
}

export function runReverseTranslate(input, options = {}) {
  const records = parseSequenceInput(input, "protein");
  const reference = getCodonUsageReference(codonUsageReferences, options.referenceId ?? defaultReferenceId);
  const mode = options.mode === "degenerate" ? "degenerate" : "most-likely";
  const outputFormat = options.outputFormat === "tsv" ? "tsv" : "fasta";
  const lineWidth = options.lineWidth ?? 60;
  const warnings = [];

  if (records.length === 0) {
    return makeToolResult({
      output: "",
      warnings: ["No protein sequence input was provided."],
      recordsProcessed: 0,
      basesProcessed: 0,
      charactersRemoved: 0
    });
  }

  const dnaRecords = [];
  const tableRows = [];
  let residuesProcessed = 0;
  let charactersRemoved = 0;

  for (const record of records) {
    const cleaned = cleanProteinSequence(record.sequence, {
      preserveCase: false,
      keepGaps: false
    });
    residuesProcessed += cleaned.sequence.length;
    charactersRemoved += cleaned.removedCount;

    if (cleaned.removedCount > 0) {
      warnings.push(`${record.title}: removed ${cleaned.removedCount} non-protein character(s).`);
    }
    if (cleaned.sequence.length === 0) {
      warnings.push(`${record.title}: no protein sequence characters were found.`);
    }

    const result = reverseTranslateProteinSequence(cleaned.sequence, reference, { mode });
    warnings.push(...result.warnings.map((warning) => `${record.title}: ${warning}`));
    const referenceSource = makeReferenceSourceLabel(reference);
    const title = makeFastaTitle(record.title, mode, reference);
    dnaRecords.push({
      title,
      sequence: result.dna,
      sourceTitle: record.title,
      alphabet: "dna-rna",
      referenceId: reference.id,
      referenceName: reference.name,
      referenceSource,
      mode
    });
    tableRows.push(
      ...result.rows.map((row) => ({
        record: record.title,
        reference_id: reference.id,
        reference_name: reference.name,
        reference_source: referenceSource,
        ...row
      }))
    );
  }

  const fastaOutput = dnaRecords.map((record) => formatFastaRecord(record.title, record.sequence, lineWidth)).join("\n");
  const tsvOutput = makeTsv(tableRows);
  const output = outputFormat === "tsv" ? tsvOutput : fastaOutput;

  return makeToolResult({
    output,
    download: {
      filename: `reverse-translate.${outputFormat === "tsv" ? "tsv" : "fasta"}`,
      mimeType: outputFormat === "tsv" ? "text/tab-separated-values" : "text/x-fasta;charset=utf-8"
    },
    warnings,
    recordsProcessed: records.length,
    basesProcessed: residuesProcessed,
    charactersRemoved,
    streams: {
      fasta: makeTextStream(fastaOutput, "text/x-fasta"),
      table: makeTableStream(reverseTranslateTableColumns, tableRows, "reverse-translate"),
      dnaRecords: {
        kind: "sequence-records",
        schema: "reverse-translated-dna-records",
        alphabet: "dna-rna",
        records: dnaRecords
      }
    }
  });
}
