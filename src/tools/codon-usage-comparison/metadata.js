import { codonUsageComparisonTableColumns } from "../../core/codon-usage-comparison.js";
import { listCodonUsageReferences } from "../../core/codon-reference.js";
import { codonUsageReferences } from "../../reference-data/codon-usage/references.js";

const referenceChoices = listCodonUsageReferences(codonUsageReferences).map((reference) => ({
  value: reference.id,
  label: reference.name
}));
const defaultReferenceId =
  referenceChoices.find((reference) => reference.value === "ecoli-k12-mg1655-refseq")?.value ??
  referenceChoices[0]?.value ??
  "";

export const codonUsageComparisonMetadata = {
  id: "codon-usage-comparison",
  name: "Codon Usage Comparison",
  category: "DNA / RNA",
  tags: ["DNA", "RNA", "codon", "statistics", "reference data"],
  summary: "Compare observed coding-sequence codon usage with a bundled codon usage reference.",
  inputType: "DNA/RNA coding sequence",
  outputType: "Report, TSV table",
  workflow: {
    inputs: [
      { id: "sequenceRecords", kind: "sequence-records", alphabet: "dna-rna" },
      { id: "text", kind: "text", mediaType: "text/plain" },
      { id: "orfRecords", kind: "orf-records", schema: "orf-finder" }
    ],
    outputs: [
      { id: "primary", kind: "text", mediaType: "text/plain" },
      { id: "report", kind: "text", mediaType: "text/plain" },
      { id: "table", kind: "table", schema: "codon-usage-comparison", columns: codonUsageComparisonTableColumns },
      { id: "warnings", kind: "warnings" }
    ]
  },
  options: [
    {
      id: "referenceId",
      label: "Reference",
      type: "select",
      defaultValue: defaultReferenceId,
      choices: referenceChoices
    },
    {
      id: "excludeTerminalStop",
      label: "Exclude terminal stop codon",
      type: "checkbox",
      defaultValue: true
    },
    {
      id: "outputFormat",
      label: "Output format",
      type: "radio",
      defaultValue: "report",
      choices: [
        { value: "report", label: "Summary report" },
        { value: "tsv", label: "TSV table" }
      ]
    },
    {
      id: "note",
      type: "note",
      text: "Bundled references are generated from checked-in source provenance. The synthetic seed is for testing; organism-specific references should be used for biological interpretation."
    }
  ]
};
