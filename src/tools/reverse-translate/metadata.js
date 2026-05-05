import { listCodonUsageReferences } from "../../core/codon-reference.js";
import { reverseTranslateTableColumns } from "../../core/reverse-translate.js";
import { codonUsageReferences } from "../../reference-data/codon-usage/references.js";

const referenceChoices = listCodonUsageReferences(codonUsageReferences).map((reference) => ({
  value: reference.id,
  label: reference.name
}));
const defaultReferenceId =
  referenceChoices.find((reference) => reference.value === "ecoli-k12-mg1655-refseq")?.value ??
  referenceChoices[0]?.value ??
  "";

export const reverseTranslateMetadata = {
  id: "reverse-translate",
  name: "Reverse Translate",
  category: "Analyze Protein",
  tags: ["DNA", "protein", "codon", "translation", "reference data"],
  summary: "Reverse translate protein sequences to DNA using bundled codon usage references or degenerate IUPAC codons.",
  inputType: "Protein sequence",
  outputType: "DNA FASTA, TSV table",
  workflow: {
    inputs: [
      { id: "input", kind: "text", mediaType: "text/plain" },
      { id: "proteinRecords", kind: "sequence-records", alphabet: "protein" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "fasta", kind: "text", mediaType: "text/x-fasta" },
      { id: "dnaRecords", kind: "sequence-records", alphabet: "dna-rna", schema: "reverse-translated-dna-records" },
      { id: "table", kind: "table", schema: "reverse-translate", columns: reverseTranslateTableColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "referenceId",
      label: "Codon reference",
      type: "select",
      defaultValue: defaultReferenceId,
      choices: referenceChoices
    },
    {
      id: "mode",
      label: "Reverse translation mode",
      type: "radio",
      defaultValue: "most-likely",
      choices: [
        { value: "most-likely", label: "Most likely codons" },
        { value: "degenerate", label: "Degenerate IUPAC DNA" }
      ]
    },
    {
      id: "outputFormat",
      label: "Output format",
      type: "radio",
      defaultValue: "fasta",
      choices: [
        { value: "fasta", label: "DNA FASTA" },
        { value: "tsv", label: "Codon choice table" }
      ]
    },
    {
      id: "lineWidth",
      type: "number",
      label: "Bases per output line",
      defaultValue: 60,
      min: 10,
      max: 200
    },
    {
      id: "note",
      type: "note",
      text: "Most likely codons are selected from the chosen bundled codon reference. Degenerate output uses IUPAC ambiguity symbols for all candidate codons."
    }
  ]
};
